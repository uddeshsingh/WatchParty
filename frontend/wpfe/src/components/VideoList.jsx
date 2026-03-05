import React from 'react'
import { FaTrash } from 'react-icons/fa'

const VideoList = ({ videos, onSelect, isHost, onDelete }) => {
  return (
    <div className="playlist-section">
        <div className="sidebar-header">Up Next</div>
        <div className="playlist-scroll">
        {videos.map(v => (
            <div key={v.id} className="playlist-item" onClick={() => onSelect(v)}>
                <div className="item-title" title={v.title}>{v.title}</div>
                {/* 🗑️ Delete Button */}
                {isHost && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(v.id); }}
                        className="delete-btn" 
                        title="Remove Video"
                    >
                        <FaTrash size={12} />
                    </button>
                )}
            </div>
        ))}
        </div>
    </div>
  )
}

export default VideoList