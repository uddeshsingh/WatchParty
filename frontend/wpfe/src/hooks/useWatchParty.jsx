import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_URL, WS_URL } from "../components/Config";

// CHANGED: Accept 'action' (join/create)
export const useWatchParty = (urlRoom = null, action = "join") => {
  const [room, setRoom] = useState(urlRoom);
  const [error, setError] = useState(null); // CHANGED: Error state
  const [username, setUsername] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [userList, setUserList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [myID, setMyID] = useState(null);
  const [lastReaction, setLastReaction] = useState(null);
  const intentionalClose = useRef(false);

  const [videos, setVideos] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const playerRef = useRef(null);
  const ws = useRef(null);
  const isHostRef = useRef(false);
  const lastTypingTime = useRef(0);
  const typingTimeout = useRef({});

  const isReady = useRef(false);
  const pendingSync = useRef(null);
  const remoteState = useRef(null);

  const playerSeekTo = (timestamp) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(timestamp, "seconds");
    }
  };

  const sendReaction = (emoji) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "reaction",
          username,
          content: emoji,
        })
      );
    }
  };

  const sendNotification = (type) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, username, room }));
    }
  };

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

  const sendTypingSignal = () => {
    const now = Date.now();
    if (now - lastTypingTime.current < 3000) {
      return;
    }
    lastTypingTime.current = now;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "typing",
          username,
        })
      );
    }
  };

  const handleServerMessage = (msg) => {
    if (msg.type === "sync_state") {
      if (msg.video_id && (!currentVideo || currentVideo.id !== msg.video_id)) {
        console.log("🔄 Syncing to Host Video ID:", msg.video_id);
        const syncedVideo = videos.find((v) => v.id === msg.video_id);

        if (syncedVideo) {
          isReady.current = false;
          setCurrentVideo(syncedVideo);
        } else {
          axios.get(`${API_URL}/api/videos/?room=${room}`).then((res) => {
            setVideos(res.data);
            const found = res.data.find((v) => v.id === msg.video_id);
            if (found) {
              isReady.current = false;
              setCurrentVideo(found);
            }
          });
        }
      }
    }

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

    if (msg.type === "pause") {
      remoteState.current = "pause";
      playerSeekTo(msg.timestamp);
      setPlaying(false);
    }

    if (msg.type === "change_video") {
      console.log("🎬 Switching to Video ID:", msg.video_id);
      const nextVideo = videos.find((v) => v.id === msg.video_id);

      if (nextVideo) {
        isReady.current = false;
        setCurrentVideo(nextVideo);
        setPlaying(false);
        playerSeekTo(0);
        remoteState.current = null;
      } else {
        axios.get(`${API_URL}/api/videos/?room=${room}`).then((res) => {
          setVideos(res.data);
          const v = res.data.find((v) => v.id === msg.video_id);
          if (v) {
            isReady.current = false;
            setCurrentVideo(v);
          }
        });
      }
    }
    if (msg.type === "typing") {
      if (msg.username === username) return;
      if (typingTimeout.current[msg.username]) {
        clearTimeout(typingTimeout.current[msg.username]);
      }
      setTypingUsers((prev) => {
        if (prev.includes(msg.username)) return prev;
        return [...prev, msg.username];
      });
      typingTimeout.current[msg.username] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((user) => user !== msg.username));
      }, 4000);
    }

    if (msg.type === "reaction") {
      setLastReaction({
        emoji: msg.content,
        id: Date.now(),
        username: msg.username,
      });
    }
  };

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

  useEffect(() => {
    setRoom(urlRoom);
  }, [urlRoom]);

  useEffect(() => {
    if (!room || !username) return;
    intentionalClose.current = false;
    setError(null);

    axios
      .get(`${API_URL}/api/videos/?room=${room}`)
      .then((res) => {
        setVideos(res.data);
        if (res.data.length > 0 && !currentVideo) setCurrentVideo(res.data[0]);
      })
      .catch((err) => console.error(err));

    const wsUrl = `${WS_URL}?room=${room}&username=${username}&action=${action}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "identity") {
        setMyID(msg.user_id);
        setIsHost(msg.is_host);
        isHostRef.current = msg.is_host;
      }
      if (msg.type === "user_list") setUserList(msg.user_list);

      if (msg.type === "error") {
        setError(msg.content);
        intentionalClose.current = true;
        ws.current.close();
        return;
      }

      if (msg.type === "chat" || msg.type === "system")
        setMessages((prev) => [...prev, msg]);

      if (
        [
          "play",
          "pause",
          "seek",
          "sync_state",
          "change_video",
          "typing",
          "reaction",
        ].includes(msg.type)
      ) {
        handleServerMessage(msg);
      }

      if (msg.type === "new_video") {
        console.log("🆕 New video added! Refreshing list...");
        axios
          .get(`${API_URL}/api/videos/?room=${room}`)
          .then((res) => setVideos(res.data));
      }
    };

    ws.current.onclose = () => {
        console.log("🔌 WebSocket Disconnected");
        if (!intentionalClose.current) {
            if (action === "join") {
                setError("room_not_found_silent"); 
            } else {
                setError("connection_lost");
            }
        }
    };

    return () => {
      intentionalClose.current = true;
      if (ws.current) ws.current.close();
    };
  }, [room, username, action]);

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
    typingUsers,
    username,
    isHost,
    userList,
    myID,
    messages,
    videos,
    currentVideo,
    playing,
    playerRef,
    lastReaction,
    error,
    setCurrentVideo,
    sendReaction,
    setUsername,
    onReady,
    onPlay,
    onPause,
    onSeek,
    sendMessage,
    toggleHost,
    sendNotification,
    changeVideo,
    sendTypingSignal,
    setRoom,
  };
};
