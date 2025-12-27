import React, { useState } from "react";
import axios from "axios";
import { FaPlus } from "react-icons/fa";
// 1. IMPORT CONFIG
import { API_URL } from "../components/Config";

const AddVideoBar = ({ room, onVideoAdded }) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

const handleAdd = async (e) => {
  e.preventDefault();
  if (!url.trim()) return;

  setLoading(true);
  try {
    // 1. Fetch Metadata from Client Side (Bypasses Server Block)
    const metaRes = await axios.get(`https://noembed.com/embed?url=${url}`);
    
    if (metaRes.data.error) {
        throw new Error("Invalid Video URL");
    }

    const title = metaRes.data.title;
    const thumbnail = metaRes.data.thumbnail_url;

    // 2. Send EVERYTHING to Backend
    await axios.post(`${API_URL}/api/videos/add/`, { 
        url, 
        room, 
        title,      // <--- Sending title
        thumbnail   // <--- Sending thumbnail
    });
    
    setUrl("");
    if (onVideoAdded) onVideoAdded();
  } catch (err) {
    alert("Failed to add video", err);
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
      <button
        type="submit"
        disabled={loading}
        className="add-video-btn"
        style={{ opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "..." : <FaPlus />}
      </button>
    </form>
  );
};

export default AddVideoBar;
