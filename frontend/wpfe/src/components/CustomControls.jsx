import React from 'react'
import { FaVolumeUp, FaVolumeMute, FaExpand } from 'react-icons/fa'

const CustomControls = ({ 
  playing, 
  played, 
  duration, 
  volume, 
  onVolumeChange, 
  onToggleFullscreen,
}) => {
  
  const formatTime = (seconds) => {
    if (!seconds) return "00:00"
    const date = new Date(seconds * 1000)
    const hh = date.getUTCHours()
    const mm = date.getUTCMinutes()
    const ss = date.getUTCSeconds().toString().padStart(2, "0")
    if (hh) return `${hh}:${mm.toString().padStart(2, "0")}:${ss}`
    return `${mm}:${ss}`
  }

  return (
    <div className="custom-controls">
      {/* 1. STATUS TEXT (Left) */}
      <div className="controls-left" style={{flex: 1}}>
        <span style={{color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic'}}>
            {playing ? "▶ Now Playing" : "⏸ Paused by Host"}
        </span>
        <span className="time-text" style={{marginLeft: '15px', color: '#666'}}>
            {formatTime(played * duration)} / {formatTime(duration)}
        </span>
      </div>

      {/* 2. VOLUME & FULLSCREEN (Right) */}
      <div className="controls-right">
        <div className="volume-container">
            <button className="btn-control">
                {volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>
            <input 
                type="range" 
                min={0} max={1} step="0.1"
                value={volume}
                onChange={onVolumeChange}
                className="volume-slider"
            />
        </div>
        
        <button onClick={onToggleFullscreen} className="btn-control">
            <FaExpand />
        </button>
      </div>
    </div>
  )
}

export default CustomControls