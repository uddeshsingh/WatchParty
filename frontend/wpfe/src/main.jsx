import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId="274181282324-9c82amhm2ogob1qlb112ndu3mkdlorfa.apps.googleusercontent.com">
      <StrictMode>
        <App />
      </StrictMode>
  </GoogleOAuthProvider>,
)
