// src/components/ChatSidebar.jsx
import React, { useState } from "react";
import { FaPaperPlane, FaSmile } from "react-icons/fa"; // <--- Import FaSmile

// 1. Accept the new prop 'onSendReaction'
const ChatSidebar = ({
  messages,
  onSendMessage,
  onTyping,
  typingUsers,
  onSendReaction,
}) => {
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // <--- Toggle state

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  // List of quick reactions
  const emojis = ["😂", "❤️", "😮", "👏", "🔥", "🎉"];

  return (
    <div className="chat-section">
      {/* ... Header and Messages code remains the same ... */}
      <div className="sidebar-header">Live Chat</div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i}>
            {m.type === "system" ? (
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

      {/* --- INPUT AREA --- */}
      <div className="chat-input-area">
        {/* TYPING INDICATOR (Keep this) */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"}{" "}
            typing...
          </div>
        )}

        {/* EMOJI PICKER POPOVER */}
        {showEmojiPicker && (
          <div className="emoji-picker">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onSendReaction(emoji);
                  setShowEmojiPicker(false); // Close after clicking
                }}
                className="emoji-btn"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            onTyping();
          }}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className="chat-input"
        />

        {/* TOGGLE BUTTON */}
        <button
          className="icon-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Send Reaction"
        >
          <FaSmile />
        </button>

        <button onClick={handleSend} className="chat-send-btn">
          <FaPaperPlane />
        </button>
      </div>
    </div>
  );
};

export default ChatSidebar;
