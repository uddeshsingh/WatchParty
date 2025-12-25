const isProduction = import.meta.env.PROD;

// 2. Get current location details
const protocol = window.location.protocol; // "http:" or "https:"
const hostname = window.location.hostname; // e.g. "192.168.1.5" or "myapp.com"
const isSecure = protocol === 'https:';

let API_URL, WS_URL;

if (isProduction) {
    // IN PRODUCTION: Use the Environment Variables defined in your .env file
    // You will set these in Google Cloud / Vercel later.
    API_URL = import.meta.env.VITE_API_URL;
    WS_URL = import.meta.env.VITE_WS_URL;
} else {
    // IN DEVELOPMENT: Auto-detect the backend on the same LAN
    const httpProto = isSecure ? 'https' : 'http';
    const wsProto = isSecure ? 'wss' : 'ws';
    
    // We assume Backend (Django) is on :8000 and Go is on :8080
    API_URL = `${httpProto}://${hostname}:8000`;
    WS_URL = `${wsProto}://${hostname}:8080`;
}

// Check if URLs are undefined (helps debugging in Prod)
if (!API_URL) console.warn("⚠️ API_URL is missing! Check .env variables.");

export { API_URL, WS_URL };