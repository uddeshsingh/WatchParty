import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaDoorOpen, FaFilm, FaUserFriends, FaSignOutAlt } from "react-icons/fa";
import { WS_URL, API_URL } from "./Config";
import TrendingCarousel from "./TrendingCarousel";

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

    onJoin(cleanName, "create", undefined);
  };

  return (
    <div className="lobby-overlay">
      <div className="lobby-backdrop" aria-hidden />
      <div className="lobby-container">
        {(onLogout || username) && (
          <header className="lobby-top-bar">
            {username ? (
              <span className="lobby-user-pill">
                <span className="lobby-user-dot" aria-hidden />
                <span className="lobby-user-label">{username}</span>
              </span>
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
          </header>
        )}

        <div className="lobby-hero">
          <p className="lobby-eyebrow">Watch together</p>
          <h1 className="lobby-title">WatchParty</h1>
          <p className="lobby-subtitle">
            Pick a trending title, spin up a room, or join a live party.
          </p>
        </div>

        <section className="lobby-section" aria-labelledby="lobby-discover-heading">
          <div className="lobby-section-head">
            <h2 id="lobby-discover-heading" className="lobby-section-title">
              Jump in
            </h2>
            <p className="lobby-section-desc">
              Start a room preloaded with a trending pick from TMDB.
            </p>
          </div>
          <div className="lobby-panel lobby-panel--discover">
            <TrendingCarousel
              onPickTmdb={({ slug, preload }) => onJoin(slug, "create", preload)}
            />
          </div>
        </section>

        <section className="lobby-section" aria-labelledby="lobby-create-heading">
          <div className="lobby-section-head">
            <h2 id="lobby-create-heading" className="lobby-section-title">
              Start a room
            </h2>
            <p className="lobby-section-desc">
              Name it anything you like—friends join with the same slug.
            </p>
          </div>
          <div className="lobby-panel lobby-panel--create">
            <form onSubmit={handleCreate} className="create-room-form">
              <input
                type="text"
                placeholder="e.g. friday-movie-night"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                className="create-input"
                aria-label="New room name"
              />
              <button type="submit" className="create-btn">
                <FaPlus aria-hidden /> Create
              </button>
            </form>
          </div>
        </section>

        <section className="lobby-section" aria-labelledby="lobby-live-heading">
          <div className="lobby-section-head lobby-section-head--inline">
            <h2 id="lobby-live-heading" className="lobby-section-title">
              Live parties
            </h2>
            <span className="lobby-live-count">{rooms.length} active</span>
          </div>

          {loading ? (
            <div className="lobby-skeleton-grid" aria-busy="true" aria-label="Loading rooms">
              {[1, 2, 3].map((k) => (
                <div key={k} className="lobby-skeleton-card">
                  <div className="lobby-skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : (
            <div className="room-grid">
              {rooms.length === 0 && (
                <div className="no-rooms">
                  <FaDoorOpen className="no-rooms-icon" aria-hidden />
                  <p>No one is live yet—create a room and invite friends.</p>
                </div>
              )}

              {rooms.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  className="room-card"
                  onClick={() => onJoin(r.name, "join", undefined)}
                >
                  <div className="room-card-icon">
                    <FaDoorOpen aria-hidden />
                  </div>
                  <div className="room-card-name">{r.name}</div>
                  <div className="room-card-meta">
                    <FaFilm aria-hidden className="room-card-meta-icon" />
                    <span className="meta-text">{r.videoTitle || "Idle"}</span>
                  </div>
                  <div className="room-card-stats">
                    <FaUserFriends aria-hidden />
                    <span>
                      {r.count} {r.count === 1 ? "viewer" : "viewers"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default RoomSelector;
