import React from 'react'
import { FaCrown, FaUserMinus, FaUserPlus } from 'react-icons/fa'

const UserList = ({ users, myID, isHost, onToggleHost }) => {
  return (
    <div className="user-list-section">
        <div className="sidebar-header" style={{paddingLeft: 0}}>
            Users ({users.length})
        </div>
        
        {users.map(u => (
            <div key={u.id} className="user-item">
                <span className={`user-name ${u.is_host ? 'is-host' : ''}`}>
                    {u.is_host && <FaCrown />} 
                    {u.username} 
                    {u.id === myID && <span className="user-me">(You)</span>}
                </span>

                {isHost && u.id !== myID && (
                    <button 
                        onClick={() => onToggleHost(u.id, u.is_host)}
                        title={u.is_host ? "Revoke Host" : "Make Host"}
                        className={`control-btn ${u.is_host ? 'revoke' : 'promote'}`}
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