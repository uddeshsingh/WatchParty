import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  const [user, setUser] = useState(() => {
      return localStorage.getItem('watchparty_user')
  })

  const handleLogout = () => {
      localStorage.removeItem('watchparty_user')
      setUser(null)
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Route 1: Login Page */}
        <Route path="/login" element={
            !user ? <LoginPage onLogin={setUser} /> : <Navigate to="/" />
        } />

        {/* Route 2: Protected Dashboard */}
        <Route path="/*" element={
            user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App