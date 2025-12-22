import React from 'react'
import { FaCrown, FaUserMinus, FaUserPlus } from 'react-icons/fa'

const UserList = ({ users, myID, isHost, onToggleHost }) => {
  return (
    <div className="user-list-section" style={{
        padding: '10px', 
        borderBottom: '1px solid #333', 
        maxHeight: '150px', 
        overflowY: 'auto'
    }}>
        <div className="sidebar-header" style={{paddingLeft: 0}}>
            Users ({users.length})
        </div>
        
        {users.map(u => (
            <div key={u.id} style={{
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                margin: '5px 0'
            }}>
                <span style={{
                    color: u.is_host ? '#eab308' : '#ddd', 
                    fontWeight: u.is_host ? 'bold' : 'normal',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                }}>
                    {u.is_host && <FaCrown />} 
                    {u.username} {u.id === myID && <span style={{opacity: 0.6, fontSize: '0.9em'}}>(You)</span>}
                </span>

                {/* Only show controls if *I* am the host and this user is NOT me */}
                {isHost && u.id !== myID && (
                    <button 
                        onClick={() => onToggleHost(u.id, u.is_host)}
                        title={u.is_host ? "Revoke Host" : "Make Host"}
                        style={{
                            background: 'transparent', 
                            border: '1px solid #444', 
                            color: u.is_host ? '#ef4444' : '#22c55e', 
                            cursor: 'pointer', 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        {u.is_host ? <FaUserMinus /> : <FaUserPlus />}
                    </button>
                )}
            </div>
        ))}
    </div>
  )
}

export default UserList