import React from 'react'

const VideoList = ({ videos, onSelect }) => {
  return (
    <div className="playlist-section" style={{height: '40%', borderBottom: '1px solid #333'}}>
        <div className="sidebar-header">Up Next</div>
        <div className="playlist">
        {videos.map(v => (
            <div key={v.id} className="playlist-item" onClick={() => onSelect(v)}>
                <div className="item-title">{v.title}</div>
            </div>
        ))}
        </div>
    </div>
  )
}

export default VideoList