import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { FaVolumeUp, FaVolumeMute, FaExpand, FaSync } from "react-icons/fa";
import screenfull from "screenfull";
import {
  PROVIDERS,
  ALLOWED_EMBED_ORIGINS,
  buildEmbedUrl,
  normalizeEmbedMessage,
} from "../lib/embedProviders";

const GuestControls = ({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  playing,
  onResync,
}) => (
  <div className="custom-controls">
    <div className="controls-text">
      {playing ? "▶ Synced with host" : "⏸ Paused (host)"}
    </div>
    <button
      type="button"
      onClick={onResync}
      className="controls-icon-btn"
      title="Re-sync playback position"
    >
      <FaSync />
    </button>
    <button type="button" onClick={onToggleMute} className="controls-icon-btn">
      {muted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
    </button>
    <input
      type="range"
      min={0}
      max={1}
      step="0.1"
      value={muted ? 0 : volume}
      onChange={onVolumeChange}
      className="volume-slider"
    />
    <button
      type="button"
      onClick={onToggleFullscreen}
      className="controls-icon-btn"
    >
      <FaExpand />
    </button>
  </div>
);

const EmbedPlayer = forwardRef(
  (
    {
      video,
      providerKey,
      playing,
      isHost,
      onReady,
      onPlay,
      onPause,
      onSeek,
      onEnded,
      embedStartSeconds = 0,
      providerVersion = 0,
      onSwitchProvider,
      onGuestResync,
    },
    ref,
  ) => {
    const iframeRef = useRef(null);
    const wrapperRef = useRef(null);
    const lastTimeRef = useRef(0);
    const providerVersionRef = useRef(providerVersion);
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    /** When set, iframe reloads at this start position (guest sync / seek). */
    const [startOverride, setStartOverride] = useState(null);
    const loadTimerRef = useRef(null);

    useEffect(() => {
      providerVersionRef.current = providerVersion;
    }, [providerVersion]);

    useEffect(() => {
      setStartOverride(null);
    }, [video?.id, providerKey, providerVersion]);

    const startSeconds =
      startOverride !== null ? startOverride : embedStartSeconds || 0;
    const src = buildEmbedUrl(providerKey, video, startSeconds);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => lastTimeRef.current,
      seekTo: (seconds) => {
        const s = Math.max(0, Number(seconds) || 0);
        lastTimeRef.current = s;
        setStartOverride(s);
        setIframeKey((k) => k + 1);
      },
    }));

    useEffect(() => {
      setLoadError(false);
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      loadTimerRef.current = setTimeout(() => {
        setLoadError(true);
      }, 10000);
      return () => {
        if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      };
    }, [src, iframeKey, providerKey]);

    useEffect(() => {
      const onMsg = (event) => {
        if (!ALLOWED_EMBED_ORIGINS.has(event.origin)) return;
        const normalized = normalizeEmbedMessage(event);
        if (!normalized) return;
        if (providerVersionRef.current !== providerVersion) return;
        lastTimeRef.current = normalized.currentTime;
        if (loadTimerRef.current) {
          clearTimeout(loadTimerRef.current);
          loadTimerRef.current = null;
        }
        setLoadError(false);
        if (!isHost) return;
        const t = normalized.currentTime;
        switch (normalized.type) {
          case "play":
            if (onPlay) onPlay(t);
            break;
          case "pause":
            if (onPause) onPause(t);
            break;
          case "seeked":
          case "seek":
            if (onSeek) onSeek(t);
            break;
          case "ended":
            if (onEnded) onEnded();
            break;
          case "timeupdate":
            break;
          default:
            break;
        }
      };
      window.addEventListener("message", onMsg);
      return () => window.removeEventListener("message", onMsg);
    }, [
      isHost,
      onPlay,
      onPause,
      onSeek,
      onEnded,
      providerVersion,
    ]);

    const handleIframeLoad = () => {
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
      if (onReady) onReady();
    };

    const toggleFullscreen = () => {
      if (screenfull.isEnabled && wrapperRef.current) {
        screenfull.toggle(wrapperRef.current);
      }
    };

    const handleResync = () => {
      if (onGuestResync) {
        onGuestResync();
      } else {
        setIframeKey((k) => k + 1);
      }
    };

    const otherProviders = Object.keys(PROVIDERS).filter((k) => k !== providerKey);

    if (loadError) {
      return (
        <div className="embed-fallback" ref={wrapperRef}>
          <p>Stream unavailable — try another video host.</p>
          <div className="embed-fallback-actions">
            {otherProviders.map((k) => (
              <button
                key={k}
                type="button"
                className="nav-btn"
                onClick={() => onSwitchProvider && onSwitchProvider(k)}
              >
                Use {PROVIDERS[k].name}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="player-wrapper embed-player-wrapper" ref={wrapperRef}>
        {!isHost && <div className="blocker-overlay" />}
        <iframe
          key={`${iframeKey}-${providerKey}-${providerVersion}`}
          ref={iframeRef}
          title={video.title || "Video"}
          src={src}
          className="embed-iframe"
          sandbox="allow-scripts allow-same-origin allow-fullscreen"
          allow="encrypted-media; fullscreen"
          onLoad={handleIframeLoad}
        />
        {!isHost && (
          <GuestControls
            playing={playing}
            volume={volume}
            muted={muted}
            onVolumeChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              setMuted(v === 0);
            }}
            onToggleMute={() => {
              if (muted) {
                setVolume(0.8);
                setMuted(false);
              } else {
                setMuted(true);
              }
            }}
            onToggleFullscreen={toggleFullscreen}
            onResync={handleResync}
          />
        )}
      </div>
    );
  },
);

EmbedPlayer.displayName = "EmbedPlayer";

export default EmbedPlayer;
