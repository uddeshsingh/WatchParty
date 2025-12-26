import React, { useState, useEffect, useRef } from 'react'

const ReactionOverlay = ({ lastReaction }) => {
  const [visibleReactions, setVisibleReactions] = useState([])
  
  // Track if component is mounted to prevent errors if user leaves page
  const isMounted = useRef(true)
  useEffect(() => {
      isMounted.current = true;
      return () => { isMounted.current = false; }
  }, [])

  useEffect(() => {
    if (!lastReaction) return
    const newReaction = {
      ...lastReaction,
      id: Date.now() + Math.random(),
      left: Math.floor(Math.random() * 80) + 10 + "%" 
    }

    requestAnimationFrame(() => {
        if (isMounted.current) {
            setVisibleReactions((prev) => [...prev, newReaction])
        }
    })

    setTimeout(() => {
      if (isMounted.current) {
        setVisibleReactions((prev) => prev.filter((r) => r.id !== newReaction.id))
      }
    }, 2000)

  }, [lastReaction])

  return (
    <div className="reaction-overlay-container">
      {visibleReactions.map((r) => (
        <div 
            key={r.id} 
            className="floating-emoji" 
            style={{ left: r.left }}
        >
            {r.emoji}
            <span className="reaction-username">{r.username}</span>
        </div>
      ))}
    </div>
  )
}

export default ReactionOverlay