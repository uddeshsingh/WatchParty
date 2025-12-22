import { FaFilm, FaCrown } from "react-icons/fa";
import "./App.css";
import VideoPlayer from "./components/VideoPlayer";
import ChatSidebar from "./components/ChatSidebar";
import VideoList from "./components/VideoList";
import UserList from "./components/UserList";
import UsernameModal from "./components/UsernameModal";
import RoomSelector from "./components/RoomSelector";
import AddVideoBar from "./components/AddVideoBar";
import { useWatchParty } from "./hooks/useWatchParty";

function App() {
  const {
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
    playing,
    playerRef,
    onReady,
    onPlay,
    onPause,
    onSeek,
    sendNotification,
    sendMessage,
    toggleHost,
    changeVideo,
  } = useWatchParty();

  return (
    <div className="app-container">
      {!room && <RoomSelector onJoin={setRoom} />}
      {room && !username && <UsernameModal onJoin={setUsername} />}

      <nav className="navbar">
        <div className="logo">
          <FaFilm /> <span>WatchParty</span>
        </div>
        <div className="nav-info">
          {isHost && (
            <span className="host-badge">
              <FaCrown /> Host
            </span>
          )}
          <span className="room-badge">🏠 {room}</span>
          <div className="user-badge">👤 {username}</div>
        </div>
      </nav>

      <main className="main-content">
        <section className="video-stage">
          <div className="player-container">
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
          {/* 1. Modular User List */}
          <UserList
            users={userList}
            myID={myID}
            isHost={isHost}
            onToggleHost={toggleHost}
          />

          {/* 2. Add Video (With Room Prop) */}
          <AddVideoBar
            room={room}
            onVideoAdded={() => sendNotification("new_video")}
          />

          {/* 3. Video List (With Change Video Logic) */}
          <VideoList
            videos={videos}
            onSelect={(video) => {
              if (isHost) {
                changeVideo(video.id); // Host changes for everyone
              } else {
                alert("Only the host can change the video!")
              }
            }}
          />

          <ChatSidebar messages={messages} onSendMessage={sendMessage} />
        </aside>
      </main>
    </div>
  );
}

export default App;
