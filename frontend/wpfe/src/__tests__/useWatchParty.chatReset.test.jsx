import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { useWatchParty } from "../hooks/useWatchParty";

vi.mock("axios");

describe("useWatchParty — room-scoped chat", () => {
  let latestWs;

  beforeEach(() => {
    localStorage.setItem("watchparty_token", "jwt");
    axios.get.mockResolvedValue({ data: [] });
    latestWs = null;
    vi.stubGlobal(
      "WebSocket",
      vi.fn(function MockWebSocket() {
        const ws = {
          readyState: 1,
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onmessage: null,
          onclose: null,
        };
        latestWs = ws;
        queueMicrotask(() => ws.onopen?.({}));
        return ws;
      }),
    );
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("clears messages when room id changes", async () => {
    const { result, rerender } = renderHook(
      ({ roomId }) => useWatchParty(roomId, "join"),
      { initialProps: { roomId: "alpha" } },
    );

    await act(async () => {
      result.current.setUsername("alice");
    });

    await waitFor(() => {
      expect(latestWs).toBeTruthy();
      expect(latestWs.send).toHaveBeenCalled();
    });

    await act(async () => {
      latestWs.onmessage({
        data: JSON.stringify({
          type: "chat",
          username: "bob",
          content: "only-in-alpha",
        }),
      });
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("only-in-alpha");

    rerender({ roomId: "beta" });

    await waitFor(() => {
      expect(result.current.room).toBe("beta");
      expect(result.current.messages).toHaveLength(0);
    });
  });
});
