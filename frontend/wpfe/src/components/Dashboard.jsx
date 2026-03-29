import React, { useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaFilm, FaCrown, FaArrowLeft, FaShareAlt } from "react-icons/fa";
import { useWatchParty } from "../hooks/useWatchParty";
import PlayerRouter from "./PlayerRouter";
import ChatSidebar from "./ChatSidebar";
import VideoList from "./VideoList";
import UserList from "./UserList";
import RoomSelector from "./RoomSelector";
import AddVideoBar from "./AddVideoBar";
import RecommendationPanel from "./RecommendationPanel";
import ProviderSelector from "./ProviderSelector";
import ReactionOverlay from "./ReactionOverlay";
import axios from "axios";
import { API_URL } from "./Config";

const Dashboard = ({ user, onLogout }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAlerted = useRef(false);
  const preloadConsumed = useRef(false);
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
    provider,
    providerVersion,
    recommendations,
    dismissRecommendation,
    changeProvider,
    sendRecommendVideo,
    guestResyncEmbed,
  } = useWatchParty(roomId, action);

  useEffect(() => {
    preloadConsumed.current = false;
  }, [roomId]);

  useEffect(() => {
    const preload = location.state?.preload;
    if (!preload || !roomId || !isHost || preloadConsumed.current) return;
    preloadConsumed.current = true;
    (async () => {
      try {
        if (preload.youtubeUrl) {
          await axios.post(`${API_URL}/api/videos/add`, {
            url: preload.youtubeUrl,
            room: roomId,
          });
        } else if (preload.tmdb_id != null) {
          await axios.post(`${API_URL}/api/videos/add`, {
            room: roomId,
            tmdb_id: preload.tmdb_id,
            media_type: preload.media_type,
            title: preload.title,
            thumbnail: preload.thumbnail,
            ...(preload.media_type === "tv"
              ? {
                  season: preload.season ?? 1,
                  episode: preload.episode ?? 1,
                }
              : {}),
          });
        }
        sendNotification("new_video");
        refreshPlaylist();
        navigate(`/room/${roomId}`, {
          replace: true,
          state: { action: "create" },
        });
      } catch (err) {
        preloadConsumed.current = false;
        const detail = err.response?.data?.detail;
        alert(
          typeof detail === "string"
            ? detail
            : "Could not add video from trending pick.",
        );
      }
    })();
  }, [
    roomId,
    isHost,
    location.state?.preload,
    navigate,
    refreshPlaylist,
    sendNotification,
  ]);

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

  const showTmdbChrome =
    currentVideo && currentVideo.tmdb_id != null && currentVideo.media_type;

  return (
    <div className="app-container">
      {!room && (
        <RoomSelector
          onJoin={(name, mode, preload) =>
            navigate(`/room/${name}`, {
              state:
                preload != null
                  ? { action: mode, preload }
                  : { action: mode },
            })
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
          {isHost && showTmdbChrome && (
            <ProviderSelector
              value={provider}
              onChange={changeProvider}
              disabled={!room}
            />
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
                <PlayerRouter
                  currentVideo={currentVideo}
                  playing={playing}
                  isHost={isHost}
                  playerRef={playerRef}
                  providerKey={provider}
                  providerVersion={providerVersion}
                  embedStartSeconds={0}
                  onReady={onReady}
                  onPlay={onPlay}
                  onPause={onPause}
                  onSeek={onSeek}
                  onEnded={onEnded}
                  onSwitchProvider={(key) => changeProvider(key)}
                  onGuestResync={
                    !isHost && showTmdbChrome ? guestResyncEmbed : undefined
                  }
                />
              ) : (
                <div className="no-video-placeholder">
                  <FaFilm
                    size={50}
                    style={{ marginBottom: "15px", opacity: 0.5 }}
                  />
                  <h2>No video selected</h2>
                  <p>Add a YouTube link or a TMDB movie/TV show in the sidebar.</p>
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
            {isHost && (
              <RecommendationPanel
                room={room}
                recommendations={recommendations}
                onDismiss={dismissRecommendation}
                onVideoAdded={() => {
                  sendNotification("new_video");
                  refreshPlaylist();
                }}
              />
            )}
            <AddVideoBar
              room={room}
              isHost={isHost}
              onRecommend={(data) => sendRecommendVideo(data)}
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
