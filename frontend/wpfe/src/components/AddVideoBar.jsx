import React, { useState } from "react";
import axios from "axios";
import { FaPlus } from "react-icons/fa";
import { API_URL } from "../components/Config";

const AddVideoBar = ({ room, onVideoAdded }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    try {
      let cleanUrl = url.trim();
      try {
        const parsedUrl = new URL(cleanUrl);
        if (parsedUrl.hostname.includes("youtube.com")) {
          const v = parsedUrl.searchParams.get("v");
          if (v) cleanUrl = `https://www.youtube.com/watch?v=${v}`;
        } else if (parsedUrl.hostname.includes("youtu.be")) {
          const v = parsedUrl.pathname.slice(1);
          if (v) cleanUrl = `https://www.youtube.com/watch?v=${v}`;
        }
      } catch (err) {
        console.warn("URL parsing failed, using raw input:", err);
        cleanUrl = url.trim();
      }


      await axios.post(`${API_URL}/api/videos/add`, { 
          url: cleanUrl, 
          room,
      });
      
      setUrl("");
      if (onVideoAdded) onVideoAdded();
    } catch (err) {
      console.error("Add Video Error:", err);
      alert("Failed to add video. Please ensure the link is valid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleAdd} className="add-video-form">
      <input
        type="text"
        placeholder="Paste YouTube URL..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="add-video-input"
      />
      <button type="submit" disabled={loading} className="add-video-btn"aria-label="Add Video">
        {loading ? "..." : <FaPlus />}
      </button>
    </form>
  );
};

export default AddVideoBar;