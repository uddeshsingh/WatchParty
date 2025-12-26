import React, { useEffect } from 'react'
import { FaFilm, FaCrown } from 'react-icons/fa' 
import { useWatchParty } from '../hooks/useWatchParty'
import VideoPlayer from './VideoPlayer' 
import ChatSidebar from './ChatSidebar'
import VideoList from './VideoList'
import UserList from './UserList'
import RoomSelector from './RoomSelector'
import AddVideoBar from './AddVideoBar'

const Dashboard = ({ user, onLogout }) => {
  const {
    room, setRoom, username, setUsername, isHost, userList, myID,
    messages, videos, currentVideo, playing, playerRef, 
    onReady, onPlay, onPause, onSeek, sendNotification, sendMessage, toggleHost, changeVideo, sendTypingSignal, typingUsers
  } = useWatchParty()

  useEffect(() => {
      if (user) setUsername(user)
  }, [user, setUsername])

  return (
    <div className="app-container">
      {!room && <RoomSelector onJoin={setRoom} />}

      <nav className="navbar">
        <div className="logo"><FaFilm /> <span>WatchParty</span></div>
        <div className="nav-info">
            {isHost && <span className="badge host-badge"><FaCrown /> Host</span>}
            {room && <span className="badge">🏠 {room}</span>}
            <div className="badge user-badge" onClick={onLogout} title="Click to Logout">
                👤 {username}
            </div>
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
          <UserList users={userList} myID={myID} isHost={isHost} onToggleHost={toggleHost} />
          <AddVideoBar room={room} onVideoAdded={() => sendNotification("new_video")} />
          <VideoList 
              videos={videos} 
              onSelect={(video) => {
                 if (isHost) changeVideo(video.id)
                 else alert("Only the host can change the video!")
              }} 
          />
          <ChatSidebar messages={messages} onSendMessage={sendMessage} onTyping={sendTypingSignal} typingUsers={typingUsers} />
        </aside>
      </main>
    </div>
  )
}

export default Dashboard