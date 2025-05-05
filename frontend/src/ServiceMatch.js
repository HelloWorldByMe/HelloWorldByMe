import React, { useEffect, useState } from "react";

const ServiceMatch = () => {
  // default values
  const [clients, setClients] = useState({});
  const [selectedClient, setSelectedClient] = useState("");
  const [age, setAge] = useState("12-17");
  const [gender, setGender] = useState("Male");
  const [services, setServices] = useState("any");
  const [matches, setMatches] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [selectedShelter, setSelectedShelter] = useState(null);

  // Helper function to get the token from localStorage
  const getAuthToken = () => localStorage.getItem("token"); // Replace with your token location

  useEffect(() => {
    const fetchClients = async () => {
      const token = getAuthToken();
      if (!token) {
        alert("Unauthorized! Please log in.");
        return;
      }

      try {
        // fetching CLIENTS using user token
        const clientsResponse = await fetch("/api/clients", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const clientsJson = await clientsResponse.json();
        console.log("clientsJson:", clientsJson);

        // mapping out clients
        const map = {};
        clientsJson.clients.forEach((client) => {
          map[`${client.first_name} ${client.last_name}`] = client;
        });

        setClients(map);

        // retrieving SHELTERS with token
        const sheltersResponse = await fetch("/api/organizations", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const sheltersJson = await sheltersResponse.json();
        console.log("sheltersJson:", sheltersJson);

        // parsing service data
        const parsed = sheltersJson.organizations.map((shelter) => ({
          ...shelter,
          restrictions: {
            notes: shelter.description || "",
            age_range: "any",
            gender: "any",
            services: "any",
            ...(shelter.restrictions || {}),
          },
        }));

        setShelters(parsed);
      } catch (error) {
        console.error("Error retrieving organizations: ", error);
        alert("Failed to load data.");
      }
    };

    fetchClients();
  }, []);

  const handleMatch = async () => {
    // proof that matching is happening
    console.log("Matching process has started...");

    if (!clients[selectedClient]) {
      alert("Please select a client");
      return;
    }

    const token = getAuthToken();

    try {
      // proof that matching filters are applied
      console.log("Sending match filters: ", {
        age,
        gender,
        service: services,
      });

      const response = await fetch("/api/match-services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          age,
          gender,
          service: services,
        }),
      });

      const receive = await response.json();

      const parsedMatches = receive.matches.map((shelter) => {
        // filters out the shelters that have multiple services but under the same name
        const individual_shelters = [...new Set(shelter.services)];

        return {
          ...shelter,
          services: individual_shelters,
          restrictions: {
            notes: shelter.description || "",
            age_range: "any",
            gender: "any",
            services: "any",
            ...(shelter.restrictions || {}),
          },
        };
      });

      setMatches(parsedMatches);
    } catch (error) {
      console.error("Error during matching: ", error);
      alert("Error matching services");
    }
  };

  const handleSubmit = async () => {
    if (!selectedShelter) {
      alert("Please select a shelter before submitting.");
      return;
    }

    // defining referral structure
    const referrals = {
      client_id: clients[selectedClient].id,
      orgId: selectedShelter.id,
      service_id: selectedShelter.services,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const token = getAuthToken();

    try {
      const refers = await fetch("/api/referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(referrals),
      });

      if (refers.ok) {
        alert("Client has a new referral");
      } else {
        alert("Referral submission failed.");
      }
    } catch (error) {
      alert("Error concerning submitting the referral occurred.");
      console.error("Error submitting referral: ", error);
    }
  };

  // handles displays
  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-xl text-gray-800">
      <h2 className="text-2xl font-bold mb-4 text-center">Service Matching</h2>

      <div className="mb-6">
        <label htmlFor="select-individual" className="block mb-2 text-blue-800 font-medium">
          Select Individual
        </label>
        <select id="select-individual"
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="">--Select Individual--</option>
          {Object.keys(clients).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3 mb-4">
        <label className="block">
          Age:
          <select
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="12-17">12-17</option>
            <option value="18-24">18-24</option>
            <option value="25+">25+</option>
          </select>
        </label>
      </div>

      <div className="space-y-3 mb-4">
        <label className="block">
          Gender:
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="any">Not Sure</option>
          </select>
        </label>
      </div>

      <div className="space-y-3 mb-4">
        <label className="block">
          Mental Health/SUD/General Needs:
          <select
            value={services}
            onChange={(e) => setServices(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="any">Wants help, any kind</option>
            <option value="yes">Wants help, mental health/SUD related</option>
            <option value="no">Wants NO help</option>
          </select>
        </label>
        <button
          onClick={handleMatch}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Find Services
        </button>
      </div>

      <div className="mt-4">
        {matches.length === 0 ? (
          <p>No shelters available</p>
        ) : (
          matches
            // again to eliminate the display duplication of services
            .reduce((filteredShelter, shelter) => {
              if (!filteredShelter.some((s) => s.id === shelter.id)) {
                filteredShelter.push(shelter);
              }
              return filteredShelter;
            }, [])
            .map((shelter, idx) => (
              <div
                key={idx}
                className="border p-4 mb-3 bg-white shadow rounded-md"
              >
                <h3 className="font-bold">{shelter.name}</h3>
                <p>Available Beds: {shelter.available_beds}</p>
                <p>
                  Restrictions:{" "}
                  {shelter.restrictions?.notes || "No restrictions listed"}
                </p>

                <label className="flex items-center mt-2">
                  <input
                    type="radio"
                    name="selectedShelter"
                    value={idx}
                    onChange={() => setSelectedShelter(shelter)}
                    className="mr-2"
                  />
                  Bed Secured
                </label>
              </div>
            ))
        )}
      </div>

      {matches.length > 0 && (
        <button
          onClick={handleSubmit}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 mt-4"
        >
          Submit
        </button>
      )}
    </div>
  );
};
export default ServiceMatch;
