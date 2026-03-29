import { describe, it, expect } from "vitest";
import {
  buildEmbedUrl,
  normalizeEmbedMessage,
  ALLOWED_EMBED_ORIGINS,
} from "../lib/embedProviders";

describe("embedProviders", () => {
  it("buildEmbedUrl for movie includes theme params", () => {
    const url = buildEmbedUrl(
      "vidlink",
      { tmdb_id: 99, media_type: "movie", title: "X" },
      30,
    );
    expect(url).toContain("vidlink.pro/movie/99");
    expect(url).toContain("startAt=30");
  });

  it("buildEmbedUrl for tv uses season episode", () => {
    const url = buildEmbedUrl(
      "videasy",
      {
        tmdb_id: 10,
        media_type: "tv",
        season: 2,
        episode: 3,
        title: "S",
      },
      0,
    );
    expect(url).toContain("/tv/10/2/3");
  });

  it("normalizeEmbedMessage rejects unknown origin", () => {
    const ev = { origin: "https://evil.com", data: { type: "PLAYER_EVENT" } };
    expect(normalizeEmbedMessage(ev)).toBeNull();
  });

  it("normalizeEmbedMessage parses VidLink PLAYER_EVENT", () => {
    const ev = {
      origin: "https://vidlink.pro",
      data: {
        type: "PLAYER_EVENT",
        data: {
          event: "pause",
          currentTime: 12,
          duration: 100,
        },
      },
    };
    const n = normalizeEmbedMessage(ev);
    expect(n.type).toBe("pause");
    expect(n.currentTime).toBe(12);
  });

  it("ALLOWED_EMBED_ORIGINS contains three hosts", () => {
    expect(ALLOWED_EMBED_ORIGINS.size).toBe(3);
  });
});
