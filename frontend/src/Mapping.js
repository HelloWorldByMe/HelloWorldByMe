import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

// resizes map size to screen
function FixMapSize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [map]);
  return null;
}

const defaultPosition = [32.2226, -110.9747];

function MapClickHandler({ onMapClick, active }) {
  useMapEvents({
    click(e) {
      if (active) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

export default function Mapping() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [placedMarkerMode, setPlacedMarkerMode] = useState(false);
  const [activeMarkers, setActiveMarkers] = useState([]);
  const [activePolylines, setActivePolylines] = useState([]);

  // retrieves CLIENT data
  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => setClients(data.clients || []))
      .catch((err) => console.error("Failed to fetch clients", err));
  }, []);

  const handleMapClick = async (latlng) => {
    if (!placedMarkerMode || !selectedClientId) {
      alert("Please select a client before placing a marker.");
      return;
    }

    // defines what data is in the post request -> aligns with location table
    const payload = {
      latitude: latlng.lat,
      longitude: latlng.lng,
      client_id: selectedClientId,
    };

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const saved = await res.json();
      setActiveMarkers([...activeMarkers, saved]);

      // fixing the polylines -> make sure that the ids match datatype wise
      const new_markers = [...activeMarkers, saved];
      const client_markers = new_markers.filter(
        (m) => m.client_id.toString() === selectedClientId.toString()
      );
      // if there's more than 1 marker, draw lines connecting the markers
      if (client_markers.length >= 2) {
        const polyline = client_markers.map((m) => [m.latitude, m.longitude]);
        setActivePolylines((p) => [...p, polyline]);
      }
    } catch (err) {
      console.error("Failed to save location:", err);
    }

    setPlacedMarkerMode(false);
  };

  useEffect(() => {
    if (!selectedClientId) {
      setActiveMarkers([]);
      setActivePolylines([]);
      return;
    }

    fetch("/api/locations")
      .then((res) => res.json())
      .then((data) => {
        const curr_markers = data.filter(
          (m) => m.client_id.toString() === selectedClientId.toString()
        );
        // because of previous data insertion mistakes, makes sure that coordinates are valid
        const validation = curr_markers.filter(
          (m) => m.latitude && m.longitude
        );

        setActiveMarkers(curr_markers);

        if (validation.length >= 2) {
          const line = validation
            .map((m) => {
              if (m.latitude && m.longitude) {
                return [m.latitude, m.longitude];
              }
              return null;
            })
            .filter(Boolean);

          // setting up the lines
          if (line.length >= 2) {
            setActivePolylines([line]);
          } else {
            setActivePolylines([]);
          }
        } else {
          setActivePolylines([]);
        }
      })
      .catch((error) =>
        console.error("Failed to fetch past markers for client: ", error)
      );
  }, [selectedClientId]);

  const clearMarkers = () => {
    setActiveMarkers([]);
    setActivePolylines([]);
  };

  // defines how the markers look
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  // handles displays
  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-xl text-gray-800">
      <h2 className="text-2xl font-bold mb-4 text-center">
        WorldByMe Mapping Interface
      </h2>

      <div className="mb-6">
        <label className="block mb-2 text-blue-800 font-medium">
          Select Client to Place Marker
        </label>
        <select
          className="w-full p-2 border border-gray-300 rounded-md"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          <option value="">-- Select Client --</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => setPlacedMarkerMode(true)}
        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
      >
        Place Marker on Map
      </button>

      <MapContainer
        center={defaultPosition}
        zoom={13}
        scrollWheelZoom={true}
        className="h-[500px] w-full rounded-md shadow mt-6"
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FixMapSize />
        <MapClickHandler
          onMapClick={handleMapClick}
          active={placedMarkerMode}
        />

        {activeMarkers.map((m, idx) => {
          // deals with how if a client is selected, then only show their markers
          const client = clients.find((client) => client.id === m.client_id);
          return (
            <Marker position={[m.latitude, m.longitude]} key={idx}>
              <Popup>
                <strong>
                  {client.first_name} {client.last_name}
                </strong>
                <br />
                {new Date(m.timestamp).toLocaleString()}
              </Popup>
            </Marker>
          );
        })}

        {activePolylines.map((line, idx) => (
          <Polyline key={idx} positions={line} color="blue" weight={4} />
        ))}

        {selectedClientId && activeMarkers.length === 0 && (
          <p className="text-center text-gray-500 mt-4">
            No current marker data available for this client yet.
          </p>
        )}
      </MapContainer>

      <div className="flex justify-center mt-6">
        <button
          onClick={clearMarkers}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
        >
          Clear Markers
        </button>
      </div>
    </div>
  );
}
