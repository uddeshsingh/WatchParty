import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddVideoBar from "../components/AddVideoBar";
import axios from "axios";

vi.mock("axios");

describe("AddVideoBar TMDB tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches to Movies/TV mode and shows TMDB placeholder", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/api/tmdb/search")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });
    render(
      <AddVideoBar room="r" isHost onRecommend={vi.fn()} onVideoAdded={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Movies \/ TV/i }));
    const input = screen.getByPlaceholderText(/Search TMDB/i);
    fireEvent.change(input, { target: { value: "matrix" } });
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });
  });
});
