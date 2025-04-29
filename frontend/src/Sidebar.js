import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./styles.css";

const Sidebar = () => {
  const navigate = useNavigate();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const token = localStorage.getItem("token");

        // Relative path so Nginx can forward to backend
        const unreadRes = await axios.get("/api/messages/unread-count", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUnreadCount(unreadRes.data.count);

        const orgRes = await axios.get("/api/organizations", {
          headers: { Authorization: `Bearer ${token}` },
        });

        let totalPending = 0;
        for (const org of orgRes.data.organizations) {
          if (org.role === "admin") {
            const r = await axios.get(`/api/organizations/${org.id}/requests`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            totalPending += r.data.requests.length;
          }
        }

        setPendingRequests(totalPending);
      } catch (err) {
        console.error("Sidebar badge fetch error:", err);
      }
    };

    fetchCounts();
  }, []);

  return (
    <aside className="sidebar">
      <h2>Menu</h2>
      <button className="nav-item" onClick={() => navigate("/")}>
        Home
      </button>
      <button className="nav-item" onClick={() => navigate("/profile")}>
        Profile
      </button>
      <button className="nav-item" onClick={() => navigate("/messages")}>
        Messages{" "}
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      <button className="nav-item" onClick={() => navigate("/people")}>
        People & Organizations
        {pendingRequests > 0 && (
          <span className="badge">{pendingRequests}</span>
        )}
      </button>
      <button className="nav-item" onClick={() => navigate("/join-orgs")}>
        Join Organizations
      </button>

      <h2>Navigation</h2>
      <button className="nav-item" onClick={() => navigate("/nav-form")}>
        Navigation Form
      </button>
      <button className="nav-item" onClick={() => navigate("/mapping")}>
        Mapping
      </button>
      <button className="nav-item" onClick={() => navigate("/service-match")}>
        Service Matching
      </button>
      <h2></h2>
      <button
        className="nav-item"
        onClick={() => {
          localStorage.clear();
          navigate("/login");
        }}
      >
        Log Out
      </button>
    </aside>
  );
};

export default Sidebar;
