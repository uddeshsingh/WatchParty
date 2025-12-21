import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { FaFilm } from 'react-icons/fa'
import './App.css'

import VideoPlayer from './components/VideoPlayer'
import ChatSidebar from './components/ChatSidebar'
import VideoList from './components/VideoList'
import UsernameModal from './components/UsernameModal'
import RoomSelector from './components/RoomSelector'

function App() {
  const [username, setUsername] = useState(null)
  const [room, setRoom] = useState(null)

  const [videos, setVideos] = useState([])
  const [currentVideo, setCurrentVideo] = useState(null)
  const [messages, setMessages] = useState([])
  const [playing, setPlaying] = useState(false)
  
  const playerRef = useRef(null)
  const ws = useRef(null)
  const isRemoteUpdate = useRef(false) 
  const currentTimeRef = useRef(0)

  // --- HELPERS (Same as before) ---
  const playerSeekTo = (timestamp) => {
    const p = playerRef.current
    if (!p) return
    if (p.api && typeof p.api.seekTo === 'function') p.api.seekTo(timestamp)
    else if (typeof p.seekTo === 'function') p.seekTo(timestamp)
    else if (typeof p.currentTime === 'number') p.currentTime = timestamp
  }

  const getPlayerTime = () => {
    const p = playerRef.current
    if (!p) return 0
    if (p.api && typeof p.api.getCurrentTime === 'function') return p.api.getCurrentTime()
    if (typeof p.getCurrentTime === 'function') return p.getCurrentTime()
    if (typeof p.currentTime === 'number') return p.currentTime
    return 0
  }

  // 1. INITIAL SETUP (Triggered only when Room is selected)
  useEffect(() => {
    if (!room) return // Don't connect until we have a room

    // Fetch Videos
    axios.get('http://localhost:8000/api/videos/')
      .then(res => {
        setVideos(res.data)
        if (res.data.length > 0) setCurrentVideo(res.data[0])
      })
      .catch(err => console.error(err))

    // CONNECT WITH ROOM ID
    // We pass the room as a query parameter
    ws.current = new WebSocket(`ws://localhost:8080/ws?room=${room}`)
    
    ws.current.onopen = () => console.log(`✅ Connected to Room: ${room}`)
    
    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      
      if (msg.type === 'chat') {
        setMessages(prev => [...prev, msg])
      }

      // --- NEW: HANDLE LATE JOIN ---
      if (msg.type === 'sync_state') {
        console.log("🔄 Syncing to Room State:", msg)
        
        // 1. Seek to the correct time
        playerSeekTo(msg.timestamp)
        
        // 2. Set Play/Pause status
        if (msg.content === 'playing') {
           setPlaying(true)
        } else {
           setPlaying(false)
        }
        return // Don't do anything else for this message
      }

      // --- STANDARD SYNC ---
      if (['play', 'pause', 'seek'].includes(msg.type)) {
        isRemoteUpdate.current = true
        setTimeout(() => { isRemoteUpdate.current = false }, 1000)

        if (msg.type === 'play') {
          setPlaying(true)
          if (Math.abs(getPlayerTime() - msg.timestamp) > 1.0) playerSeekTo(msg.timestamp)
        } 
        else if (msg.type === 'pause') {
          setPlaying(false)
          playerSeekTo(msg.timestamp)
        }
        else if (msg.type === 'seek') {
          playerSeekTo(msg.timestamp)
        }
      }
    }

    return () => {
      if (ws.current) ws.current.close()
    }
  }, [room]) // Re-run if room changes

  const handleVideoSignal = (type) => {
    if (isRemoteUpdate.current) return
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return

    const timestamp = getPlayerTime()
    ws.current.send(JSON.stringify({
      type: type,
      username: username,
      content: `${username} performed ${type}`,
      timestamp: timestamp,
      video_id: currentVideo ? currentVideo.id : 0,
      room: room // Send room ID (optional, redundant as server knows it, but good for debug)
    }))
  }

  const handleSendMessage = (text) => {
    ws.current.send(JSON.stringify({
        type: "chat", 
        username: username, 
        content: text, 
        timestamp: 0, 
        video_id: currentVideo ? currentVideo.id : 0,
        room: room
    }))
  }

  return (
    <div className="app-container">
      {/* 1. ASK FOR ROOM */}
      {!room && <RoomSelector onJoin={(r) => setRoom(r)} />}
      
      {/* 2. ASK FOR NAME (Only after room is picked) */}
      {room && !username && <UsernameModal onJoin={(name) => setUsername(name)} />}

      <nav className="navbar">
        <div className="logo"><FaFilm /> <span>WatchParty</span></div>
        <div className="nav-info">
            {room && <span className="room-badge">🏠 Room: {room}</span>}
            {username && <div className="user-badge">👤 {username}</div>}
        </div>
      </nav>

      <main className="main-content">
        <section className="video-stage">
          <div className="player-container">
             <VideoPlayer 
                ref={playerRef} 
                url={currentVideo?.video_url}
                playing={playing}
                onSignal={handleVideoSignal}
                onProgressUpdate={(p) => { currentTimeRef.current = p.playedSeconds }}
                isRemoteUpdate={isRemoteUpdate} 
             />
          </div>
          <div className="video-info">
            <h1>{currentVideo?.title || "Select a video"}</h1>
            <div className="video-meta"><span className="live-badge">● Live Sync</span></div>
          </div>
        </section>

        <aside className="sidebar">
          <VideoList videos={videos} onSelect={setCurrentVideo} />
          <ChatSidebar messages={messages} onSendMessage={handleSendMessage} />
        </aside>
      </main>
    </div>
  )
}

export default App