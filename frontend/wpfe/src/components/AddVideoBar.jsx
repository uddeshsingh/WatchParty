import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaSearch } from "react-icons/fa";
import { API_URL } from "../components/Config";

const AddVideoBar = ({ room, onVideoAdded }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.includes("http")) {
      setResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        // Free, open-source YouTube search API
        const res = await axios.get(`https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}`);
        setResults(res.data.slice(0, 5)); // Top 5 results
      } catch (err) {
        console.error("Search failed", err);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleAdd = async (videoUrl) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/videos/add`, { url: videoUrl, room });
      setQuery("");
      setResults([]);
      if (onVideoAdded) onVideoAdded();
    } catch (err) {
      alert("Failed to add video.", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-video-container" style={{ position: "relative" }}>
      <form onSubmit={(e) => { e.preventDefault(); if(query.includes("http")) handleAdd(query); }} className="add-video-form">
        <input
          type="text"
          placeholder="Search YouTube or paste URL..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="add-video-input"
        />
        <button type="submit" disabled={loading} className="add-video-btn">
          {loading ? "..." : (query.includes("http") ? <FaPlus /> : <FaSearch />)}
        </button>
      </form>

      {/* Dropdown Results */}
      {results.length > 0 && (
        <div className="search-results-dropdown" style={{ position: "absolute", top: "100%", width: "100%", background: "#1a1a1a", zIndex: 100, borderRadius: "4px" }}>
          {results.map((v) => (
            <div 
              key={v.videoId} 
              onClick={() => handleAdd(`https://www.youtube.com/watch?v=${v.videoId}`)}
              style={{ padding: "10px", borderBottom: "1px solid #333", cursor: "pointer", display: "flex", gap: "10px" }}
            >
              <img src={v.videoThumbnails[0]?.url} alt="" width="50" style={{ borderRadius: "4px" }} />
              <div style={{ fontSize: "0.85rem", color: "white" }}>{v.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddVideoBar;