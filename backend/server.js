const express = require("express");
const cors = require("cors");
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const WebSocket = require("ws");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

app.use(cors());
app.use(express.json());

app.post("/api/auth/signup", async (req, res) => {
  const { user_id, name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (user_id, name, email, password) VALUES ($1, $2, $3, $4)",
      [user_id, name, email, hashedPassword]
    );

    // Create user profile
    await pool.query(
      "INSERT INTO profiles (user_id, bio, organization) VALUES ($1, '', '')",
      [user_id]
    );

    res.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error("Signup Error:", error);
    res
      .status(500)
      .json({ error: "Error registering user", details: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { user_id, password } = req.body;

  try {
    const user = await pool.query("SELECT * FROM users WHERE user_id = $1", [
      user_id,
    ]);

    if (
      user.rows.length === 0 ||
      !(await bcrypt.compare(password, user.rows[0].password))
    ) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ user_id: user.rows[0].user_id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    await pool.query(
      "INSERT INTO audit_logs (user_id, action) VALUES ($1, 'login')",
      [user_id]
    );

    res.json({ success: true, token });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/auth/profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const userQuery = await pool.query(
      "SELECT user_id, name FROM users WHERE user_id = $1",
      [decoded.user_id]
    );

    if (userQuery.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const profileQuery = await pool.query(
      "SELECT bio, organization FROM profiles WHERE user_id = $1",
      [decoded.user_id]
    );

    res.json({
      user: userQuery.rows[0],
      profile: profileQuery.rows.length
        ? profileQuery.rows[0]
        : { bio: "", organization: "" },
    });
  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ error: "Error retrieving profile" });
  }
});

app.get("/api/messages/inbox", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user_id = decoded.user_id;

    const messagesQuery = await pool.query(
        `SELECT id, sender, receiver, group_id, content, timestamp, is_read 
         FROM messages 
         WHERE receiver = $1 OR sender = $1 
         ORDER BY timestamp DESC`,
        [user_id]
      );
      

    res.json({ messages: messagesQuery.rows || [] });
  } catch (error) {
    console.error("Inbox Fetch Error:", error);
    res.status(500).json({ messages: [] });
  }
});

app.get("/api/messages/sent", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user_id = decoded.user_id;

    const sentMessagesQuery = await pool.query(
      "SELECT id, receiver, content, timestamp FROM messages WHERE sender = $1 ORDER BY timestamp DESC",
      [user_id]
    );

    res.json({ messages: sentMessagesQuery.rows || [] });
  } catch (error) {
    console.error("Sent Messages Fetch Error:", error);
    res.status(500).json({ messages: [] });
  }
});

app.get("/api/messages/waiting-for-reply", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user_id = decoded.user_id;

    const waitingForReplyQuery = await pool.query(
      `SELECT m1.id, m1.receiver, m1.content, m1.timestamp 
       FROM messages m1
       WHERE m1.sender = $1 
       AND NOT EXISTS (
         SELECT 1 FROM messages m2 
         WHERE m2.sender = m1.receiver 
         AND m2.receiver = m1.sender 
         AND m2.timestamp > m1.timestamp
       )
       ORDER BY m1.timestamp DESC`,
      [user_id]
    );

    res.json({ messages: waitingForReplyQuery.rows || [] });
  } catch (error) {
    console.error("Waiting for Reply Fetch Error:", error);
    res.status(500).json({ messages: [] });
  }
});

