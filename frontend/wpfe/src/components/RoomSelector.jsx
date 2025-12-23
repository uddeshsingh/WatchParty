import React, { useState } from 'react'

const RoomSelector = ({ onJoin }) => {
  const [room, setRoom] = useState("general")

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Choose a Room</h2>
        <p className="modal-desc">Enter a room name to join a private party.</p>
        
        <input 
          type="text" 
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="e.g. movie-night"
          className="input-field"
          style={{marginBottom: '15px', width: '100%', boxSizing: 'border-box'}}
        />
        
        <button onClick={() => onJoin(room)} className="btn-primary" style={{width: '100%'}}>
          Enter Room
        </button>
      </div>
    </div>
  )
}

export default RoomSelector