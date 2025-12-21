import React, { useState } from 'react'

const RoomSelector = ({ onJoin }) => {
  const [room, setRoom] = useState("general")

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Choose a Room</h2>
        <p style={{color: '#aaa', marginBottom: '20px'}}>Enter a room name to join a private party.</p>
        
        <input 
          type="text" 
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="e.g. movie-night"
          className="modal-input"
        />
        
        <button onClick={() => onJoin(room)} className="modal-btn">
          Enter Room
        </button>
      </div>
      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #111; display: flex; justify-content: center; align-items: center; z-index: 2000; }
        .modal-content { background: #222; padding: 2rem; border-radius: 8px; border: 1px solid #444; width: 300px; text-align: center; color: white; }
        .modal-input { width: 100%; padding: 10px; margin-bottom: 15px; border-radius: 4px; border: none; background: #333; color: white; box-sizing: border-box;}
        .modal-btn { width: 100%; padding: 10px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
        .modal-btn:hover { background: #7c3aed; }
      `}</style>
    </div>
  )
}

export default RoomSelector