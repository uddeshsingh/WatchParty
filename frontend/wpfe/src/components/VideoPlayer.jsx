import React, { useState, useRef, forwardRef, useEffect } from "react"; // <--- Added useEffect
import ReactPlayer from "react-player";
import screenfull from "screenfull";
import { FaVolumeUp, FaVolumeMute, FaExpand } from "react-icons/fa";

const GuestControls = ({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  playing,
}) => (
  <div
    className="custom-controls"
    style={{
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      background: "rgba(0,0,0,0.7)",
      padding: "10px",
      display: "flex",
      gap: "15px",
      alignItems: "center",
      zIndex: 20,
    }}
  >
    <div style={{ flex: 1, color: "#aaa", fontSize: "0.9rem" }}>
      {playing ? "▶ Now Playing" : "⏸ Paused by Host"}
    </div>
    <button
      onClick={onToggleMute}
      style={{
        background: "none",
        border: "none",
        color: "white",
        cursor: "pointer",
      }}
    >
      {muted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
    </button>
    <input
      type="range"
      min={0}
      max={1}
      step="0.1"
      value={muted ? 0 : volume}
      onChange={onVolumeChange}
      style={{ width: "60px", cursor: "pointer" }}
    />
    <button
      onClick={onToggleFullscreen}
      style={{
        background: "none",
        border: "none",
        color: "white",
        cursor: "pointer",
      }}
    >
      <FaExpand />
    </button>
  </div>
);

const VideoPlayer = forwardRef(
  ({ url, playing, onReady, onPlay, onPause, onSeek, isHost }, ref) => {
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(true);
    const wrapperRef = useRef(null);

    const lastProgressRef = useRef(0);
    const isRestoring = useRef(false);

    // --- NEW: Reset history when URL changes ---
    useEffect(() => {
      lastProgressRef.current = 0;
      isRestoring.current = false;
    }, [url]);
    // ------------------------------------------

    const toggleFullscreen = () => {
      if (screenfull.isEnabled && wrapperRef.current)
        screenfull.toggle(wrapperRef.current);
    };
    const handleVolumeChange = (e) => {
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);
      setMuted(newVol === 0);
    };
    const handleToggleMute = () => {
      if (muted) {
        setVolume(0.8);
        setMuted(false);
      } else {
        setMuted(true);
      }
    };
    const getCurrentTime = () => {
      if (
        ref &&
        ref.current &&
        typeof ref.current.getCurrentTime === "function"
      )
        return ref.current.getCurrentTime();
      return 0;
    };
    const playerConfig = {
      youtube: {
        playerVars: {
          controls: isHost ? 1 : 0,
          disablekb: isHost ? 0 : 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
      },
      file: { attributes: { controlsList: "nodownload" } },
    };

    return (
      <div
        className="player-wrapper"
        ref={wrapperRef}
        style={{
          position: "relative",
          background: "black",
          width: "100%",
          height: "100%",
        }}
      >
        {!isHost && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: "50px",
              zIndex: 10,
              cursor: "not-allowed",
              background: "transparent",
            }}
          />
        )}

        <ReactPlayer
          key={isHost ? "host-player" : "guest-player"}
          ref={ref}
          url={url}
          width="100%"
          height="100%"
          controls={isHost}
          playing={playing}
          muted={muted}
          volume={volume}
          config={playerConfig}
          onReady={() => {
            if (lastProgressRef.current > 1) {
              isRestoring.current = true;
              if (ref.current)
                ref.current.seekTo(lastProgressRef.current, "seconds");
            }
            if (onReady) onReady();
          }}
          onProgress={(state) => {
            const current = state.playedSeconds;
            const diff = Math.abs(current - lastProgressRef.current);
            if (diff > 2 && isHost && !isRestoring.current) {
              if (onSeek) onSeek(current);
            }
            if (isRestoring.current && diff < 1) isRestoring.current = false;
            lastProgressRef.current = current;
          }}
          onPlay={() => {
            if (onPlay) onPlay(getCurrentTime());
          }}
          onPause={() => {
            if (onPause) onPause(getCurrentTime());
          }}
          onSeek={(seconds) => {
            if (isRestoring.current) {
              isRestoring.current = false;
              return;
            }
            lastProgressRef.current = seconds;
            if (onSeek) onSeek(seconds);
          }}
        />

        {!isHost && (
          <GuestControls
            playing={playing}
            volume={volume}
            muted={muted}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={toggleFullscreen}
          />
        )}
      </div>
    );
  }
);

export default VideoPlayer;
