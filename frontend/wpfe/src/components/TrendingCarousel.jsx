import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "./Config";

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
        if (!cancelled) setTmdb((res.data || []).slice(0, 12));
      } catch {
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
        const res = await axios.get(
          "https://vid.puffyan.us/api/v1/trending?type=movies&region=US",
        );
        const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
        if (!cancelled) setYt(list.slice(0, 12));
      } catch {
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
        <h2 className="trending-heading">Trending on TMDB</h2>
        {tmdbErr && (
          <p className="trending-hint">TMDB trending unavailable.</p>
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
        <h2 className="trending-heading">Trending on YouTube</h2>
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
