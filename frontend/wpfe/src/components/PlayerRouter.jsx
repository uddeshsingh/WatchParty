import React from "react";
import VideoPlayer from "./VideoPlayer";
import EmbedPlayer from "./EmbedPlayer";

/**
 * YouTube / direct URLs → react-player. TMDB-backed rows (tmdb_id set) → iframe embeds.
 */
const PlayerRouter = ({
  currentVideo,
  playing,
  isHost,
  playerRef,
  providerKey,
  providerVersion,
  embedStartSeconds,
  onReady,
  onPlay,
  onPause,
  onSeek,
  onEnded,
  onSwitchProvider,
  onGuestResync,
}) => {
  if (!currentVideo) return null;

  if (currentVideo.tmdb_id != null && currentVideo.media_type) {
    return (
      <EmbedPlayer
        ref={playerRef}
        video={currentVideo}
        providerKey={providerKey}
        playing={playing}
        isHost={isHost}
        onReady={onReady}
        onPlay={onPlay}
        onPause={onPause}
        onSeek={onSeek}
        onEnded={onEnded}
        embedStartSeconds={embedStartSeconds}
        providerVersion={providerVersion}
        onSwitchProvider={onSwitchProvider}
        onGuestResync={onGuestResync}
      />
    );
  }

  return (
    <VideoPlayer
      ref={playerRef}
      url={currentVideo.video_url}
      playing={playing}
      isHost={isHost}
      onReady={onReady}
      onPlay={onPlay}
      onPause={onPause}
      onSeek={onSeek}
      onEnded={onEnded}
    />
  );
};

export default PlayerRouter;
