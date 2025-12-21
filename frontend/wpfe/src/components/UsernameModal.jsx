import { useState } from 'react'

const UsernameModal = ({ onJoin }) => {
  const [name, setName] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    if (name.trim()) onJoin(name)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Join WatchParty</h2>
        <form onSubmit={handleSubmit}>
            <input 
              autoFocus
              type="text" 
              placeholder="Enter your nickname..." 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="modal-input"
            />
            <button type="submit" className="modal-btn">Join Room</button>
        </form>
      </div>
      
      {/* Quick CSS for this component */}
      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: #222; padding: 2rem; borderRadius: 8px; text-align: center; color: white; border: 1px solid #444; }
        .modal-input { padding: 10px; border-radius: 4px; border: none; margin-bottom: 10px; width: 100%; box-sizing: border-box; }
        .modal-btn { background: #8b5cf6; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; width: 100%; }
      `}</style>
    </div>
  )
}

export default UsernameModal