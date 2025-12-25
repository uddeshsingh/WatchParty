import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { FaFilm } from "react-icons/fa";
// 1. IMPORT CONFIG
import { API_URL } from "../components/Config";

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);

  const handleSuccess = (username) => {
    localStorage.setItem("watchparty_user", username);
    onLogin(username);
    navigate("/");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    const endpoint = isSignup ? "registration/" : "login/";
    const payload = isSignup
      ? { username, email, password1: password, password2: confirmPassword }
      : { username, password };

    try {
      // 2. USE API_URL
      const res = await axios.post(`${API_URL}/api/auth/${endpoint}`, payload);
      const user = res.data.user || res.data;
      if (user.username || username) handleSuccess(user.username || username);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data
        ? JSON.stringify(err.response.data)
        : "Login failed.";
      setError(msg);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // 3. USE API_URL
      const res = await axios.post(`${API_URL}/api/auth/google/`, {
        access_token: credentialResponse.credential,
      });
      const user = res.data.user || { username: "Google User" };
      handleSuccess(user.username);
    } catch (err) {
      setError("Google Login failed.", err);
    }
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <FaFilm /> <b>WatchParty</b>
      </div>

      <div className="login-card">
        <h2>{isSignup ? "Create Account" : "Welcome Back"}</h2>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="input-field"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          {isSignup && (
            <input
              className="input-field"
              type="email"
              placeholder="Email (Optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            className="input-field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {isSignup && (
            <input
              className="input-field"
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          )}

          <button type="submit" className="btn-primary">
            {isSignup ? "Sign Up" : "Log In"}
          </button>
        </form>

        <div className="divider">— OR —</div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google Login Failed")}
            theme="filled_black"
            shape="pill"
          />
        </div>

        <p className="toggle-link" onClick={() => setIsSignup(!isSignup)}>
          {isSignup
            ? "Already have an account? Login"
            : "New here? Create Account"}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
