// imports
import React, { useState, useEffect } from "react";
import axios from "axios";
import Layout from "./Layout";
import "./styles.css";

const Messages = () => {
    // variables
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [replyMessages, setReplyMessages] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);

    const [roleSearchQuery, setRoleSearchQuery] = useState("");
    const [roleSearchResults, setRoleSearchResults] = useState([]);

    const [selectedUser, setSelectedUser] = useState(null);
    const [newMessage, setNewMessage] = useState("");
    const [error, setError] = useState("");
    const [threads, setThreads] = useState([]);
    const [messageMode, setMessageMode] = useState("individual");
    const [searchMode, setSearchMode] = useState("user");

    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("user_id");

    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupSearchQuery, setGroupSearchQuery] = useState("");
    const [groupSearchResults, setGroupSearchResults] = useState([]);

    const [newGroupName, setNewGroupName] = useState("");
    const [groupMap, setGroupMap] = useState({});

    const [availableRoles, setAvailableRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState("");

    // use effect function
    useEffect(() => {
        // fetch which roles are currently in the database
        const fetchRoles = async () => {
            try {
                const res = await fetch("/api/roles");
                const data = await res.json();
            setAvailableRoles(data.roles || []);
            } catch (err) {
                console.error("Failed to load roles:", err);
            }
        };

        // fetch all users with a certain role
        const fetchUsersByRole = async () => {
            if (!selectedRole) return;

            try {
                const res = await fetch(`/api/users/rolesearch?role=${selectedRole}`);
                const data = await res.json();
                setRoleSearchResults(data.users || []);
            } catch (err) {
                console.error("Failed to fetch users by role:", err);
            } 
        } // TODO figure out why there isn't a ';' here

        // call functions
        fetchUsersByRole();
        fetchRoles();
        fetchMessages();

    }, [selectedRole]);

    // function to fetch messages
    const fetchMessages = async () => {
        // get user id and token
        const userId = localStorage.getItem("user_id");
        const token = localStorage.getItem("token");

        try {
            // get inidviual message threads
            const individualRes = await axios.get("/messages/inbox", {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const individualMessages = individualRes.data.messages;

            // fetch group info (id + name)
            const groupRes = await axios.get("/api/users/me/groups", {
                headers: { Authorization: `Bearer ${token}` }
            });

            const groups = groupRes.data;

            // save group_id → name mapping
            const groupMapTemp = {};
            groups.forEach(group => {
                groupMapTemp[`group-${group.id}`] = group.name;
            });

            // set group map
            setGroupMap(groupMapTemp);

            // fetch messages from each group
            const groupMessages = [];
            for (const group of groups) {
                const res = await axios.get(`/messages/group/${group.id}`);
                groupMessages.push(...res.data);
            }

            // get all messages for a particular user
            const allMessages = [...individualMessages, ...groupMessages];
            const groupedThreads = {};

            // console.log("💬 All messages fetched:", allMessages.map(m => ({
            //     id: m.id,
            //     sender: m.sender,
            //     is_read: m.is_read
            // })));      

            // group messages into proper threads
            allMessages.forEach((msg) => {
                const key = msg.group_id
                ? `group-${msg.group_id}`
                : msg.sender === userId
                    ? msg.receiver
                    : msg.sender;
                if (!groupedThreads[key]) groupedThreads[key] = [];

                // create new thread if needed
                if (!groupedThreads[key].some(existing => existing.id === msg.id)) {
                    groupedThreads[key].push(msg);
                }
            });

            // create message threads
            const threadList = Object.entries(groupedThreads).map(([threadId, messages]) => {
                const total = messages.length;
                const unread = messages.filter((msg) => !msg.is_read && msg.sender !== userId).length;
            
                //console.log(`🧵 ${threadId} → ${total} total, ${unread} unread`);
            
                return {
                userId: threadId,
                messages: messages
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                    .map((msg) => ({
                    ...msg,
                    direction: msg.sender === userId ? "sent" : "inbox"
                    })),
                isOpen: false,
                unreadCount: unread
                };
            });      

            setThreads(threadList);

            // console.log("🧵 Threads:", threadList.map(t => ({
            //     userId: t.userId,
            //     messageCount: t.messages.length
            // })));
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    // handle search by name
    const handleSearch = async (query) => {
        setSearchQuery(query);
        setError("");

        if (query.length > 2) {
        try {
            const response = await axios.get(`/api/users/search?query=${query}`);
            setSearchResults(response.data.users);
        } catch (error) {
            console.error("Error searching users:", error);
        }
        } else {
            setSearchResults([]);
        }
    };

// const fetchGroupMessages = async (group_id) => {
//     try {
//     const res = await axios.get(`/messages/group/${group_id}`);
//     return res.data;
//     } catch (err) {
//     console.error("Failed to fetch group messages:", err);
//     return [];
//     }
// };  

// const handleRoleSearch = async (query) => {
//     //console.log("Searching roles for:", query); // <--- Add this

//     setRoleSearchQuery(query);
//     setError("");

//     if (query.length > 2) {
//     try {
//         const response = await axios.get(`/api/users/rolesearch?role=${query}`);
//         setRoleSearchResults(response.data.users);
//     } catch (error) {
//         console.error("Error searching users:", error);
//     }
//     } else {
//     setRoleSearchResults([]);
//     }
// };

    // select users to send to 
    const handleUserSelect = (user) => {
        if (messageMode === "group") {
        if (!selectedUsers.some((u) => u.user_id === user.user_id)) {
            setSelectedUsers((prev) => [...prev, user]);
        }
        setGroupSearchQuery("");
        setGroupSearchResults([]);
        } else if (messageMode === "individual" || messageMode === "role") {
        setSelectedUser(user);
        setSearchQuery(user.name);  // works for both name and role
        setRoleSearchQuery("");     // clear role search field too
        setSearchResults([]);
        setRoleSearchResults([]);
        setError("");
        }
    };  

// const selectUserForMessage = (user) => {
//     if (messageMode === "group") {
//         if (!selectedUsers.some((u) => u.user_id === user.user_id)) {
//             setSelectedUsers((prev) => [...prev, user]);
//         }          
//     setGroupSearchQuery("");
//     setGroupSearchResults([]);
//     } else {
//     setSelectedUser(user);
//     setSearchQuery(user.name);
//     setSearchResults([]);
//     setError("");
//     }
// };  

// const selectRoleUserForMessage = (user) => {
//     setSelectedUser(user);
//     setRoleSearchQuery(user.name);
//     setRoleSearchResults([]);
//     setError("");
// };

    // function to handle sending messages
    const sendMessage = async ({ contentOverride = null, targetUserId = null, targetGroupId = null } = {}) => {
        // console.log("📤 Sending message — mode:", messageMode);

        // make sure there is content in the message body
        const content = (contentOverride || newMessage || "").trim();
        if (!content) {
        setError("Message cannot be empty.");
        return;
        }

        const sender = userId;

        // CASE 1: Reply to an existing group
        if (targetGroupId) {
            try {
                await axios.post("/messages/group", {
                sender,
                content,
                group_id: targetGroupId
                });

                await fetchMessages();  // refresh from server

                if (contentOverride) {
                setReplyMessages((prev) => ({ ...prev, [`group-${targetGroupId}`]: "" }));
                } else {
                setNewMessage("");
                setSelectedUser(null);
                }

                return;
            } catch (err) {
                console.error("❌ Failed to send group reply:", err);
                setError("Could not send group reply.");
                return;
            }
        }

        // CASE 2: Sending message to everyone with the same role
        if (messageMode === "role") {
            const role = selectedRole;
            if (!role) {
            setError("Please select a role.");
            return;
            }
        
            // group name is role(s)
            const groupName = role.charAt(0).toUpperCase() + role.slice(1) + "s";
            let group_id = null;
        
            // STEP 1: Try to get the group by name
            try {
            const res = await axios.get(`/api/groups/name/${groupName}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            group_id = res.data?.id;

            } catch (err) {
                if (err.response?.status === 404) {
                    //console.log("Group not found, will create it.");
                    group_id = null;
                } else {
                    console.error("❌ Failed to check existing group:", err);
                    setError("Something went wrong checking group existence.");
                    return;
                }
            }
        
            // STEP 2: Fetch users with this role
            try {
            const userRes = await axios.get(`/api/users/rolesearch?role=${role}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
        
            let members = userRes.data.users || [];
        
            // Always include the sender
            if (!members.some(u => u.user_id === userId)) {
                members.push({ user_id: userId });
            }
        
            // STEP 3: Reuse or create group
            if (group_id) {
                await axios.put(`/api/groups/${group_id}/members`, {
                members
                }, {
                headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                const groupRes = await axios.post("/api/groups", {
                name: groupName,
                members
                }, {
                headers: { Authorization: `Bearer ${token}` }
                });
                group_id = groupRes.data.id;
            }
        
            // STEP 4: Send message to group
            await axios.post("/messages/group", {
                sender: userId,
                content,
                group_id
            });
        
            // reload from database
            await fetchMessages();
        
            if (contentOverride) {
                setReplyMessages((prev) => ({ ...prev, [`group-${group_id}`]: "" }));
            } else {
                setNewMessage("");
                setSelectedUser(null);
                setSelectedRole("");
                setRoleSearchResults([]);
            }
        
            return;
            } catch (err) {
                console.error("❌ Failed to send role-based message:", err);
                setError("Could not send role-based message.");
                return;
            }
        }      

        // CASE 3: Custom group message
        if (messageMode === "group") {
            const members = [...selectedUsers];
            if (!members.some(u => u.user_id === userId)) {
                members.push({ user_id: userId });
            }

            const groupName = newGroupName;
            if (!groupName.trim()) {
                setError("Please enter a group name.");
                return;
            }

            try {
                const groupRes = await axios.post("/api/groups", {
                name: groupName,
                members
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const group_id = groupRes.data.id;

                await axios.post("/messages/group", {
                    sender,
                    content,
                    group_id
                });

                await fetchMessages();  // 🔄 refresh from server

                if (contentOverride) {
                    setReplyMessages((prev) => ({ ...prev, [`group-${group_id}`]: "" }));
                } else {
                    setNewMessage("");
                    setSelectedUser(null);
                    setSelectedUsers([]); // ← THIS is the missing reset!
                }

                return;
            } catch (err) {
                console.error("❌ Failed to send group message:", err);
                setError("Could not send group message.");
                return;
            }
        }

        // CASE 4: Individual message
        const receiver = targetUserId || selectedUser?.user_id;
        if (!receiver) {
        setError("No recipient selected for individual message.");
        return;
        }

        try {
        await axios.post("/messages", {
            sender,
            receiver,
            content
        });

        await fetchMessages();  // refresh from server

        if (contentOverride) {
            setReplyMessages((prev) => ({ ...prev, [receiver]: "" }));
        } else {
            setNewMessage("");
            setSelectedUser(null);
        }
        } catch (err) {
            console.error("❌ Failed to send individual message:", err);
            setError("Could not send individual message.");
        }
    };  

    // delete message from database
    const deleteMessage = async (id) => {
        try {
        await axios.delete(`/api/messages/delete/${id}`);

        // Remove message from threads state
        const updatedThreads = threads
            .map((thread) => {
            return {
                ...thread,
                messages: thread.messages.filter((m) => m.id !== id),
            };
            })
            .filter((thread) => thread.messages.length > 0); // Optionally remove empty threads

        setThreads(updatedThreads);
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Failed to delete message");
        }
    };

    // archive message
    const archiveMessage = async (id) => {
        try {
        await axios.put(
            `/api/messages/archive/${id}`,
            {},
            {
            headers: { Authorization: `Bearer ${token}` },
            }
        );

        // Remove archived message from threads
        const updatedThreads = threads
            .map((thread) => {
            return {
                ...thread,
                messages: thread.messages.filter((m) => m.id !== id),
            };
            })
            .filter((thread) => thread.messages.length > 0); // Clean up empty threads

        setThreads(updatedThreads);
        } catch (err) {
            console.error("Failed to archive message:", err);
            alert("Failed to archive message");
        }
    };

    // mark message as read
    const markMessageAsRead = async (messageId) => {
        try {
        await fetch(`/api/messages/${messageId}/read`, {
            method: "PUT"
        });
        } catch (error) {
        console.error("Failed to mark message as read:", error);
        }
    };  

    // return UI layout
    return (
    <Layout>
        {/*UI Layout*/}
        {/*Section for sending new messages*/}
        <div className="message-input-container">
        <h3>Send a Message</h3>
        <div className="message-mode-selector" style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="message-mode" style={{ marginRight: "0.5rem" }}>
            Send to:
        </label>

        {/*Set message mode - individual, role, group*/}
        <select
        id="message-mode"
        value={messageMode}
        onChange={(e) => setMessageMode(e.target.value)}
        >
        <option value="individual">Individual</option>
        <option value="role">Role</option>
        <option value="group">Custom Group</option>
        </select>
        </div>
        {error && <p className="error-message">{error}</p>}

        {/*Send message to individual*/}
        {messageMode === "individual" && (        
        <div className="search-by-user">
            <div className="search-mode-selector" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="message-mode" style={{ marginRight: "0.5rem" }}>
                    Search by: 
                </label>
                <select
                id="search-mode"
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value)}
                >
                <option value="user">User</option>
                <option value="role">Role</option>
                </select>
            </div>
            {/*Search users by role or user*/}
            {searchMode === "user" && (
                <div className="search-by-user">
                    <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    />
                    {searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults
                    .filter((user) => user.user_id !== userId) // Don't allow adding yourself
                    .map((user) => (
                        <p key={user.user_id} onClick={() => handleUserSelect(user)}>
                        {user.name} (@{user.user_id})
                        </p>
                    ))}
                        </div>
                    )}
                </div>
            )}
            {searchMode === "role" && (
                <div className="search-by-role">
                    <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    >
                        <option value="">-- Select a role --</option>
                        {availableRoles.map((role) => (
                            <option key={role} value={role}>
                            {role}
                            </option>
                        ))}
                    </select>
                    <div className="role-search-results">
                        <ul>
                            {roleSearchResults.map((user) => (
                            <li
                            key={user.user_id}
                            onClick={() => handleUserSelect(user)}
                            style={{
                            cursor: "pointer",
                            fontWeight: selectedUsers.some((u) => u.user_id === user.user_id) ? "bold" : "normal",
                            backgroundColor: selectedUsers.some((u) => u.user_id === user.user_id)
                                ? "#e0f7fa"
                                : "transparent",
                            padding: "4px",
                            borderRadius: "4px",
                            }}
                            >
                                {user.name} ({user.email})
                            </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )} 
            {selectedUser && (
                <div className="selected-user-display">
                    <strong>Selected:</strong> {selectedUser.name} (@{selectedUser.user_id})
                    <button onClick={() => setSelectedUser(null)} style={{ marginLeft: "0.5rem" }}>
                    ❌
                    </button>
                </div>
            )}
        </div>
        )}

        {/*Send message by role - only search by role*/}
        {messageMode === "role" && (
            <div className="search-by-role">
                <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                >
                    <option value="">-- Select a role --</option>
                    {availableRoles.map((role) => (
                        <option key={role} value={role}>
                        {role}
                        </option>
                    ))}
                </select>

                {/*Display results*/}
                <ul>
                    {roleSearchResults.map((user) => (
                        <li key={user.user_id}>
                        {user.name} ({user.email})
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {/*Send group message*/}
        {messageMode === "group" && (
            <div className="search-by-group" style={{ marginBottom: "1rem" }}>
                <div style={{ marginBottom: "0.5rem" }}>
                    <label htmlFor="group-name" style={{ marginRight: "0.5rem" }}>
                        Group Name:
                    </label>
                    <input
                        type="text"
                        id="group-name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Enter group name"
                        style={{ padding: "0.25rem", width: "60%" }}
                    />
                </div>
                <div className="search-mode-selector" style={{ marginBottom: "0.5rem" }}>
                    <label htmlFor="message-mode" style={{ marginRight: "0.5rem" }}>
                        Search by: 
                    </label>
                    {/*Search users by role or user*/}
                    <select
                    id="search-mode"
                    value={searchMode}
                    onChange={(e) => setSearchMode(e.target.value)}
                    >
                        <option value="user">User</option>
                        <option value="role">Role</option>
                    </select>
                </div>
                {searchMode === "user" && (
                    <div className="search-by-user">
                        <input
                        type="text"
                        placeholder="Search users to add..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        />
                        {searchResults.length > 0 && (
                            <div className="search-results">
                                {searchResults.map((user) => (
                                <p key={user.user_id} onClick={() => handleUserSelect(user)}>
                                    {user.name} (@{user.user_id})
                                </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {searchMode === "role" && (
                    <div className="search-by-role">
                        <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        >
                            <option value="">-- Select a role --</option>
                            {availableRoles.map((role) => (
                                <option key={role} value={role}>
                                {role}
                                </option>
                            ))}
                        </select>
                        <div className="role-search-results">
                            <ul>
                                {roleSearchResults.map((user) => (
                                    <li
                                        key={user.user_id}
                                        onClick={() => handleUserSelect(user)}
                                        style={{
                                        cursor: "pointer",
                                        fontWeight: selectedUsers.some((u) => u.user_id === user.user_id) ? "bold" : "normal",
                                        backgroundColor: selectedUsers.some((u) => u.user_id === user.user_id)
                                            ? "#e0f7fa"
                                            : "transparent",
                                        padding: "4px",
                                        borderRadius: "4px",
                                        }}
                                    >
                                        {user.name} ({user.email})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
                {groupSearchResults.length > 0 && (
                    <div className="search-results">
                        {groupSearchResults.map((user) => (
                        <p
                            key={user.user_id}
                            onClick={() => {
                            if (!selectedUsers.includes(user.user_id)) {
                                setSelectedUsers([...selectedUsers, user.user_id]);
                            }
                                setGroupSearchQuery("");
                                setGroupSearchResults([]);
                            }}
                            style={{ cursor: "pointer" }}
                        >
                            {user.name} (@{user.user_id})
                        </p>
                        ))}
                    </div>
                )}

                {selectedUsers.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                        <strong>Selected Users:</strong>
                        <ul>
                            {selectedUsers.map((user) => (
                                <li key={user.user_id}>
                                {user.name} (@{user.user_id})
                                <button onClick={() =>
                                setSelectedUsers(selectedUsers.filter((u) => u.user_id !== user.user_id))}>
                                ❌
                                </button>
                                </li>
                                )
                            )}
                        </ul>
                    </div>
                )}
            </div>
        
        )}
        <div className="comm-method-selector">
            <label htmlFor="method">Method: </label>
            <select
                value="message"
                onChange={(e) => {
                if (e.target.value !== "message") {
                    alert(`Sorry, "${e.target.value}" is not currently supported.`);
                }
                }}
            >
                <option value="message">Message</option>
                <option value="text">Text Message</option>
                <option value="email">Email</option>
            </select>
        </div>
        <textarea
        placeholder="Type your message..."
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        />
        <button onClick={sendMessage}>Send</button>
    </div>
    {/*Container for exsiting message threads*/}
    <hr style={{ marginTop: "1rem", marginBottom: "1rem", borderColor: "#ccc" }} />
    {
        <div className="threads-container">
        {threads.map((thread, index) => {
            const isGroup = thread.userId.startsWith("group-");
            return (
            <div key={index} className="thread-block">
            <div
                className="thread-header"
                onClick={async () => {
                    const updated = [...threads];
                    updated[index].isOpen = !updated[index].isOpen;
                    setThreads(updated);
                
                    // If opening thread, mark unread messages as read
                    if (updated[index].isOpen) {
                    const unreadMessages = threads[index].messages.filter(
                        (msg) => msg.direction === "inbox" && !msg.is_read
                    );
                
                    for (const msg of unreadMessages) {
                        try {
                        await axios.put(`/api/messages/${msg.id}/read`, {}, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                    
                        // Update it locally
                        const target = updated[index].messages.find(m => m.id === msg.id);
                        if (target) target.is_read = true;
                    
                        updated[index].unreadCount -= 1;
                        } catch (err) {
                        console.error("Failed to mark message as read:", err);
                        }
                    }                      
                    }
                }}                  
            >
                <strong>Conversation with:</strong>{" "}
                {thread.userId.startsWith("group-")
                ? groupMap[thread.userId] || "Unnamed Group"
                : thread.userId}
                {thread.unreadCount > 0 && (
                <span className="unread-badge"> {thread.unreadCount} new </span>
                )}

                <span style={{ fontSize: "0.8rem", color: "#555" }}>
                ({thread.messages.length} message
                {thread.messages.length !== 1 ? "s" : ""})
                </span>
            </div>

            {thread.isOpen && (
                <>
                <div className="thread-messages">
                    {thread.messages.map((msg) => {
                        if (msg.direction === "inbox" && !msg.is_read) {
                            markMessageAsRead(msg.id);
                        }

                        return(
                    <div
                        key={msg.id}
                        className={`bubble-message ${
                        msg.direction === "sent"
                            ? "sent-bubble"
                            : "received-bubble"
                        }`}
                    >
                        <div className="bubble-meta">
                            {msg.direction === "inbox" && (
                                <>
                                From: {msg.sender}
                                <br />
                                </>
                            )}
                            <span className="bubble-timestamp">
                                {new Date(msg.timestamp).toLocaleString()}
                            </span>
                        </div>
                        <div className="bubble-content">
                            {isGroup && (
                                <div className="bubble-sender" style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                                {msg.sender}
                                </div>
                            )}

                            {msg.content}
                        </div>

                        <div className="bubble-actions">
                            <button onClick={() => deleteMessage(msg.id)}>
                                🗑️
                            </button>
                            {msg.direction === "inbox" && (
                                <>
                                <button onClick={() => archiveMessage(msg.id)}>
                                    📥 Archive
                                </button>
                                </>
                            )}
                        </div>
                    </div>
                    )})}
                </div>

                {/* reply box always at bottom of thread */}
                <div className="reply-box-below-thread">
                    <textarea
                    placeholder={`Reply to ${thread.userId}...`}
                    value={replyMessages[thread.userId] || ""}
                    onChange={(e) =>
                        setReplyMessages((prev) => ({
                        ...prev,
                        [thread.userId]: e.target.value,
                        }))
                    }
                    />
                    <button
                        onClick={() => {
                            const replyContent = replyMessages[thread.userId];
                            const isGroup = thread.userId.startsWith("group-");

                            if (isGroup) {
                                const groupId = parseInt(thread.userId.split("-")[1], 10);
                                sendMessage({
                                    contentOverride: replyContent,
                                    targetGroupId: groupId
                                });
                            } else {
                                sendMessage({
                                    contentOverride: replyContent,
                                    targetUserId: thread.userId
                                });
                            }

                            setSelectedUsers([]);
                            setNewMessage("");
                        }}
                        >
                        Reply
                    </button>
                </div>
                </>
            )}
            </div>
            );
            })}
        </div>
    }
    {selectedMessage && (
        <div className="message-action-container">
        <h3>Reply to {selectedMessage.sender}</h3>
        <p>{selectedMessage.content}</p>
        <textarea
        placeholder="Type your reply..."
        value={replyMessages[selectedMessage.sender] || ""}
        onChange={(e) =>
            setReplyMessages((prev) => ({
            ...prev,
            [selectedMessage.sender]: e.target.value,
            }))
        }
        />
        <button onClick={sendMessage}>Send Reply</button>
        <button onClick={() => setSelectedMessage(null)}>Cancel</button>
    </div>      
    )}

    </Layout>
    );
};

export default Messages;
