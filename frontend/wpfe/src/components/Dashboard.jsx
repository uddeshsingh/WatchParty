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
import axios from "axios";
import { API_URL } from "./Config";

const Dashboard = ({ user, onLogout }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAlerted = useRef(false);
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
    onEnded,
    refreshPlaylist,
  } = useWatchParty(roomId, action);

  useEffect(() => {
    hasAlerted.current = false;
  }, [room]);

  useEffect(() => {
    if (!error) {
      hasAlerted.current = false;
      return;
    }
    if (hasAlerted.current) return;
    hasAlerted.current = true;

    let alertMsg = error;
    if (error === "room_exists") alertMsg = "Room name taken!";
    else if (error === "room_not_found_silent")
      alertMsg = "Room does not exist!";
    else if (error === "connection_lost")
      alertMsg = "Connection lost. Please rejoin.";

    alert(alertMsg);
    navigate("/");
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
          onLogout={onLogout}
          username={user}
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

      {room ? (
        <main className="main-content">
          <section className="video-stage">
            <div className="player-container">
              <ReactionOverlay lastReaction={lastReaction} />
              {currentVideo ? (
                <VideoPlayer
                  ref={playerRef}
                  url={currentVideo.video_url}
                  playing={playing}
                  isHost={isHost}
                  onReady={onReady}
                  onPlay={onPlay}
                  onPause={onPause}
                  onSeek={onSeek}
                  onEnded={onEnded}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    color: "#666",
                  }}
                >
                  <FaFilm
                    size={50}
                    style={{ marginBottom: "15px", opacity: 0.5 }}
                  />
                  <h2>No video selected</h2>
                  <p>Paste a YouTube link in the sidebar to start the party!</p>
                </div>
              )}
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
              isHost={isHost}
              onDelete={async (videoId) => {
                await axios.delete(
                  `${API_URL}/api/videos/${videoId}?room=${room}`,
                );
                refreshPlaylist();
              }}
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
      ) : null}
    </div>
  );
};

export default Dashboard;
