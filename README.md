# [WatchParty](https://watchparty-482106.web.app/)

**WatchParty** is a real-time collaborative video streaming platform that allows users to watch videos together in perfect sync. Whether you're hosting a movie night or sharing a playlist with friends, WatchParty keeps everyone on the same second of the video while offering live chat and interactive features.

## Features

* **Real-Time Video Sync:** Play, pause, and seek events are synchronized instantly across all connected clients.
* **Multiple Sources:** Supports YouTube, Vimeo, SoundCloud, Twitch, and more (via `react-player`).
* **Live Chat:** Real-time messaging with **Typing Indicators** ("Alice is typing...").
* **Room System:** Create private rooms or join the general lobby.
* **Host Privileges:**
* The room creator (or assigned Host) controls the playback.
* Host can grant/revoke control to other users.


* **Collaborative Playlist:** Users can add videos to a shared queue.
* **User Management:** Live list of online users with visual badges for Hosts.
* **Authentication:** Google OAuth integration and custom JWT authentication.
* **Responsive Design:** Fully optimized for Desktop, Tablet, and Mobile devices.

## 🛠 Tech Stack

### **Frontend**

* **Framework:** React (Vite)
* **Styling:** Custom CSS with CSS Variables (Dark Theme)
* **State/API:** Axios, React Hooks
* **WebSocket:** Native `WebSocket` API for low-latency communication

### **Backend (Real-Time)**

* **Language:** Go (Golang)
* **Library:** `gorilla/websocket`
* **Role:** Handles ephemeral state, broadcasting sync events, chat, and typing signals.

### **Backend (API)**

* **Framework:** Django (Python)
* **Database:** PostgreSQL (Production) / SQLite (Dev)
* **Role:** Handles user authentication, video metadata persistence, and room management.

### **DevOps & Deployment**

* **Frontend:** Firebase Hosting
* **Backends:** Google Cloud Run (Containerized)
* **CI/CD:** GitHub Actions

---

## Getting Started

Follow these instructions to set up the project locally.

### **Prerequisites**

* Node.js (v18+)
* Go (v1.20+)
* Python (v3.10+)
* Docker (Optional, for containerized run)

### **1. Clone the Repository**

```bash
git clone https://github.com/yourusername/WatchParty.git
cd WatchParty

```

### **2. Setup Backend (API - Django)**

This service handles authentication and the database.

```bash
cd backend-python
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations & start server
python manage.py migrate
python manage.py runserver 0.0.0.0:8000

```

### **3. Setup Backend (Real-Time - Go)**

This service handles the WebSockets.

```bash
# Open a new terminal
cd backend-go

# Run the server
go run .
# Server will start on localhost:8080

```

### **4. Setup Frontend (React)**

The user interface.

```bash
# Open a new terminal
cd frontend/wpfe

# Install dependencies
npm install

# Start Development Server
npm run dev

```

Visit `http://localhost:5173` in your browser.

---

## ⚙️ Configuration

### **Frontend Variables (`.env.local`)**

Create a `.env` file in `frontend/wpfe` if you need to override defaults:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8080

```

### **Backend Variables**

Ensure your Django `settings.py` allows CORS for your frontend URL.

---

## Contributing

Contributions are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 📞 Contact

**Your Name** - [uddeshsingh@gmail.com](mailto:uddeshsingh@gmail.com)

Project Link: [Live](https://watchparty-482106.web.app/)
