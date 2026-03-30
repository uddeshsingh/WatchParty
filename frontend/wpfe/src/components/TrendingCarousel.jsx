import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "./Config";

// #region agent log
function agentDebugLog(location, message, data, hypothesisId) {
  if (!import.meta.env.DEV) return;
  fetch("http://127.0.0.1:7859/ingest/4626e31c-52ce-43de-9f4c-5482f6247f78", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "fc90b6",
    },
    body: JSON.stringify({
      sessionId: "fc90b6",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId: "pre-fix",
    }),
  }).catch(() => {});
}
// #endregion

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

function randomRoomSlug(prefix) {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${n}`;
}

const TrendingCarousel = ({ onPickTmdb, onPickYoutube }) => {
  const [tmdb, setTmdb] = useState([]);
  const [yt, setYt] = useState([]);
  const [tmdbErr, setTmdbErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/tmdb/trending`, {
          params: { window: "day" },
        });
        agentDebugLog(
          "TrendingCarousel.jsx:tmdb",
          "tmdb trending ok",
          { apiUrl: API_URL, count: (res.data || []).length },
          "H3",
        );
        if (!cancelled) setTmdb((res.data || []).slice(0, 12));
      } catch (err) {
        agentDebugLog(
          "TrendingCarousel.jsx:tmdb",
          "tmdb trending failed",
          {
            apiUrl: API_URL,
            hasToken: !!localStorage.getItem("watchparty_token"),
            status: err.response?.status,
            code: err.code,
            msg: String(err.message || err),
          },
          "H1-H3-H4",
        );
        if (!cancelled) {
          setTmdb([]);
          setTmdbErr(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/youtube/trending`);
        const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
        agentDebugLog(
          "TrendingCarousel.jsx:puffyan",
          "puffyan ok",
          { count: list.length },
          "H5",
        );
        if (!cancelled) setYt(list.slice(0, 12));
      } catch (err) {
        agentDebugLog(
          "TrendingCarousel.jsx:puffyan",
          "puffyan failed",
          {
            status: err.response?.status,
            code: err.code,
            msg: String(err.message || err),
          },
          "H5",
        );
        if (!cancelled) setYt([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="trending-sections">
      <section className="trending-row">
        <div className="trending-row-head">
          <h3 className="trending-heading">TMDB</h3>
          <span className="trending-badge">Movies &amp; TV</span>
        </div>
        {tmdbErr && (
          <p className="trending-hint">Trending list unavailable—try search inside a room.</p>
        )}
        <div className="trending-scroll">
          {tmdb.map((item) => (
            <button
              key={`${item.media_type}-${item.tmdb_id}`}
              type="button"
              className="trending-card"
              onClick={() =>
                onPickTmdb({
                  slug: randomRoomSlug("watch"),
                  preload: {
                    tmdb_id: item.tmdb_id,
                    media_type: item.media_type,
                    title: item.title,
                    thumbnail: item.poster_path
                      ? `${TMDB_IMG}${item.poster_path}`
                      : undefined,
                    season: item.media_type === "tv" ? 1 : undefined,
                    episode: item.media_type === "tv" ? 1 : undefined,
                  },
                })
              }
            >
              {item.poster_path ? (
                <img src={`${TMDB_IMG}${item.poster_path}`} alt="" />
              ) : (
                <div className="trending-card-placeholder">{item.title}</div>
              )}
              <span className="trending-card-title">{item.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="trending-row">
        <div className="trending-row-head">
          <h3 className="trending-heading">YouTube</h3>
          <span className="trending-badge trending-badge--yt">Trailers &amp; clips</span>
        </div>
        <div className="trending-scroll">
          {yt.map((v) => (
            <button
              key={v.videoId || v.id}
              type="button"
              className="trending-card"
              onClick={() => {
                const id = v.videoId || v.id;
                const url = `https://www.youtube.com/watch?v=${id}`;
                onPickYoutube({
                  slug: randomRoomSlug("party"),
                  preload: { youtubeUrl: url },
                });
              }}
            >
              <img
                src={
                  v.videoThumbnails?.[0]?.url ||
                  v.thumbnail ||
                  `https://i.ytimg.com/vi/${v.videoId || v.id}/mqdefault.jpg`
                }
                alt=""
              />
              <span className="trending-card-title">
                {v.title || v.name || "Video"}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TrendingCarousel;
