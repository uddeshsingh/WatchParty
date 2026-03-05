import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API_URL, WS_URL } from "../components/Config";

export const useWatchParty = (urlRoom = null, action = "join") => {
  const [room, setRoom] = useState(urlRoom);
  const [error, setError] = useState(null);

  const [username, setUsername] = useState(null);
  const usernameRef = useRef(null);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  const [isHost, setIsHost] = useState(false);
  const isHostRef = useRef(false);

  const [userList, setUserList] = useState([]);

  const [myID, setMyID] = useState(null);
  const myIDRef = useRef(null);
  useEffect(() => {
    myIDRef.current = myID;
  }, [myID]);

  const [messages, setMessages] = useState([]);
  const [lastReaction, setLastReaction] = useState(null);
  const intentionalClose = useRef(false);

  const [videos, setVideos] = useState([]);
  const videosRef = useRef([]);
  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  const [currentVideo, setCurrentVideo] = useState(null);
  const currentVideoRef = useRef(null);
  useEffect(() => {
    currentVideoRef.current = currentVideo;
  }, [currentVideo]);

  const [playing, setPlaying] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const playerRef = useRef(null);
  const playingRef = useRef(false);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  const ws = useRef(null);
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
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "reaction",
          username: usernameRef.current,
          content: emoji,
        }),
      );
    }
  };

  const sendNotification = (type) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({ type, username: usernameRef.current, room }),
      );
    }
  };

  const changeVideo = (videoId) => {
    if (ws.current && isHostRef.current) {
      ws.current.send(
        JSON.stringify({
          type: "change_video",
          username: usernameRef.current,
          video_id: videoId,
        }),
      );
    }
  };

  const sendTypingSignal = () => {
    const now = Date.now();
    if (now - lastTypingTime.current < 3000) return;
    lastTypingTime.current = now;
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({ type: "typing", username: usernameRef.current }),
      );
    }
  };

  const handleServerMessage = (msg) => {
    if (
      msg.user_id === myIDRef.current &&
      !["identity", "host_updated", "new_video", "change_video"].includes(
        msg.type,
      )
    ) {
      return;
    }

    if (msg.type === "request_sync") {
        if (isHostRef.current && playerRef.current) {
            const currentTime = playerRef.current.getCurrentTime(); 
            ws.current.send(JSON.stringify({
                type: "sync_state",
                username: usernameRef.current,
                room: room,
                timestamp: currentTime,
                video_id: currentVideoRef.current ? currentVideoRef.current.id : 0,
                content: playingRef.current ? "playing" : "paused" 
            }));
        }
        return;
    }

    console.log("📥 WS RECEIVE:", msg);

    if (msg.type === "identity") {
      setMyID(msg.user_id);
      myIDRef.current = msg.user_id;
      setIsHost(msg.is_host);
      isHostRef.current = msg.is_host;
      return;
    }

    if (msg.type === "host_updated") {
      if (msg.user_id === myIDRef.current) {
        setIsHost(msg.is_host);
        isHostRef.current = msg.is_host;
      }
      return;
    }

    if (msg.type === "sync_state") {
      let isChangingVideo = false;

      // 1. Check if we need to load a new video
      if (
        msg.video_id &&
        (!currentVideoRef.current ||
          currentVideoRef.current.id !== msg.video_id)
      ) {
        isChangingVideo = true;
        isReady.current = false; // 🚨 Immediately block the player

        const syncedVideo = videosRef.current.find(
          (v) => v.id === msg.video_id,
        );
        if (syncedVideo) {
          setCurrentVideo(syncedVideo);
        } else {
          axios.get(`${API_URL}/api/videos/?room=${room}`).then((res) => {
            setVideos(res.data);
            const found = res.data.find((v) => v.id === msg.video_id);
            if (found) setCurrentVideo(found);
          });
        }
      }

      remoteState.current = "seek";

      if (isChangingVideo || !isReady.current) {
        pendingSync.current = {
          time: msg.timestamp,
          playing: msg.content === "playing",
        };
      } else {
        // Only seek immediately if the player is already fully loaded
        playerSeekTo(msg.timestamp);
        setPlaying(msg.content === "playing");
      }
    }

    if (msg.type === "seek") {
      remoteState.current = "seek";
      if (!isReady.current) {
        pendingSync.current = {
          time: msg.timestamp,
          playing: pendingSync.current ? pendingSync.current.playing : playing,
        };
      } else {
        playerSeekTo(msg.timestamp);
      }
    }

    

    if (msg.type === "play") {
      remoteState.current = "play";
      if (!isReady.current) {
        pendingSync.current = { time: msg.timestamp, playing: true };
      } else {
        const currentTime = playerRef.current
          ? playerRef.current.getCurrentTime()
          : 0;
        if (Math.abs(currentTime - msg.timestamp) > 1.5)
          playerSeekTo(msg.timestamp);
        setPlaying(true);
      }
    }

    if (msg.type === "pause") {
      remoteState.current = "pause";
      if (!isReady.current) {
        pendingSync.current = { time: msg.timestamp, playing: false };
      } else {
        playerSeekTo(msg.timestamp);
        setPlaying(false);
      }
    }

    if (msg.type === "change_video") {
      const nextVideo = videosRef.current.find((v) => v.id === msg.video_id);
      isReady.current = false; 
      remoteState.current = "play"; // Expecting to play immediately
      setPlaying(true); 

      if (nextVideo) {
        setCurrentVideo(nextVideo);
        playerSeekTo(0);
      } else {
        // Fallback if the video isn't in the local cache yet
        axios.get(`${API_URL}/api/videos/?room=${room}`).then((res) => {
          setVideos(res.data);
          const v = res.data.find((v) => v.id === msg.video_id);
          if (v) setCurrentVideo(v);
        });
      }
    }

    if (msg.type === "playlist_updated" || msg.type === "new_video") {
      axios.get(`${API_URL}/api/videos/?room=${room}`).then((res) => {
        setVideos(res.data);
        setCurrentVideo((prev) => {
          if (!prev && res.data.length > 0) return res.data[0];
          return prev;
        });
      });
    }

    if (msg.type === "typing") {
      if (msg.username === usernameRef.current) return;
      if (typingTimeout.current[msg.username])
        clearTimeout(typingTimeout.current[msg.username]);
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

  const onPlay = (t) => {
    if (remoteState.current !== "play" && isHostRef.current) {
      setPlaying(true);
      remoteState.current = "play";
      sendSignal("play", t || 0);
    }
  };

  const onPause = (t) => {
    if (remoteState.current !== "pause" && isHostRef.current) {
      setPlaying(false);
      remoteState.current = "pause";
      sendSignal("pause", t || 0);
    }
  };

  const onSeek = (t) => {
    if (
      isReady.current &&
      remoteState.current !== "seek" &&
      isHostRef.current
    ) {
      remoteState.current = "seek";
      sendSignal("seek", t);
    }
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
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    const payloadMsg = {
      type,
      username: usernameRef.current,
      timestamp: payload || 0,
      video_id: currentVideoRef.current ? currentVideoRef.current.id : 0,
    };
    console.log("📤 WS SEND:", payloadMsg);
    ws.current.send(JSON.stringify(payloadMsg));
  };

  useEffect(() => {
    setRoom(urlRoom);
  }, [urlRoom]);

  useEffect(() => {
    setVideos([]);
    setCurrentVideo(null);
    setPlaying(false);
    setError(null);

    const token = localStorage.getItem("watchparty_token");
    if (!room || !username || !token) return;

    intentionalClose.current = false;

    axios.get(`${API_URL}/api/videos/?room=${room}`).then((res) => {
      setVideos(res.data);
      if (res.data.length > 0) setCurrentVideo(res.data[0]);
    });

    const wsUrl = `${WS_URL}/ws?room=${room}&token=${token}&action=${action}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "user_list") {
        setUserList(msg.user_list);
        const me = msg.user_list.find((u) => u.id === myIDRef.current);
        if (me && me.is_host !== isHostRef.current) {
          setIsHost(me.is_host);
          isHostRef.current = me.is_host;
        }
      }

      if (msg.type === "error") {
        setError(msg.content);
        intentionalClose.current = true;
        ws.current.close();
        return;
      }

      if (msg.type === "chat" || msg.type === "system") {
        setMessages((prev) => [...prev, msg]);
      }

      const syncTypes = [
        "identity",
        "play",
        "pause",
        "seek",
        "sync_state",
        "change_video",
        "typing",
        "reaction",
        "playlist_updated",
        "host_updated",
        "new_video",
      ];
      if (syncTypes.includes(msg.type)) handleServerMessage(msg);
    };

    ws.current.onclose = () => {
      if (!intentionalClose.current)
        setError(
          action === "join" ? "room_not_found_silent" : "connection_lost",
        );
    };

    const heartbeat = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: "ping",
          username: username,
          room: room
        }));
      }
    }, 25000);

    return () => {
      clearInterval(heartbeat);
      intentionalClose.current = true;
      if (ws.current) ws.current.close();
    };
  }, [room, username, action]);

    return () => {
      intentionalClose.current = true;
      if (ws.current) ws.current.close();
    };
  }, [room, username, action]);

  const sendMessage = (text) =>
    ws.current.send(
      JSON.stringify({
        type: "chat",
        username: usernameRef.current,
        content: text,
      }),
    );

  const toggleHost = (targetID, status) => {
    const payloadMsg = {
      type: status ? "revoke_control" : "grant_control",
      content: targetID,
      username: usernameRef.current,
    };
    console.log("📤 WS SEND:", payloadMsg);
    ws.current.send(JSON.stringify(payloadMsg));
  };

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
