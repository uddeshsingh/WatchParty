import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RecommendationPanel from "../components/RecommendationPanel";
import axios from "axios";

vi.mock("axios");

describe("RecommendationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps visible list via parent state; dismiss removes item", () => {
    const onDismiss = vi.fn();
    const recs = [
      {
        id: "a",
        from: "bob",
        data: { title: "T1", tmdb_id: 1, media_type: "movie" },
      },
    ];
    render(
      <RecommendationPanel
        room="r1"
        recommendations={recs}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByTitle("Video recommendations"));
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledWith("a");
  });
});
