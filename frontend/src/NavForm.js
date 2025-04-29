import { useState, useEffect } from "react";

export default function NavigatorForm() {
  // initializes data/states
  const [data, setData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    veteran_stat: "",
    num_of_kids: 0,
    current_situation: "",
    services: [],
    notes: [],
  });
  const [notes, setNotes] = useState({});
  const [filters, setFilters] = useState({ veteran_stat: "", num_of_kids: "" });

  // will retrieve clients
  useEffect(() => {
    fetch("/api/clients").then((res) =>
      res
        .json()
        .then((resData) => {
          const findingClient = {};
          resData.clients.forEach((client) => {
            const full_name = `${client.first_name} ${client.last_name}`;
            findingClient[full_name] = {
              id: client.id,
              age: client.age,
              gender: client.gender,
              veteran_stat: client.veteran_stat,
              num_of_kids: client.num_children,
              current_situation: client.current_situation,
              services: client.services,
              notes: client.clientNotes,
            };
          });
          setData(findingClient);
        })
        .catch((error) => {
          console.error("Error fetching client data: ", error);
        })
    );
  }, []);
  // search function
  const handleSearch = () => {
    const search_name = searchTerm.trim().toLowerCase();

    const filter_results = Object.entries(data).filter(([name, info]) => {
      // checks if filters have any results
      const name_match = name.toLowerCase().includes(search_name);
      const vet_stat_match = filters.veteran_stat
        ? info.veteran_stat === filters.veteran_stat
        : true;
      const kid_match =
        filters.num_of_kids !== ""
          ? info.num_of_kids === parseInt(filters.num_of_kids)
          : true;

      return name_match && vet_stat_match && kid_match;
    });
    // if results are found with filters, display it
    if (filter_results.length > 0) {
      const results = filter_results.map(([name, info]) => ({
        ...info,
        name,
      }));
      setSearchResult(results);
      setFormVisible(false);
      setNotes({});
      // otherwise show an empty input form
    } else {
      setSearchResult(null);
      setFormVisible(true);
      setFormData({
        name: searchTerm.trim(),
        age: "",
        gender: "",
        veteran_stat: "",
        num_of_kids: 0,
        current_situation: "",
        services: [],
        notes: [],
      });
    }
  };

  // function that handles the storage when data is submitted
  const handleSubmit = async () => {
    const new_info = { ...formData };
    console.log("Form data before submission: ", formData);

    try {
      const response = await fetch("api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // make retrieved data parsable
          name: formData.name,
          age: formData.age,
          gender: formData.gender,
          veteran_stat: formData.veteran_stat,
          num_of_kids: formData.num_of_kids,
          current_situation: formData.current_situation,
          services: formData.services,
          notes: formData.notes,
        }),
      });

      if (response.ok) {
        const saved_info = await response.json();
        alert("Client Successfully Saved!");
        // reset form
        setFormData({
          name: "",
          age: "",
          gender: "",
          veteran_stat: "",
          num_of_kids: 0,
          current_situation: "",
          services: [],
          notes: [],
        });
        setNotes({});
      } else {
        alert("ERROR: Client not created");
      }
    } catch (error) {
      alert("Something went wrong while submitting the navigator form");
      console.error("Error creating client: ", error);
    }
  };

  // function that allows updates as time goes on
  const handleAddNote = async (name) => {
    const noteToAdd = notes[name]?.trim();
    if (!noteToAdd) return;

    const client = data[name];
    const timestampedNote = `${noteToAdd}`;

    // sends post request
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          user_id: localStorage.user_id,
          note: timestampedNote,
        }),
      });

      if (!response.ok) throw new Error("Failed to add note");

      const updatedNote = await response.json();

      // update local data
      setData((prevData) => ({
        ...prevData,
        [name]: {
          ...prevData[name],
          notes: [...prevData[name].notes, updatedNote.note],
        },
      }));
      // sets up all existing client data
      setSearchResult((prevResults) =>
        prevResults
          ? prevResults.map((clientData) =>
              clientData.name === name
                ? {
                    ...clientData,
                    notes: [...clientData.notes, updatedNote.note],
                  }
                : clientData
            )
          : null
      );

      alert("Note added successfully!");
      setNotes((prevNotes) => ({
        ...prevNotes,
        [name]: "",
      }));
    } catch (error) {
      console.error("Error adding note: ", error);
      alert("Failed to add note. Please try again.");
    }
  };

  // deals with service input toggle
  const toggleService = (service) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  };

  // displays everything
  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">Navigator Form</h2>
      <div className="space-y-6">
        <h2 className="text-lg font-medium text-blue-800 mb-2">
          Search for an Individual
        </h2>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Enter Name"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <select
            className="p-2 border border-gray-300 rounded-md"
            value={filters.veteran_stat}
            onChange={(e) =>
              setFilters({ ...filters, veteran_stat: e.target.value })
            }
          >
            <option value="">All Veteran Statuses</option>
            <option value="not a veteran">Not a Veteran</option>
            <option value="active duty">Active Duty</option>
            <option value="retired">Retired</option>
          </select>

          <input
            type="number"
            min="0"
            className="p-2 border border-gray-300 rounded-md"
            placeholder="Number of Kids"
            value={filters.num_of_kids}
            onChange={(e) =>
              setFilters({ ...filters, num_of_kids: e.target.value })
            }
          ></input>
        </div>
      </div>
      {Array.isArray(searchResult) && (
        <div className="mt-6 space-y-6">
          {searchResult.map((person, index) => (
            <div
              key={index}
              className="p-4 border border-gray-300 rounded-md shadow-sm bg-gray-50"
            >
              <p>
                <strong>Name:</strong> {person.name}
              </p>
              <p>
                <strong>Age:</strong> {person.age}
              </p>
              <p>
                <strong>Gender:</strong> {person.gender}
              </p>
              <p>
                <strong>Veteran Status:</strong> {person.veteran_stat}
              </p>
              <p>
                <strong>Number of Kids:</strong> {person.num_of_kids}
              </p>
              <p>
                <strong>Services Needed:</strong>{" "}
                {Array.from(new Set(person.services)).join(", ")}
              </p>
              <p>
                <strong>Current Situation:</strong> {person.current_situation}
              </p>
              {person.notes.length > 0 && (
                <div>
                  <h3 className="font-semibold mt-2">Notes</h3>
                  <ul className="list-disc list-inside">
                    {person.notes.map((note, indx) => (
                      <li key={indx}>
                        <strong>{note.name}</strong> (
                        {new Date(note.created_at).toLocaleString()}):{" "}
                        {note.note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 bg-gray-200 rounded-lg p-4 shadow-md">
                <textarea
                  value={notes[person.name] || ""}
                  onChange={(e) =>
                    setNotes((prevNotes) => ({
                      ...prevNotes,
                      [person.name]: e.target.value,
                    }))
                  }
                  placeholder="Add a new note"
                  className="w-full p-2 border border-gray-300 rounded-md mb-2"
                />
                <button
                  onClick={() => handleAddNote(person.name)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
                >
                  Add Note
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formVisible && (
        <div className="mt-6">
          <h2 className="text-lg font-medium mb-2">Enter Information</h2>
          <div className="bg-gray-200 rounded-lg p-4 shadow-md mb-4">
            <input
              type="text"
              placeholder="Name"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div className="bg-gray-200 rounded-lg p-4 shadow-md mb-4">
            <input
              type="number"
              placeholder="Age"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={formData.age}
              onChange={(e) =>
                setFormData({ ...formData, age: e.target.value })
              }
            />
          </div>
          <div className="bg-gray-200 rounded-lg p-4 shadow-md mb-4">
            <input
              type="text"
              placeholder="Gender"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={formData.gender}
              onChange={(e) =>
                setFormData({ ...formData, gender: e.target.value })
              }
            />
          </div>
          <div className="bg-gray-200 rounded-lg p-4 shadow-md mb-4">
            <input
              type="number"
              placeholder="Number of Kids"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={formData.num_of_kids}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  num_of_kids: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="bg-gray-200 rounded-lg p-4 shadow-md mb-4">
            <input
              type="text"
              placeholder="Current Situation"
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={formData.current_situation}
              onChange={(e) =>
                setFormData({ ...formData, current_situation: e.target.value })
              }
            />
          </div>

          <div className="bg-gray-200 rounded-lg p-4 shadow-md mb-4">
            <h3 className="font-semibold mb-2">Veteran Status</h3>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg"
              value={formData.veteran_stat}
              onChange={(e) =>
                setFormData({ ...formData, veteran_stat: e.target.value })
              }
            >
              <option value="">Select Status</option>
              <option value="not a veteran">Not a Veteran</option>
              <option value="active duty">Active Duty</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          <div className="bg-gray-200 rounded-lg p-4 shadow-md mb-4">
            <h3 className="font-semibold mb-2">Services Needed</h3>
            {["food", "mental", "substance", "housing"].map((service) => (
              <label key={service} className="block">
                <input
                  type="checkbox"
                  checked={formData.services.includes(service)}
                  onChange={() => toggleService(service)}
                />{" "}
                {service.charAt(0).toUpperCase() + service.slice(1)}
              </label>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-green-600 text-white p-2 rounded-md hover:bg-green-700"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
