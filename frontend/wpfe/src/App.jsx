import { FaFilm, FaCrown, FaUserMinus, FaUserPlus } from 'react-icons/fa' 
import './App.css'
import VideoPlayer from './components/VideoPlayer' 
import ChatSidebar from './components/ChatSidebar'
import VideoList from './components/VideoList'
import UsernameModal from './components/UsernameModal'
import RoomSelector from './components/RoomSelector'
import { useWatchParty } from './hooks/useWatchParty'

function App() {
  const {
    room, setRoom, username, setUsername, isHost, userList, myID,
    messages, videos, currentVideo, setCurrentVideo, 
    playing, 
    playerRef, 
    
    // Handlers
    onReady, 
    onPlay, 
    onPause, 
    onSeek, 
    
    sendMessage, toggleHost
  } = useWatchParty()

  return (
    <div className="app-container">
      {!room && <RoomSelector onJoin={setRoom} />}
      {room && !username && <UsernameModal onJoin={setUsername} />}

      <nav className="navbar">
        <div className="logo"><FaFilm /> <span>WatchParty</span></div>
        <div className="nav-info">
            {isHost && <span className="host-badge"><FaCrown /> Host</span>}
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
          {/* ... (Sidebar remains the same) ... */}
          <div className="user-list-section" style={{padding: '10px', borderBottom: '1px solid #333', maxHeight: '150px', overflowY: 'auto'}}>
             <div className="sidebar-header" style={{paddingLeft: 0}}>Users ({userList.length})</div>
             {userList.map(u => (
                 <div key={u.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '5px 0'}}>
                     <span style={{color: u.is_host ? '#eab308' : '#ddd', fontWeight: u.is_host ? 'bold' : 'normal'}}>
                         {u.is_host && <FaCrown style={{marginRight: '5px'}}/>} 
                         {u.username} {u.id === myID && "(You)"}
                     </span>
                     {isHost && u.id !== myID && (
                         <button 
                            onClick={() => toggleHost(u.id, u.is_host)}
                            style={{background: 'transparent', border: '1px solid #444', color: u.is_host ? '#ef4444' : '#22c55e', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem'}}
                         >
                            {u.is_host ? <FaUserMinus /> : <FaUserPlus />}
                         </button>
                     )}
                 </div>
             ))}
          </div>
          <VideoList videos={videos} onSelect={setCurrentVideo} />
          <ChatSidebar messages={messages} onSendMessage={sendMessage} />
        </aside>
      </main>
    </div>
  )
}

export default App