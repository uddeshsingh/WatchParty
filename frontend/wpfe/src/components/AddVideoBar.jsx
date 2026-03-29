import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaSearch, FaFilm } from "react-icons/fa";
import { API_URL } from "./Config";

const TMDB_IMG = "https://image.tmdb.org/t/p/w92";

const AddVideoBar = ({
  room,
  onVideoAdded,
  isHost,
  onRecommend,
}) => {
  const [searchMode, setSearchMode] = useState("youtube");
  const [query, setQuery] = useState("");
  const [ytResults, setYtResults] = useState([]);
  const [tmdbResults, setTmdbResults] = useState([]);
  const [tmdbUnavailable, setTmdbUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.includes("http")) {
      setYtResults([]);
      setTmdbResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      if (searchMode === "youtube") {
        try {
          const res = await axios.get(
            `https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(query)}`,
          );
          setYtResults(res.data.slice(0, 5));
        } catch (err) {
          console.error("Search failed", err);
        }
        return;
      }
      try {
        setTmdbUnavailable(false);
        const res = await axios.get(`${API_URL}/api/tmdb/search`, {
          params: { q: query.trim() },
        });
        setTmdbResults((res.data || []).slice(0, 8));
      } catch (err) {
        console.error("TMDB search failed", err);
        setTmdbResults([]);
        setTmdbUnavailable(true);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [query, searchMode]);

  const handleAddUrl = async (videoUrl) => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/videos/add`, { url: videoUrl, room });
      setQuery("");
      setYtResults([]);
      if (onVideoAdded) onVideoAdded();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : err.message || "Failed to add video.";
      alert(`Failed to add video: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTmdb = async (item) => {
    const thumb = item.poster_path
      ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
      : undefined;
    const body = {
      room,
      tmdb_id: item.tmdb_id,
      media_type: item.media_type,
      title: item.title,
      thumbnail: thumb,
      ...(item.media_type === "tv"
        ? { season: 1, episode: 1 }
        : {}),
    };
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/videos/add`, body);
      setQuery("");
      setTmdbResults([]);
      if (onVideoAdded) onVideoAdded();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : err.message || "Failed to add video.";
      alert(`Failed to add video: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendTmdb = (item) => {
    const poster = item.poster_path
      ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
      : "";
    onRecommend?.({
      tmdb_id: item.tmdb_id,
      media_type: item.media_type,
      title: item.title,
      poster,
      season: item.media_type === "tv" ? 1 : undefined,
      episode: item.media_type === "tv" ? 1 : undefined,
    });
    setQuery("");
    setTmdbResults([]);
  };

  return (
    <div className="add-video-container" style={{ position: "relative" }}>
      <div className="add-video-mode-tabs">
        <button
          type="button"
          className={`mode-tab ${searchMode === "youtube" ? "active" : ""}`}
          onClick={() => {
            setSearchMode("youtube");
            setTmdbResults([]);
          }}
        >
          YouTube
        </button>
        <button
          type="button"
          className={`mode-tab ${searchMode === "tmdb" ? "active" : ""}`}
          onClick={() => {
            setSearchMode("tmdb");
            setYtResults([]);
          }}
        >
          <FaFilm style={{ marginRight: 6 }} />
          Movies / TV
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.includes("http")) handleAddUrl(query);
        }}
        className="add-video-form"
      >
        <input
          type="text"
          placeholder={
            searchMode === "youtube"
              ? "Search YouTube or paste URL..."
              : "Search TMDB (movies & TV)..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="add-video-input"
        />
        <button
          type="submit"
          disabled={loading}
          className="add-video-btn"
          aria-label="Add Video"
        >
          {loading
            ? "..."
            : query.includes("http")
              ? <FaPlus />
              : <FaSearch />}
        </button>
      </form>

      {searchMode === "youtube" && ytResults.length > 0 && (
        <div className="search-results-dropdown">
          {ytResults.map((v) => (
            <div
              key={v.videoId}
              role="button"
              tabIndex={0}
              onClick={() =>
                handleAddUrl(`https://www.youtube.com/watch?v=${v.videoId}`)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  handleAddUrl(`https://www.youtube.com/watch?v=${v.videoId}`);
              }}
              className="search-result-row"
            >
              <img src={v.videoThumbnails[0]?.url} alt="" width="50" />
              <div className="search-result-title">{v.title}</div>
            </div>
          ))}
        </div>
      )}

      {searchMode === "tmdb" && tmdbUnavailable && (
        <div className="tmdb-unavailable">Search unavailable (check TMDB API).</div>
      )}

      {searchMode === "tmdb" && tmdbResults.length > 0 && (
        <div className="search-results-dropdown">
          {tmdbResults.map((item) => (
            <div
              key={`${item.media_type}-${item.tmdb_id}`}
              role="button"
              tabIndex={0}
              className="search-result-row"
              onClick={() =>
                isHost ? handleAddTmdb(item) : handleRecommendTmdb(item)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (isHost) handleAddTmdb(item);
                  else handleRecommendTmdb(item);
                }
              }}
            >
              {item.poster_path ? (
                <img src={`${TMDB_IMG}${item.poster_path}`} alt="" width="40" />
              ) : (
                <div className="tmdb-poster-placeholder" />
              )}
              <div className="search-result-title">
                <span className="tmdb-type-badge">{item.media_type}</span>
                {item.title}
                {item.media_type === "tv" && (
                  <span className="tmdb-tv-hint"> (S1E1)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddVideoBar;
