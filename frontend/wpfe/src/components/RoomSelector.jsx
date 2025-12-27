import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaUserFriends, FaDoorOpen } from "react-icons/fa";
import { WS_URL } from "./Config";

const RoomSelector = ({ onJoin }) => {
  const [rooms, setRooms] = useState([]);
  const [newRoom, setNewRoom] = useState("");
  const [loading, setLoading] = useState(true);

  const GO_API_URL = WS_URL.replace("ws", "http");

  const fetchRooms = async () => {
    try {
      const res = await axios.get(`${GO_API_URL}/rooms`);
      setRooms(res.data || []);
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newRoom.trim()) return;
    const cleanName = newRoom.trim().replace(/\s+/g, "-").toLowerCase();

    if (rooms.find((r) => r.name === cleanName)) {
      alert("Room Name Taken! Please join the existing room.");
      return;
    }

    // --- FIX 1: PASS "create" HERE ---
    onJoin(cleanName, "create");
  };

  return (
    <div className="lobby-overlay">
      <div className="lobby-container">
        <h1 className="lobby-title">Welcome to WatchParty</h1>
        <p className="lobby-subtitle">Join an active room or start your own.</p>

        <div className="create-room-section">
          <form onSubmit={handleCreate} className="create-room-form">
            <input
              type="text"
              placeholder="Create new room name..."
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              className="create-input"
            />
            <button type="submit" className="create-btn">
              <FaPlus /> Create
            </button>
          </form>
        </div>

        <div className="room-grid-label">Active Rooms ({rooms.length})</div>

        {loading ? (
          <div className="loading-spinner">Loading rooms...</div>
        ) : (
          <div className="room-grid">
            {rooms.length === 0 && (
              <div className="no-rooms">No active parties. Be the first!</div>
            )}

            {rooms.map((r) => (
              // --- FIX 2: PASS "join" HERE ---
              <div
                key={r.name}
                className="room-card"
                onClick={() => onJoin(r.name, "join")}
              >
                <div className="room-card-icon">
                  <FaDoorOpen />
                </div>
                <div className="room-card-name">{r.name}</div>
                <div className="room-card-stats">
                  <FaUserFriends /> {r.count}{" "}
                  {r.count === 1 ? "Viewer" : "Viewers"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomSelector;
