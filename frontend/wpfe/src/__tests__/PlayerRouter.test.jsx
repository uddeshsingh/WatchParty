import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlayerRouter from "../components/PlayerRouter";

vi.mock("../components/VideoPlayer", () => ({
  default: vi.fn(() => <div data-testid="react-player-mock" />),
}));

vi.mock("../components/EmbedPlayer", () => ({
  default: vi.fn(() => <iframe data-testid="embed-iframe-mock" title="e" />),
}));

describe("PlayerRouter", () => {
  it("uses react-player for YouTube-style rows (no tmdb_id)", () => {
    render(
      <PlayerRouter
        currentVideo={{
          id: 1,
          title: "Y",
          video_url: "https://www.youtube.com/watch?v=abc",
          room: "r",
        }}
        playing
        isHost
        playerRef={{ current: null }}
        providerKey="videasy"
        providerVersion={0}
        embedStartSeconds={0}
      />,
    );
    expect(screen.getByTestId("react-player-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("embed-iframe-mock")).toBeNull();
  });

  it("uses EmbedPlayer when tmdb_id is set", () => {
    render(
      <PlayerRouter
        currentVideo={{
          id: 2,
          title: "Movie",
          video_url: "tmdb://movie/1",
          room: "r",
          tmdb_id: 1,
          media_type: "movie",
        }}
        playing
        isHost
        playerRef={{ current: null }}
        providerKey="videasy"
        providerVersion={0}
        embedStartSeconds={0}
      />,
    );
    expect(screen.getByTestId("embed-iframe-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("react-player-mock")).toBeNull();
  });
});
