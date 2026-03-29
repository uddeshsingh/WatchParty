import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import axios from 'axios';
import './index.css'
import App from './App.jsx'

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('watchparty_token');
  if (token && !config.url?.startsWith('https://vid.puffyan.us')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
if (!googleClientId) {
  console.warn('VITE_GOOGLE_CLIENT_ID is not set. Google SSO will be disabled.');
}

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={googleClientId}>
      <StrictMode>
        <App />
      </StrictMode>
  </GoogleOAuthProvider>,
)
