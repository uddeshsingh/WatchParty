import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

// --- CRITICAL: MUST START WITH 'export const' ---
export const useWatchParty = () => {
  const [room, setRoom] = useState(null)
  const [username, setUsername] = useState(null)
  const [isHost, setIsHost] = useState(false)
  const [userList, setUserList] = useState([])
  const [messages, setMessages] = useState([])
  const [myID, setMyID] = useState(null)
  
  const [videos, setVideos] = useState([])
  const [currentVideo, setCurrentVideo] = useState(null)
  const [playing, setPlaying] = useState(false)

  const playerRef = useRef(null)
  const ws = useRef(null)
  const isHostRef = useRef(false)
  
  const isReady = useRef(false)
  const pendingSync = useRef(null)
  const remoteState = useRef(null)

  // Helper to seek the player safely
  const playerSeekTo = (timestamp) => {
    if (playerRef.current && playerRef.current.seekTo) {
        playerRef.current.seekTo(timestamp, 'seconds')
    }
  }

  const handleServerMessage = (msg) => {
    // SEEK (Existing logic is fine)
    if (msg.type === 'seek' || msg.type === 'sync_state') {
        remoteState.current = 'seek'
        if (!isReady.current) {
            pendingSync.current = { time: msg.timestamp, playing: msg.content === 'playing' }
        } else {
            playerSeekTo(msg.timestamp)
            if (msg.type === 'sync_state') setPlaying(msg.content === 'playing')
        }
    }

    // PLAY (The Fix: Check for drift)
    if (msg.type === 'play') {
        remoteState.current = 'play'
        
        // 1. Get current client time
        const currentTime = playerRef.current ? playerRef.current.getCurrentTime() : 0
        
        // 2. If we are off by more than 1 second, JUMP to host time
        if (Math.abs(currentTime - msg.timestamp) > 1.0) {
            console.log(`🕰️ Syncing drift: Jumping from ${currentTime} to ${msg.timestamp}`)
            playerSeekTo(msg.timestamp)
        }
        
        setPlaying(true)
    }

    // PAUSE (The Fix: Snap to exact time)
    if (msg.type === 'pause') {
        remoteState.current = 'pause'
        
        // Always snap to the exact pause time so everyone sees the same frame
        playerSeekTo(msg.timestamp)
        
        setPlaying(false)
    }
  }

  // --- HANDLERS FOR PLAYER EVENTS ---
  // These receive the TIME from the VideoPlayer component
  const onPlay = (timeFromPlayer) => {
    if (remoteState.current === 'play') {
        remoteState.current = null
        return
    }
    const t = typeof timeFromPlayer === 'number' ? timeFromPlayer : 0
    if (isHostRef.current) sendSignal('play', t)
  }

  const onPause = (timeFromPlayer) => {
    if (remoteState.current === 'pause') {
        remoteState.current = null
        return
    }
    const t = typeof timeFromPlayer === 'number' ? timeFromPlayer : 0
    if (isHostRef.current) sendSignal('pause', t)
  }

  const onSeek = (seconds) => {
    if (!isReady.current) return
    if (remoteState.current === 'seek') {
        remoteState.current = null
        return
    }
    if (isHostRef.current) sendSignal('seek', seconds)
  }

  const onReady = () => {
    isReady.current = true
    if (pendingSync.current) {
        console.log("Applying Startup Sync")
        remoteState.current = 'seek'
        playerSeekTo(pendingSync.current.time)
        setPlaying(pendingSync.current.playing)
        pendingSync.current = null
    }
  }

  const sendSignal = (type, payload = null) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return
    
    // Payload is ALWAYS the timestamp
    const timestamp = payload !== null ? payload : 0

    console.log(`📡 SENDING ${type} at ${timestamp.toFixed(2)}s`)

    ws.current.send(JSON.stringify({ 
        type, username, timestamp, 
        video_id: currentVideo ? currentVideo.id : 0 
    }))
  }

  // --- CONNECTION SETUP ---
  useEffect(() => {
    axios.get('http://localhost:8000/api/videos/')
      .then(res => {
        setVideos(res.data)
        if (res.data.length > 0) setCurrentVideo(res.data[0])
      })
      .catch(err => console.error(err))

    if (!room || !username) return

    ws.current = new WebSocket(`ws://localhost:8080/ws?room=${room}&username=${username}`)
    
    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'identity') {
          setMyID(msg.user_id)
          setIsHost(msg.is_host)
          isHostRef.current = msg.is_host
      }
      if (msg.type === 'user_list') setUserList(msg.user_list)
      if (msg.type === 'chat' || msg.type === 'system') setMessages(prev => [...prev, msg])
      if (['play', 'pause', 'seek', 'sync_state'].includes(msg.type)) handleServerMessage(msg)
    }
    return () => { if (ws.current) ws.current.close() }
  }, [room, username])

  const sendMessage = (text) => ws.current.send(JSON.stringify({ type: "chat", username, content: text }))
  const toggleHost = (targetID, status) => ws.current.send(JSON.stringify({ type: status ? "revoke_control" : "grant_control", content: targetID }))

  return {
    room, setRoom, username, setUsername, isHost, userList, myID, messages,
    videos, currentVideo, setCurrentVideo, playing,
    playerRef, 
    onReady, onPlay, onPause, onSeek, 
    sendMessage, toggleHost
  }
}