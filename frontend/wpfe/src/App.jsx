// src/App.jsx
import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom"; // <--- Import useLocation
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import "./App.css";

// 1. Create a Helper Component for Protection
const RequireAuth = ({ children, user }) => {
  const location = useLocation();
  if (!user) {
    // Redirect to Login, but remember where we were trying to go!
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

function App() {
  const [user, setUser] = useState(() =>
    localStorage.getItem("watchparty_user")
  );

  const handleLogout = () => {
    localStorage.removeItem("watchparty_user");
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Login Route */}
        <Route
          path="/login"
          element={
            !user ? <LoginPage onLogin={setUser} /> : <Navigate to="/" />
          }
        />

        {/* Route A: The Lobby (No Room ID) */}
        <Route
          path="/"
          element={
            <RequireAuth user={user}>
              <Dashboard user={user} onLogout={handleLogout} />
            </RequireAuth>
          }
        />

        {/* Route B: Specific Room (With ID) */}
        <Route
          path="/room/:roomId"
          element={
            <RequireAuth user={user}>
              <Dashboard user={user} onLogout={handleLogout} />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
