import React, { useState } from "react";
import axios from "axios";
import { FaBell, FaTimes, FaPlus } from "react-icons/fa";
import { API_URL } from "./Config";

const RecommendationPanel = ({
  room,
  recommendations,
  onDismiss,
  onVideoAdded,
}) => {
  const [open, setOpen] = useState(false);

  const accept = async (rec) => {
    const d = rec.data || {};
    const thumb = d.poster || undefined;
    const body = {
      room,
      tmdb_id: d.tmdb_id,
      media_type: d.media_type,
      title: d.title,
      thumbnail: thumb,
      ...(d.media_type === "tv"
        ? { season: d.season ?? 1, episode: d.episode ?? 1 }
        : {}),
    };
    try {
      await axios.post(`${API_URL}/api/videos/add`, body);
      onDismiss(rec.id);
      if (onVideoAdded) onVideoAdded();
    } catch (err) {
      const detail = err.response?.data?.detail;
      alert(
        typeof detail === "string"
          ? detail
          : "Could not add recommendation to queue.",
      );
    }
  };

  if (recommendations.length === 0 && !open) {
    return null;
  }

  return (
    <div className="recommendation-panel">
      <button
        type="button"
        className="recommendation-toggle"
        onClick={() => setOpen((o) => !o)}
        title="Video recommendations"
      >
        <FaBell />
        {recommendations.length > 0 && (
          <span className="recommendation-badge">{recommendations.length}</span>
        )}
      </button>
      {open && recommendations.length > 0 && (
        <div className="recommendation-list">
          {recommendations.map((rec) => (
            <div key={rec.id} className="recommendation-card">
              <button
                type="button"
                className="recommendation-dismiss"
                onClick={() => onDismiss(rec.id)}
                aria-label="Dismiss"
              >
                <FaTimes />
              </button>
              {rec.data?.poster ? (
                <img src={rec.data.poster} alt="" className="rec-poster" />
              ) : null}
              <div className="rec-body">
                <div className="rec-from">From {rec.from}</div>
                <div className="rec-title">{rec.data?.title || "Suggestion"}</div>
                <button
                  type="button"
                  className="rec-accept"
                  onClick={() => accept(rec)}
                >
                  <FaPlus /> Add to queue
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecommendationPanel;
