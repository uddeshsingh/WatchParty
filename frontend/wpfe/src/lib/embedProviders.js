/** Videasy / VidLink / VidFast iframe embed configuration (TMDB-backed). */

export const PROVIDERS = {
  videasy: {
    key: "videasy",
    name: "Videasy",
    origin: "https://player.videasy.net",
    movie: (id) => `https://player.videasy.net/movie/${id}`,
    tv: (id, s, e) => `https://player.videasy.net/tv/${id}/${s}/${e}`,
    params: { color: "8B5CF6" },
    startParam: "progress", // seconds
  },
  vidlink: {
    key: "vidlink",
    name: "VidLink",
    origin: "https://vidlink.pro",
    movie: (id) => `https://vidlink.pro/movie/${id}`,
    tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
    params: { primaryColor: "8B5CF6", autoplay: "true" },
    startParam: "startAt",
  },
  vidfast: {
    key: "vidfast",
    name: "VidFast",
    origin: "https://vidfast.pro",
    movie: (id) => `https://vidfast.pro/movie/${id}`,
    tv: (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}`,
    params: { theme: "8B5CF6", autoPlay: "true" },
    startParam: "startAt",
  },
};

export const ALLOWED_EMBED_ORIGINS = new Set(
  Object.values(PROVIDERS).map((p) => p.origin),
);

export function buildEmbedUrl(providerKey, video, startSeconds = 0) {
  const p = PROVIDERS[providerKey] || PROVIDERS.videasy;
  const base =
    video.media_type === "tv"
      ? p.tv(video.tmdb_id, video.season, video.episode)
      : p.movie(video.tmdb_id);
  const u = new URL(base);
  Object.entries(p.params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  const sec = Math.max(0, Math.floor(startSeconds || 0));
  if (sec > 0 && p.startParam) {
    u.searchParams.set(p.startParam, String(sec));
  }
  return u.toString();
}

/**
 * Normalize postMessage payloads from supported players.
 * @returns {{ type: string, currentTime: number, duration: number } | null}
 */
export function normalizeEmbedMessage(event) {
  if (!ALLOWED_EMBED_ORIGINS.has(event.origin)) {
    return null;
  }
  let data = event.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") {
    return null;
  }
  if (data.type === "PLAYER_EVENT" && data.data) {
    const d = data.data;
    const ev = d.event;
    if (!ev) return null;
    return {
      type: ev,
      currentTime: Number(d.currentTime) || 0,
      duration: Number(d.duration) || 0,
    };
  }
  if (
    typeof data.timestamp === "number" &&
    (data.type === "movie" || data.type === "tv")
  ) {
    return {
      type: "timeupdate",
      currentTime: data.timestamp,
      duration: Number(data.duration) || 0,
    };
  }
  if (typeof data.currentTime === "number" && data.type) {
    return {
      type: String(data.type),
      currentTime: data.currentTime,
      duration: Number(data.duration) || 0,
    };
  }
  return null;
}
