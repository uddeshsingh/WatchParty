import React, { useEffect, forwardRef } from 'react'
import ReactPlayer from 'react-player'

// We use forwardRef so the parent (App.jsx) can control the player
const VideoPlayer = forwardRef(({ url, playing, onSignal, onProgressUpdate, isRemoteUpdate }, ref) => {
  
  // --- NATIVE SEEK LISTENER (Fix for Arrow Keys/Scrubbing) ---
  useEffect(() => {
    const node = ref.current
    if (!node) return

    const handleSeekEvent = () => {
       // Only send signal if we aren't currently processing a remote command
       if (!isRemoteUpdate.current) {
         console.log("🕵️ Native Seek Detected")
         onSignal('seek')
       }
    }

    try {
        node.addEventListener('seeked', handleSeekEvent)
    } catch(e) { 
        console.warn("⚠️ Could not attach seeked listener:", e)
     }

    return () => {
      if (node.removeEventListener) node.removeEventListener('seeked', handleSeekEvent)
    }
  }, [isRemoteUpdate, onSignal, ref, url]) 

  return (
    <div className="player-wrapper">
      <ReactPlayer 
        ref={ref} 
        src={url} 
        width="100%" height="100%" controls={true}
        playing={playing}
        
        // SYNC EVENTS
        onPlay={() => onSignal('play')}
        onPause={() => onSignal('pause')}
        
        // PASSIVE TIME TRACKING
        onProgress={onProgressUpdate}
      />
    </div>
  )
})

export default VideoPlayer