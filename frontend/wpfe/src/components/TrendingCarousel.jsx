import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "./Config";

const TMDB_IMG = "https://image.tmdb.org/t/p/w300";

function randomRoomSlug(prefix) {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${n}`;
}

const TrendingCarousel = ({ onPickTmdb }) => {
  const [tmdb, setTmdb] = useState([]);
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
    </div>
  );
};

export default TrendingCarousel;
