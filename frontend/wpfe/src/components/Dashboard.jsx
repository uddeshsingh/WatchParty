import React, { useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaFilm, FaCrown, FaArrowLeft, FaShareAlt } from "react-icons/fa"; // Added FaShareAlt
import { useWatchParty } from "../hooks/useWatchParty";
import VideoPlayer from "./VideoPlayer";
import ChatSidebar from "./ChatSidebar";
import VideoList from "./VideoList";
import UserList from "./UserList";
import RoomSelector from "./RoomSelector";
import AddVideoBar from "./AddVideoBar";
import ReactionOverlay from "./ReactionOverlay";

const Dashboard = ({ user, onLogout }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAlerted = useRef(false);

  // CHANGED: Get action from state (default to 'join')
  const action = location.state?.action || "join";

  const {
    room,
    username,
    setUsername,
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
    sendReaction,
    onReady,
    onPlay,
    onPause,
    onSeek,
    sendNotification,
    sendMessage,
    toggleHost,
    changeVideo,
    sendTypingSignal,
    typingUsers,
  } = useWatchParty(roomId, action);

  useEffect(() => {
    if (error && !hasAlerted.current) {
      hasAlerted.current = true;
      alert(
        error === "room_exists" ? "Room name taken!" : "Room does not exist!"
      );
      navigate("/");
    }
  }, [error, navigate]);

  const copyLink = () => {
    const url = window.location.href.split("?")[0];
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard! 📋");
  };

  useEffect(() => {
    if (user) setUsername(user);
  }, [user, setUsername]);

  return (
    <div className="app-container">
      {/* CHANGED: Pass navigate with state for Creation */}
      {!room && (
        <RoomSelector
          onJoin={(name, mode) =>
            navigate(`/room/${name}`, { state: { action: mode } })
          }
        />
      )}

      <nav className="navbar">
        <div className="logo">
          <FaFilm /> <span>WatchParty</span>
        </div>
        <div className="nav-info">
          {room && (
            <>
              {/* CHANGED: Added Share Button */}
              <button className="nav-btn" onClick={copyLink} title="Share Room">
                <FaShareAlt /> Share
              </button>
              <button
                className="nav-btn"
                onClick={() => navigate("/")}
                title="Leave Room"
              >
                <FaArrowLeft /> Leave
              </button>
            </>
          )}
          {isHost && (
            <span className="badge host-badge">
              <FaCrown /> Host
            </span>
          )}
          {room && <span className="badge">🏠 {room}</span>}
          <div
            className="badge user-badge"
            onClick={onLogout}
            title="Click to Logout"
          >
            👤 {username}
          </div>
        </div>
      </nav>

      <main className="main-content">
        <section className="video-stage">
          <div className="player-container">
            <ReactionOverlay lastReaction={lastReaction} />
            <VideoPlayer
              ref={playerRef}
              url={currentVideo?.video_url}
              playing={playing}
              isHost={isHost}
              onReady={onReady}
              onPlay={onPlay}
              onPause={onPause}
              onSeek={onSeek}
            />
          </div>
        </section>

        <aside className="sidebar">
          <UserList
            users={userList}
            myID={myID}
            isHost={isHost}
            onToggleHost={toggleHost}
          />
          <AddVideoBar
            room={room}
            onVideoAdded={() => sendNotification("new_video")}
          />
          <VideoList
            videos={videos}
            onSelect={(video) => {
              if (isHost) changeVideo(video.id);
              else alert("Only the host can change the video!");
            }}
          />
          <ChatSidebar
            messages={messages}
            onSendMessage={sendMessage}
            onTyping={sendTypingSignal}
            typingUsers={typingUsers}
            onSendReaction={sendReaction}
          />
        </aside>
      </main>
    </div>
  );
};

export default Dashboard;
