import { useState, useEffect, useRef } from "react";
import axios from "axios";

export const useWatchParty = () => {
  const [room, setRoom] = useState(null);
  const [username, setUsername] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [userList, setUserList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [myID, setMyID] = useState(null);

  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [playing, setPlaying] = useState(false);

  const playerRef = useRef(null);
  const ws = useRef(null);
  const isHostRef = useRef(false);

  const isReady = useRef(false);
  const pendingSync = useRef(null);
  const remoteState = useRef(null);

  // --- HELPER: Seek Player ---
  const playerSeekTo = (timestamp) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(timestamp, "seconds");
    }
  };

  // --- HELPER: Send WebSocket Notification ---
  const sendNotification = (type) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, username, room }));
    }
  };

  // --- HELPER: Change Video (Host Only) ---
  const changeVideo = (videoId) => {
    if (ws.current && isHostRef.current) {
      ws.current.send(
        JSON.stringify({
          type: "change_video",
          username,
          video_id: videoId,
        })
      );
    }
  };

  // --- WEBSOCKET MESSAGE HANDLER ---
  const handleServerMessage = (msg) => {
    // 1. SYNC & SEEK
    if (msg.type === "seek" || msg.type === "sync_state") {
      remoteState.current = "seek";
      if (!isReady.current) {
        pendingSync.current = {
          time: msg.timestamp,
          playing: msg.content === "playing",
        };
      } else {
        playerSeekTo(msg.timestamp);
        if (msg.type === "sync_state") setPlaying(msg.content === "playing");
      }
    }

    // 2. PLAY
    if (msg.type === "play") {
      remoteState.current = "play";
      const currentTime = playerRef.current
        ? playerRef.current.getCurrentTime()
        : 0;
      if (Math.abs(currentTime - msg.timestamp) > 1.0) {
        playerSeekTo(msg.timestamp);
      }
      setPlaying(true);
    }

    // 3. PAUSE
    if (msg.type === "pause") {
      remoteState.current = "pause";
      playerSeekTo(msg.timestamp);
      setPlaying(false);
    }

    // 4. CHANGE VIDEO (New Logic)
    if (msg.type === "change_video") {
      console.log("🎬 Switching to Video ID:", msg.video_id);
      const nextVideo = videos.find((v) => v.id === msg.video_id);

      if (nextVideo) {
        setCurrentVideo(nextVideo);
        setPlaying(false); // Force pause
        playerSeekTo(0); // Force time to 0
        remoteState.current = null;
      } else {
        // If we don't have the video in our list yet (rare race condition), refresh
        axios
          .get(`http://127.0.0.1:8000/api/videos/?room=${room}`)
          .then((res) => {
            setVideos(res.data);
            const v = res.data.find((v) => v.id === msg.video_id);
            if (v) setCurrentVideo(v);
          });
      }
    }
  };

  // --- PLAYER EVENT HANDLERS ---
  const onPlay = (timeFromPlayer) => {
    if (remoteState.current === "play") {
      remoteState.current = null;
      return;
    }
    const t = typeof timeFromPlayer === "number" ? timeFromPlayer : 0;
    if (isHostRef.current) sendSignal("play", t);
  };

  const onPause = (timeFromPlayer) => {
    if (remoteState.current === "pause") {
      remoteState.current = null;
      return;
    }
    const t = typeof timeFromPlayer === "number" ? timeFromPlayer : 0;
    if (isHostRef.current) sendSignal("pause", t);
  };

  const onSeek = (seconds) => {
    if (!isReady.current) return;
    if (remoteState.current === "seek") {
      remoteState.current = null;
      return;
    }
    if (isHostRef.current) sendSignal("seek", seconds);
  };

  const onReady = () => {
    isReady.current = true;
    if (pendingSync.current) {
      playerSeekTo(pendingSync.current.time);
      setPlaying(pendingSync.current.playing);
      pendingSync.current = null;
    }
  };

  const sendSignal = (type, payload = null) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
    const timestamp = payload !== null ? payload : 0;
    ws.current.send(
      JSON.stringify({
        type,
        username,
        timestamp,
        video_id: currentVideo ? currentVideo.id : 0,
      })
    );
  };

  // --- CONNECTION & SETUP ---
  useEffect(() => {
    if (!room) return;

    // 1. Fetch Videos for THIS Room
    axios
      .get(`http://localhost:8000/api/videos/?room=${room}`)
      .then((res) => {
        setVideos(res.data);
        if (res.data.length > 0 && !currentVideo) setCurrentVideo(res.data[0]);
      })
      .catch((err) => console.error(err));

    // 2. Connect WebSocket
    ws.current = new WebSocket(
      `ws://localhost:8080/ws?room=${room}&username=${username}`
    );

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "identity") {
        setMyID(msg.user_id);
        setIsHost(msg.is_host);
        isHostRef.current = msg.is_host;
      }
      if (msg.type === "user_list") setUserList(msg.user_list);
      if (msg.type === "chat" || msg.type === "system")
        setMessages((prev) => [...prev, msg]);

      // Handle Video Logic
      if (
        ["play", "pause", "seek", "sync_state", "change_video"].includes(
          msg.type
        )
      ) {
        handleServerMessage(msg);
      }

      // Handle New Video Added
      if (msg.type === "new_video") {
        console.log("🆕 New video added! Refreshing list...");
        axios
          .get(`http://127.0.0.1:8000/api/videos/?room=${room}`)
          .then((res) => setVideos(res.data));
      }

      if (msg.type === "change_video") {
        console.log("🎬 Switching to Video ID:", msg.video_id);
        const nextVideo = videos.find((v) => v.id === msg.video_id);

        if (nextVideo) {
          // FIX 2: Reset readiness so we don't sync too early
          isReady.current = false;

          setCurrentVideo(nextVideo);
          setPlaying(false);
          playerSeekTo(0);
          remoteState.current = null;
        } else {
          // ... (fetch logic remains the same)
          axios
            .get(`http://127.0.0.1:8000/api/videos/?room=${room}`)
            .then((res) => {
              setVideos(res.data);
              const v = res.data.find((v) => v.id === msg.video_id);
              if (v) {
                // FIX 2 (Duplicate here just in case)
                isReady.current = false;
                setCurrentVideo(v);
              }
            });
        }
      }
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [room, username]);

  const sendMessage = (text) =>
    ws.current.send(JSON.stringify({ type: "chat", username, content: text }));
  const toggleHost = (targetID, status) =>
    ws.current.send(
      JSON.stringify({
        type: status ? "revoke_control" : "grant_control",
        content: targetID,
      })
    );

  return {
    room,
    setRoom,
    username,
    setUsername,
    isHost,
    userList,
    myID,
    messages,
    videos,
    currentVideo,
    setCurrentVideo,
    playing,
    playerRef,
    onReady,
    onPlay,
    onPause,
    onSeek,
    sendMessage,
    toggleHost,
    // Export New Functions
    sendNotification,
    changeVideo,
  };
};
