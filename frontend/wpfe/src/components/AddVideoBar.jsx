import React, { useState } from 'react'
import axios from 'axios'
import { FaPlus } from 'react-icons/fa'

const AddVideoBar = ({ room, onVideoAdded }) => {
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)

    const handleAdd = async (e) => {
        e.preventDefault()
        if (!url.trim()) return

        setLoading(true)
        try {
            // Send URL + Room to Django
            await axios.post('http://127.0.0.1:8000/api/videos/add/', { url, room })
            setUrl("")
            
            // Notify via WebSocket
            if (onVideoAdded) onVideoAdded()
            
        } catch (err) {
            console.error("Failed to add video", err)
            alert("Could not add video. Check console.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleAdd} style={{display: 'flex', gap: '10px', padding: '10px', borderBottom: '1px solid #333'}}>
            <input 
                type="text" 
                placeholder="Paste YouTube URL..." 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{
                    flex: 1, padding: '8px', borderRadius: '4px', 
                    border: '1px solid #444', background: '#222', color: 'white'
                }}
            />
            <button type="submit" disabled={loading} style={{
                background: '#22c55e', border: 'none', color: 'white', 
                padding: '0 15px', borderRadius: '4px', cursor: 'pointer',
                opacity: loading ? 0.7 : 1
            }}>
                {loading ? "..." : <FaPlus />}
            </button>
        </form>
    )
}

export default AddVideoBar