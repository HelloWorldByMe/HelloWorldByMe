import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./styles.css";

const Home = () => {
  const [userName, setUserName] = useState("");
  const [userOrganizations, setUserOrganizations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchData = async () => {
      try {
        const profileRes = await axios.get("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserName(profileRes.data.user.name);

        const orgRes = await axios.get("/api/organizations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserOrganizations(orgRes.data.organizations || []);
      } catch (err) {
        console.error("Fetch failed:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) return <div>Loading...</div>;

  return (
    <Layout>
      <div className="main-title">Welcome, {userName}!</div>

      {userOrganizations.length === 0 ? (
        <div>
          <p>You are not part of any organizations.</p>
          <button onClick={() => navigate("/join-orgs")}>
            Go to Organizations
          </button>
        </div>
      ) : (
        <div>
          <h3>Your Organizations</h3>
          <div>
            {userOrganizations.map((org) => (
              <div
                key={org.id}
                className="org-card"
                onClick={() => navigate(`/organizations/${org.id}`)}
              >
                <div className="org-card-title">{org.name}</div>
                {org.role && (
                  <div className="org-card-meta">Role: {org.role}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Home;
