import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "../App";

describe("App logout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("alert", vi.fn());
  });

  it("clears watchparty_user and watchparty_token from localStorage", () => {
    localStorage.setItem("watchparty_user", "Tester");
    localStorage.setItem("watchparty_token", "secret-token");

    render(
      <GoogleOAuthProvider clientId="test-client-id">
        <App />
      </GoogleOAuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(localStorage.getItem("watchparty_user")).toBeNull();
    expect(localStorage.getItem("watchparty_token")).toBeNull();
  });
});