app.post("/api/messages", async (req, res) => {
    const { sender, receiver, content } = req.body;
  
    if (!sender || !receiver || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }
  
    try {
      const result = await pool.query(
        `INSERT INTO messages (sender, receiver, content, timestamp)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [sender, receiver, content]
      );
  
      res.json(result.rows[0]);  // ✅ return the inserted message
    } catch (err) {
      console.error("Failed to send message:", err);
      res.status(500).json({ error: "Server error" });
    }
  });  

app.delete("/api/messages/delete/:message_id", async (req, res) => {
  const { message_id } = req.params;

  try {
    await pool.query("DELETE FROM messages WHERE id = $1", [message_id]);
    res.json({ success: true, message: "Message deleted successfully!" });
  } catch (error) {
    console.error("Delete Message Error:", error);
    res.status(500).json({ error: "Error deleting message" });
  }
});

app.get("/api/users/search", async (req, res) => {
  const { query } = req.query;

  try {
    const result = await pool.query(
      "SELECT user_id, name FROM users WHERE user_id ILIKE $1 OR name ILIKE $1 LIMIT 10",
      [`%${query}%`]
    );

    res.json({ users: result.rows || [] });
  } catch (error) {
    console.error("User Search Error:", error);
    res.status(500).json({ error: "Error searching for users" });
  }
});

app.get("/api/users/rolesearch", async (req, res) => {
    const { role } = req.query;

    try {
    const result = await pool.query(
        `SELECT DISTINCT u.user_id, u.name, u.email
        FROM users u
        JOIN organization_members om ON u.user_id = om.user_id
        WHERE om.role = $1`,
        [role]
        );
  
      res.json({ users: result.rows || [] });
    } catch (error) {
      console.error("User Search Error:", error);
      res.status(500).json({ error: "Error searching for users" });
    }
  });

  app.get("/api/roles", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT role FROM organization_members`
      );
      const roles = result.rows.map((row) => row.role);
      res.json({ roles });
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

app.get("/api/groups/name/:groupName", async (req, res) => {
    const groupName = req.params.groupName;
  
    try {
      const result = await pool.query(
        "SELECT id, name FROM groups WHERE name = $1",
        [groupName]
      );
  
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: "Group not found" });
      }
    } catch (err) {
      console.error("Error checking for existing group:", err);
      res.status(500).json({ error: "Server error" });
    }
  });  

  app.get("/api/messages/group/:group_id", async (req, res) => {
    const groupId = req.params.group_id;
    try {
      const result = await pool.query(
        "SELECT * FROM messages WHERE group_id = $1 ORDER BY timestamp",
        [groupId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Error fetching group messages:", err);
      res.status(500).send("Internal server error");
    }
  });
  
  app.post("/api/messages/group", async (req, res) => {
    const { sender, content, group_id } = req.body;
  
    if (!sender || !content || !group_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }
  
    try {
      const result = await pool.query(
        `INSERT INTO messages (sender, group_id, content, timestamp)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [sender, group_id, content]
      );
  
      res.json(result.rows[0]);  // ✅ return the inserted message
    } catch (err) {
      console.error("Failed to send group message:", err);
      res.status(500).json({ error: "Server error" });
    }
  });
  

  app.get("/api/users/me/groups", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
  
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const result = await pool.query(
        `SELECT g.id, g.name FROM groups g
         JOIN group_members gm ON g.id = gm.group_id
         WHERE gm.user_id = $1`,
        [decoded.user_id]
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to get groups" });
    }
  });  

  app.post("/api/groups", async (req, res) => {
    const { name, members } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);  
      const result = await pool.query(
        "INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING id",
        [name, decoded.user_id]
      );
  
      const groupId = result.rows[0].id;
  
      for (const member of members) {
        await pool.query(
          "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [groupId, member.user_id]
        );
      }
  
      res.json({ id: groupId });
    } catch (err) {
        console.error("❌ Group creation failed:", err.message, err.stack);
        res.status(500).json({ error: "Group creation failed" });
    }      
  });  

app.put("/api/groups/:id/members", async (req, res) => {
    const groupId = req.params.id;
    const { members } = req.body;
  
    try {
      // First, delete all existing members
      await pool.query("DELETE FROM group_members WHERE group_id = $1", [groupId]);
  
      // Then, re-insert the new members
      for (const member of members) {
        await pool.query(
          "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [groupId, member.user_id]
        );
      }
  
      res.json({ message: "Group members updated" });
    } catch (err) {
      console.error("❌ Failed to update group members:", err);
      res.status(500).json({ error: "Failed to update group members" });
    }
  });  

app.post("/api/organizations", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, description } = req.body;

    const orgResult = await pool.query(
      "INSERT INTO organizations (name, description, created_by) VALUES ($1, $2, $3) RETURNING id",
      [name, description || "", decoded.user_id]
    );

    const orgId = orgResult.rows[0].id;

    await pool.query(
      "INSERT INTO organization_members (user_id, org_id, role) VALUES ($1, $2, 'admin')",
      [decoded.user_id, orgId]
    );

    res.json({ success: true, org_id: orgId });
  } catch (error) {
    console.error("Org Create Error:", error);
    res.status(500).json({ error: "Error creating organization" });
  }
});

app.get("/api/messages/unread-count", async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "Unauthorized" });

        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.user_id;
  
      // Count unread individual messages
      const indRes = await pool.query(
        `SELECT COUNT(*) FROM messages
         WHERE receiver = $1 AND is_read = false`,
        [userId]
      );
  
      // Get group IDs the user is in
      const groupRes = await pool.query(
        `SELECT group_id FROM group_members WHERE user_id = $1`,
        [userId]
      );
      const groupIds = groupRes.rows.map((r) => r.group_id);
  
      let groupCount = 0;
      if (groupIds.length > 0) {
        const placeholders = groupIds.map((_, i) => `$${i + 2}`).join(", ");
        const groupMsgRes = await pool.query(
          `SELECT COUNT(*) FROM messages
           WHERE group_id IN (${placeholders})
           AND sender <> $1 AND is_read = false`,
          [userId, ...groupIds]
        );
        groupCount = parseInt(groupMsgRes.rows[0].count, 10);
      }
  
      const individualCount = parseInt(indRes.rows[0].count, 10);
      res.json({ count: individualCount + groupCount });
  
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });  

app.put("/api/messages/:id/read", async (req, res) => {
  try {
    const result = await pool.query("UPDATE messages SET is_read = TRUE WHERE id = $1", [
        req.params.id,
      ]);
      
    res.json({ success: true });
  } catch (err) {
    console.error("Mark as read error:", err);
    res.status(500).json({ error: "Failed to update message" });
  }
});

app.get("/api/organizations", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await pool.query(
      `SELECT o.id, o.name, o.description, o.created_by, m.role
       FROM organizations o
       JOIN organization_members m ON o.id = m.org_id
       WHERE m.user_id = $1`,
      [decoded.user_id]
    );

    res.json({ organizations: result.rows });
  } catch (error) {
    console.error("Org Fetch Error:", error);
    res.status(500).json({ error: "Error fetching organizations" });
  }
});

app.get("/api/organizations/:id/members", async (req, res) => {
  try {
    const { id } = req.params;

    const members = await pool.query(
      `SELECT u.user_id, u.name, m.role
       FROM organization_members m
       JOIN users u ON u.user_id = m.user_id
       WHERE m.org_id = $1`,
      [id]
    );

    res.json({ members: members.rows });
  } catch (error) {
    console.error("Org Members Error:", error);
    res.status(500).json({ error: "Error fetching members" });
  }
});

app.post("/api/organizations/:id/add", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const orgId = req.params.id;
    const { target_user_id, role } = req.body;

    // Check if requester is admin
    const adminCheck = await pool.query(
      `SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2`,
      [decoded.user_id, orgId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Only admins can add users" });
    }

    await pool.query(
      `INSERT INTO organization_members (user_id, org_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role`,
      [target_user_id, orgId, role || "member"]
    );

    res.json({ success: true, message: "User added to organization" });
  } catch (error) {
    console.error("Add Member Error:", error);
    res.status(500).json({ error: "Error adding member to org" });
  }
});

app.get("/api/organizations/all", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description FROM organizations ORDER BY created_at DESC"
    );
    res.json({ organizations: result.rows });
  } catch (err) {
    console.error("Get All Orgs Error:", err);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

app.post("/api/organizations/:id/request", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const orgId = req.params.id;

    await pool.query(
      `INSERT INTO join_requests (user_id, org_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, org_id) DO NOTHING`,
      [decoded.user_id, orgId]
    );

    res.json({ success: true, message: "Request sent." });
  } catch (err) {
    console.error("Join Request Error:", err);
    res.status(500).json({ error: "Could not request to join." });
  }
});

app.get("/api/organizations/:id/requests", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const orgId = req.params.id;

    const adminCheck = await pool.query(
      `SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2`,
      [decoded.user_id, orgId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== "admin") {
      return res
        .status(403)
        .json({ error: "Only admins can view join requests" });
    }

    const result = await pool.query(
      `SELECT jr.id, jr.user_id, u.name, jr.status, jr.requested_at
       FROM join_requests jr
       JOIN users u ON jr.user_id = u.user_id
       WHERE jr.org_id = $1 AND jr.status = 'pending'`,
      [orgId]
    );

    res.json({ requests: result.rows });
  } catch (err) {
    console.error("Fetch Join Requests Error:", err);
    res.status(500).json({ error: "Failed to get join requests" });
  }
});

app.put("/api/auth/profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { bio } = req.body;

    await pool.query("UPDATE profiles SET bio = $1 WHERE user_id = $2", [
      bio,
      decoded.user_id,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error("Profile Update Error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

app.post("/api/requests/:id/approve", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const requestId = req.params.id;

    const request = await pool.query(
      "SELECT * FROM join_requests WHERE id = $1",
      [requestId]
    );

    if (request.rows.length === 0)
      return res.status(404).json({ error: "Request not found" });

    const { user_id, org_id } = request.rows[0];

    // Check admin
    const adminCheck = await pool.query(
      `SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2`,
      [decoded.user_id, org_id]
    );

    if (adminCheck.rows[0]?.role !== "admin") {
      return res.status(403).json({ error: "Only admins can approve" });
    }

    await pool.query(
      `UPDATE join_requests SET status = 'approved' WHERE id = $1`,
      [requestId]
    );

    await pool.query(
      `INSERT INTO organization_members (user_id, org_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (user_id, org_id) DO NOTHING`,
      [user_id, org_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Approve Request Error:", err);
    res.status(500).json({ error: "Could not approve request" });
  }
});

app.post("/api/requests/:id/reject", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const requestId = req.params.id;

    const request = await pool.query(
      "SELECT * FROM join_requests WHERE id = $1",
      [requestId]
    );
    if (request.rows.length === 0)
      return res.status(404).json({ error: "Request not found" });

    const { org_id } = request.rows[0];

    const adminCheck = await pool.query(
      `SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2`,
      [decoded.user_id, org_id]
    );

    if (adminCheck.rows[0]?.role !== "admin") {
      return res.status(403).json({ error: "Only admins can reject" });
    }

    await pool.query(
      `UPDATE join_requests SET status = 'rejected' WHERE id = $1`,
      [requestId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Reject Request Error:", err);
    res.status(500).json({ error: "Could not reject request" });
  }
});

// Update member role
app.post("/api/organizations/:id/members/:userId/role", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { role } = req.body;

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const orgId = req.params.id;
    const userId = req.params.userId;

    const adminCheck = await pool.query(
      "SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2",
      [decoded.user_id, orgId]
    );
    if (!adminCheck.rows.length || adminCheck.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Only admins can update roles" });
    }

    await pool.query(
      "UPDATE organization_members SET role = $1 WHERE user_id = $2 AND org_id = $3",
      [role, userId, orgId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Role update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/organizations/:orgId/members/:userId", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Get the token
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Decode the token
    const orgId = req.params.orgId;
    const userIdToRemove = req.params.userId;

    // Check if the requesting user is an admin in the organization
    const adminCheck = await pool.query(
      "SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2",
      [decoded.user_id, orgId]
    );

    if (!adminCheck.rows.length || adminCheck.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Only admins can remove members" });
    }

    // Now proceed to delete the user from the organization
    await pool.query(
      "DELETE FROM organization_members WHERE user_id = $1 AND org_id = $2",
      [userIdToRemove, orgId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error removing member:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/organizations/:id/members/:userId/role", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { role } = req.body;

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const orgId = req.params.id;
    const userId = req.params.userId;

    const adminCheck = await pool.query(
      "SELECT role FROM organization_members WHERE user_id = $1 AND org_id = $2",
      [decoded.user_id, orgId]
    );

    if (!adminCheck.rows.length || adminCheck.rows[0].role !== "admin") {
      return res.status(403).json({ error: "Only admins can update roles" });
    }

    await pool.query(
      "UPDATE organization_members SET role = $1 WHERE user_id = $2 AND org_id = $3",
      [role, userId, orgId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Role update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/clients", async (req, res) => {
  try {
    // query clients table
    const foundClient = await pool.query("SELECT * FROM clients");

    const clientServices = await Promise.all(
      foundClient.rows.map(async (client) => {
        // query client services
        const services = await pool.query(
          `SELECT s.name FROM referrals r JOIN services s ON r.service_id = s.id WHERE r.client_id = $1`,
          [client.id]
        );

        // query client notes
        const clientNotes = await pool.query(
          `SELECT n.note, n.created_at, u.name FROM notes n JOIN users u ON n.user_id = u.user_id WHERE n.client_id = $1`,
          [client.id]
        );

        return {
          ...client,
          services: services.rows.map((service) => service.name),
          clientNotes: clientNotes.rows,
        };
      })
    );

    res.json({ clients: clientServices });
  } catch (error) {
    console.error("Fetch Clients Error: ", error);
    res
      .status(500)
      .json({ error: "Failed to fetch clients", details: error.message });
  }
});

app.post("/api/clients", async (req, res) => {
  // defining loaded body
  const {
    name,
    age,
    gender,
    veteran_stat,
    num_of_kids,
    current_situation,
    services,
    notes,
    location_id,
  } = req.body;

  // referencing to mapping
  const locationId = location_id === "" ? null : location_id;
  // since the search bar doesn't have two seperate fields for full name
  const [first_name, last_name] = name.split(" ");

  try {
    // query for clients info
    const result = await pool.query(
      `INSERT INTO clients (first_name, last_name, age, gender, veteran_stat, num_children, current_situation, location_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        first_name,
        last_name,
        age,
        gender,
        veteran_stat,
        num_of_kids,
        current_situation,
        locationId,
      ]
    );

    const client_id = result.rows[0].id;
    // map the services they request
    if (services && services.length > 0) {
      await Promise.all(
        services.map(async (service) => {
          await pool.query(
            `INSERT INTO referrals (client_id, service_id) SELECT $1, id FROM services WHERE name = $2`,
            [client_id, service]
          );
        })
      );
    }
    // adding notes
    if (notes && notes.length > 0) {
      await Promise.all(
        notes.map(async (note) => {
          await pool.query(
            `INSERT INTO notes(client_id, user_id, created_at) VALUES ($1, $2, $3, NOW())`,
            [client_id, 1]
          );
        })
      );
    }

    res.status(201).json({ message: "Client created successfully", client_id });
  } catch (error) {
    res.status(500).json({ error: "Error creating user" });
    console.error("Error creating new client: ", error);
  }
});

app.get("/api/locations", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, c.first_name, c.last_name FROM locations l JOIN clients c ON l.client_id = c.id`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).send("Error fetching locations");
    console.error(error);
  }
});

app.post("/api/locations", async (req, res) => {
  const { latitude, longitude, client_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO locations (latitude, longitude, client_id, timestamp) 
      VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [latitude, longitude, client_id]
    );

    // just realized why the location ids are null
    // i never updated the locations at all
    const newLocation = result.rows[0].id;

    await pool.query(`UPDATE clients SET location_id = $1 WHERE id = $2`, [
      newLocation,
      client_id,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).send("Error adding location");
    console.error(error);
  }
});

app.get("/api/referrals", async (req, res) => {
  const { client_id, orgId, status } = req.query;

  // query all referral info
  let query = `SELECT r.*, 
         s.name AS service_name, 
         c.first_name, 
         c.last_name, 
         o.name AS organization_name
  FROM referrals r
  JOIN services s ON r.service_id = s.id
  JOIN clients c ON r.client_id = c.id
  JOIN organizations o ON r.org_id = o.id
  WHERE (r.client_id = COALESCE($1, r.client_id)) 
    AND (r.org_id = COALESCE($2, r.org_id)) 
    AND (r.status = COALESCE($3, r.status))`;

  const idenfication = [client_id, orgId, status];

  try {
    const results = await pool.query(query, idenfication);
    res.json(results.rows);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to retrieve referrals", details: error.message });
  }
});

app.post("/api/referrals", async (req, res) => {
  const { client_id, orgId, status, created_at } = req.body;

  // proof of referral
  console.log("REFERRAL Load: ", req.body);

  try {
    // should probably refactor the database structure
    // had to find the service id manually :(
    const services = await pool.query(
      `SELECT service_id FROM organization_services WHERE org_id = $1 LIMIT 1`,
      [orgId]
    );

    const service_id = services.rows[0]?.service_id;

    if (!service_id) {
      return res
        .status(400)
        .json({ error: "No service found for this this organization" });
    }
    // submitting a referral
    await pool.query(
      `INSERT INTO referrals (client_id, org_id, service_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [client_id, orgId, service_id, status, created_at]
    );

    res.status(201).json({ message: "Referral added successfully." });
  } catch (error) {
    console.error("Error submitting referral:", error);
    res
      .status(500)
      .json({ error: "Error adding referral", details: error.message });
  }
});

app.post("/api/match-services", async (req, res) => {
  const { age, gender, service } = req.body;

  try {
    // an ugly query where it works with the frontend to utilize matching logic
    const matching = await pool.query(
      `SELECT DISTINCT o.*, r.age_range, r.gender, r.available_beds, r.notes, s.name as service_name
      FROM organizations o
      JOIN restrictions r ON o.id = r.organization_id
      JOIN organization_services os ON o.id = os.org_id
      JOIN services s ON os.service_id = s.id
      WHERE ($1 = 'any' OR r.age_range = $1 OR r.age_range = 'any')
        AND ($2 = 'any' OR r.gender = $2 OR r.gender = 'any')
        AND ($3 = 'any' OR s.name = $3)
        AND r.available_beds > 0`,
      [age, gender, service]
    );

    res.json({ matches: matching.rows });
  } catch (error) {
    console.error("Service Match Error: ", error);
    res.status(500).json({ error: "Error matching services with client" });
  }
});

// in order for the services to be matched with client, service restrictions have to be considered
app.get("/api/restrictions", async (req, res) => {
  try {
    // query the restrictions table
    const restrictions = await pool.query(`
      SELECT r.*, o.name AS organization_name
      FROM restrictions r
      JOIN organizations o ON r.organization_id = o.id`);

    res.json(restrictions.rows);
  } catch (error) {
    console.error("Error fetching restrictions: ", error);
    res.status(500).json({ error: "Failed to fetch restrictions" });
  }
});

app.post("/api/notes", async (req, res) => {
  const { client_id, note, user_id } = req.body; // notice added user_id

  try {
    const result = await pool.query(
      `INSERT INTO notes (client_id, user_id, note, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [client_id, user_id, note] // also added user_id in parameters
    );
    res.json({ note: result.rows[0] });
  } catch (err) {
    console.error("Error inserting note:", err);
    res.status(500).send("Error inserting note");
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`)
);
// TO DO: please develop an API for this
