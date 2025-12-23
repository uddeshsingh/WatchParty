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
    <div className="chat-section">
        <div className="sidebar-header">Live Chat</div>
        
        <div className="chat-messages">
            {messages.map((m, i) => (
            <div key={i}>
                {m.type === 'system' ? (
                   <div className="chat-msg-system">{m.content}</div>
                ) : (
                   <div className="chat-msg-user">
                      <strong>{m.username}: </strong>
                      <span>{m.content}</span>
                   </div>
                )}
            </div>
            ))}
        </div>

        <div className="chat-input-area">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="chat-input"
            />
            <button onClick={handleSend} className="chat-send-btn">
              <FaPaperPlane />
            </button>
        </div>
    </div>
  )
}

export default ChatSidebar