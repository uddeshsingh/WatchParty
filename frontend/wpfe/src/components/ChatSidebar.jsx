import React, { useState } from 'react'
import { FaPaperPlane } from 'react-icons/fa'

const ChatSidebar = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    onSendMessage(input)
    setInput("")
  }

  return (
    <div className="chat-section" style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
        <div className="sidebar-header">Live Chat</div>
        
        <div className="chat-messages" style={{flex: 1, overflowY: 'auto', padding: '10px'}}>
            {messages.map((m, i) => (
            <div key={i} style={{marginBottom: '8px'}}>
                {/* System Messages vs User Messages */}
                {m.type === 'system' ? (
                   <div style={{color: '#888', fontSize: '0.85em', fontStyle: 'italic'}}>
                      {m.content}
                   </div>
                ) : (
                   <div>
                      <strong style={{color: '#8b5cf6'}}>{m.username}: </strong>
                      <span style={{color: '#ddd'}}>{m.content}</span>
                   </div>
                )}
            </div>
            ))}
        </div>

        <div className="chat-input" style={{padding: '10px', display: 'flex', gap: '5px'}}>
            <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            style={{flex: 1, padding: '8px', borderRadius: '4px', border: 'none', background: '#333', color: 'white'}}
            />
            <button onClick={handleSend} style={{background: '#8b5cf6', border: 'none', color: 'white', padding: '8px', borderRadius: '4px'}}>
            <FaPaperPlane />
            </button>
        </div>
    </div>
  )
}

export default ChatSidebar