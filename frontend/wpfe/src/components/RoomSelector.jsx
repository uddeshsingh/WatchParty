import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaDoorOpen, FaFilm, FaUserFriends, FaSignOutAlt } from "react-icons/fa";
import { WS_URL, API_URL } from "./Config";

const RoomSelector = ({ onJoin, onLogout, username }) => {
  const [rooms, setRooms] = useState([]);
  const [newRoom, setNewRoom] = useState("");
  const [loading, setLoading] = useState(true);

  // Derive standard HTTP URL from the WS URL
  const GO_API_URL = WS_URL.replace("ws", "http").replace("wss", "https");

  const fetchRooms = async () => {
    try {
      // 1. Fetch live room state from Go Redis
      const res = await axios.get(`${GO_API_URL}/rooms`);
      const activeRooms = res.data || [];

      // 2. Extract active video IDs to fetch metadata from Python Postgres
      const videoIds = activeRooms
        .map((r) => r.video_id)
        .filter((id) => id > 0);

      if (videoIds.length > 0) {
        const metaRes = await axios.post(`${API_URL}/api/videos/metadata`, {
          video_ids: videoIds,
        });
        const metadata = metaRes.data;

        // 3. Merge metadata with the active rooms
        const enrichedRooms = activeRooms.map((room) => {
          const videoInfo = metadata.find((v) => v.id === room.video_id);
          return { ...room, videoTitle: videoInfo ? videoInfo.title : "Idle" };
        });
        setRooms(enrichedRooms);
      } else {
        setRooms(activeRooms);
      }
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

    onJoin(cleanName, "create");
  };

  return (
    <div className="lobby-overlay">
      <div className="lobby-container">
        {(onLogout || username) && (
          <div className="lobby-top-bar">
            {username ? (
              <span className="lobby-user-label">Signed in as {username}</span>
            ) : (
              <span />
            )}
            {onLogout && (
              <button
                type="button"
                className="lobby-logout-btn"
                onClick={onLogout}
              >
                <FaSignOutAlt aria-hidden /> Log out
              </button>
            )}
          </div>
        )}
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
              <div
                key={r.name}
                className="room-card"
                onClick={() => onJoin(r.name, "join")}
              >
                <div className="room-card-icon">
                  <FaDoorOpen />
                </div>
                <div className="room-card-name">{r.name}</div>
                
                {/* Cleaned up metadata container */}
                <div className="room-card-meta">
                  <FaFilm style={{flexShrink: 0}} /> 
                  <span className="meta-text">{r.videoTitle || 'Idle'}</span>
                </div>

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
