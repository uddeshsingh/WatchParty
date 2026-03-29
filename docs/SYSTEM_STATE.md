# WatchParty Living Architecture State
*Auto-updated by AI. Do not manually edit unless correcting a hallucination.*

## Locked Core Services
*These services are foundational. You may read their schemas and connect to them, but NEVER modify them unless explicitly instructed.*
- **Database Connection (`backend-python/app/repository/database.py`)**: Supabase (PostgreSQL) configuration via SQLAlchemy.
- **WebSocket Hub (`backend-go/internal/service/room_manager.go`)**: Go room state management and concurrency controls using Redis.
- **Message Broker (`backend-go/internal/pubsub/` & Python `app/pubsub/`)**: Primary transport is Google Cloud Pub/Sub (`watchparty-events` topic); Go falls back to in-memory `LocalBus` when Pub/Sub initialization fails.

## Global Data Models (Core Entities)
- **`UserModel`** (`backend-python/app/repository/models.py`): Managed by Python API. Fields: `id`, `username`, `email` (nullable), `hashed_password`, `created_at`. Password hashing/verification is implemented in `backend-python/app/api/auth.py`.
- **`VideoModel`** (`backend-python/app/repository/models.py`): Stored in PostgreSQL. Fields: `id`, `title`, `video_url`, `thumbnail` (nullable), `room` (default `"general"`), `uploaded_at`.
- **`domain.Message`** (`backend-go/internal/domain/types.go`): The single unified Go struct handling all WebSocket inbound/outbound payloads. Fields: `Type`, `Username`, `UserID`, `Content`, `Timestamp` (float64), `VideoID` (int), `Room`, `IsHost`, `UserList` ([]UserSummary, omitempty), `Data` (interface{}, omitempty).
- **`domain.RoomState`** (`backend-go/internal/domain/types.go`): Redis-persisted room state. Fields: `VideoID` (int), `Timestamp` (float64), `Playing` (bool), `LastUpdated` (time.Time), `Clients` (map[string]UserSummary).
- **`domain.RoomSummary`** (`backend-go/internal/domain/types.go`): Room listing payload. Fields: `Name` (string), `Count` (int), `VideoID` (int).
- **`PubSubMessage`** (`backend-python/app/domain/schemas.py`): Pydantic model for cross-service Pub/Sub messages. Fields: `type`, `username`, `user_id`, `content`, `timestamp`, `video_id`, `room`, `is_host`, `data` (optional dict).

---

## Python Backend (FastAPI - Port 8000)
*Primary source of truth: Pydantic schemas in `backend-python/app/domain/schemas.py`; note that `GoogleAuth` is currently defined inline in `backend-python/app/api/auth.py`.*

### Active Routes & Core Functions
| Feature | Method & Endpoint | Input Schema/Params | Output Schema | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **Register** | `POST /api/auth/registration/` | `UserCreate` | `AuthResponse` | DB |
| **Login** | `POST /api/auth/login/` | `UserLogin` | `AuthResponse` | DB, bcrypt |
| **SSO Login** | `POST /api/auth/google/` | `GoogleAuth` (`backend-python/app/api/auth.py`) | `AuthResponse` | Google OAuth |
| **Add Video** | `POST /api/videos/add` | `VideoCreateReq` | `VideoResponse` | DB, Scraper, PubSub |
| **List Videos** | `GET /api/videos` | Query: `room` (default `"general"`) | `List[VideoResponse]`| DB |
| **Bulk Meta** | `POST /api/videos/metadata` | `MetadataReq` | `List[VideoResponse]`| DB |
| **Delete** | `DELETE /api/videos/{video_id}`| Path: `video_id`, Query: `room` (required) | `{"status": "deleted"}` | DB, PubSub |

### Pub/Sub Listener (Background)
| Behavior | Trigger | Action | Dependencies |
| :--- | :--- | :--- | :--- |
| **Room Cleanup** | Receives `room_empty` event from Go backend via Pub/Sub | Calls `VideoService.clear_room_playlist(room)` → `VideoRepoImpl.delete_videos_by_room(room)` | DB, Pub/Sub |

---

## Go Backend (WebSockets & HTTP - Port 8080)
*Source of Truth: Go structs in `backend-go/internal/domain/types.go` and behavior in `backend-go/internal/service/room_manager.go` / `backend-go/internal/handlers/websockets.go`.*

### Configuration
| Variable | Role | Notes |
| :--- | :--- | :--- |
| `REDIS_ADDR` | Redis / Upstash endpoint | Default `localhost:6379` (bare `host:port`). Production typically uses `rediss://…` URLs. Unsupported schemes (e.g. `http://`) are rejected. |
| `GCP_PROJECT_ID` | Pub/Sub project | Default in server `main.go` is `watchparty-482106`; integration tests use this env when set (CI uses `test-project` with the emulator). |
| `PORT` | HTTP listen port | Default `8080`. |
| `JWT_SECRET` | WS JWT verification | Parsed in `handlers.WebSocketHandler`; empty falls back to a dev default. |

### Testing
| Suite | Command | Dependencies |
| :--- | :--- | :--- |
| Unit + repository mocks | `go test ./...` | None (no live Redis). |
| Live integration | `go test -tags=integration ./...` | Redis reachable at `redis://localhost:6379` (or set `REDIS_ADDR`), GCP Pub/Sub or `PUBSUB_EMULATOR_HOST`; GitHub Actions runs this with Redis service + emulator. |

### HTTP Routes
| Feature | Method & Endpoint | Input | Output | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **List Rooms** | `GET /rooms` (and `/api/v1/rooms`) | None | `[]domain.RoomSummary` (`{name, count, video_id}`) | RoomManager |
| **Health** | `GET /health` | None | `{"status":"healthy"}` | None |

### WebSocket Connection (`/ws`)
*Query params:* `?room={id}&action={join/create}&token={jwt}` — `room` defaults to `"general"`, `action` defaults to `"join"`. JWT `sub` is parsed using `JWT_SECRET`; the current handler rejects missing/invalid subjects but does not explicitly enforce a signing method check.

### Inbound WebSocket Events (Client → Server)
| Action Category | Event Types (`msg.Type`) | Handler | Effect |
| :--- | :--- | :--- | :--- |
| **Keepalive** | `ping` | No-op (silently consumed) | Prevents connection timeout |
| **Video Sync** | `play`, `pause`, `seek`, `sync_state` | `HandleVideoCommand` | Updates `RoomState` in Redis, publishes via EventBus |
| **Queue Mgmt** | `change_video` | `HandleChangeVideo` | Sets new `VideoID`, `Playing=true` in Redis, publishes via EventBus |
| **Social** | `chat`, `reaction`, `typing`, `new_video` | `PublishDirectEvent` | Direct pass-through publish via EventBus |
| **Permissions** | `grant_control`, `revoke_control` | `HandleHostChange` | Updates host flag in `RoomState.Clients`, publishes `host_updated` + `user_list` |

### Outbound WebSocket Events (Server → Client)
| Event Type | Emitted By | Payload Notes |
| :--- | :--- | :--- |
| `identity` | `JoinRoom` | Contains `user_id` and `is_host` for the connecting client |
| `request_sync` | `JoinRoom` | Asks the current host to broadcast playback state |
| `user_list` | `BroadcastUserList` | Contains `user_list` array of `UserSummary` objects |
| `system` | `JoinRoom` / `LeaveRoom` | Content: "X joined the party!" or "X left the party." |
| `host_updated` | `HandleHostChange` | Contains `user_id` of target and new `is_host` status |
| `room_empty` | `LeaveRoom` | Backend integration event published when last client leaves; consumed by Python Pub/Sub listener, not a frontend-facing room event |
| `playlist_updated` | `HandleIncomingPubSubMessage` | Remapped from inbound Pub/Sub `video_added` events |
| `error` | `WebSocketHandler` | Sent on validation failure or join error |
| Pass-through | EventBus subscriber | `play`, `pause`, `seek`, `sync_state`, `change_video`, `chat`, `reaction`, `typing`, `new_video` forwarded to room clients |

---

## Frontend (React/Vite)
*Location:* `frontend/wpfe/src/`

### Core State & Providers
| Hook/Service | Purpose | Inputs/Props | State/Outputs |
| :--- | :--- | :--- | :--- |
| `useWatchParty` | Core WS connection & Room Sync | `urlRoom` (string\|null), `action` (`"join"`\|`"create"`) | `room`, `username`, `isHost`, `userList`, `myID`, `messages`, `videos`, `currentVideo`, `playing`, `playerRef`, `typingUsers`, `lastReaction`, `error`, `setCurrentVideo`, `sendReaction`, `setUsername`, `onReady`, `onPlay`, `onPause`, `onSeek`, `sendMessage`, `toggleHost`, `sendNotification`, `changeVideo`, `sendTypingSignal`, `setRoom`, `onEnded`, `refreshPlaylist` |
| `Config.js` | Environment configuration | None | `API_URL` (Python backend), `WS_URL` (Go backend). Dev: auto-detects `hostname:8000` / `hostname:8080`. Prod: reads `VITE_API_URL`, `VITE_WS_URL`. |

### UI Component Tree
| Component | Purpose | Core Responsibilities |
| :--- | :--- | :--- |
| `App.jsx` | Root Router | Manages authentication boundary (`RequireAuth`) and routing (`/login`, `/`, `/room/:roomId`) |
| `LoginPage.jsx` | Auth UI | Handles standard login/register and Google SSO via Python API |
| `RoomSelector.jsx` | Lobby UI | Fetches active rooms via Go HTTP (`/rooms`), bulk metadata via Python API, allows creation/joining |
| `Dashboard.jsx` | Main Room Layout | Assembles Player, Sidebar, VideoList, AddVideoBar, UserList, and ReactionOverlay |
| `VideoPlayer.jsx` | Media Engine | Mounts `react-player` (YouTube/HTML5), surfaces playback callbacks to the hook layer, and contains inline `GuestControls` for non-host volume/fullscreen |
| `AddVideoBar.jsx` | Queue Input | Searches external video API (`vid.puffyan.us`), submits URLs to Python API (`/api/videos/add`) |
| `VideoList.jsx` | Queue UI | Renders upcoming videos, emits `change_video` events (host-only), handles delete |
| `ChatSidebar.jsx` | Social Panel | Renders chat/system message history, emits `chat` and `typing` events, emoji reaction picker |
| `ReactionOverlay.jsx`| Real-time UI | Displays floating emojis mapped to `reaction` events |
| `UserList.jsx` | Roster UI | Displays active users with host badges, handles `grant_control`/`revoke_control` emissions |

### Unused Components (candidates for removal)
| Component | Original Purpose | Status |
| :--- | :--- | :--- |
| `CustomControls.jsx` | Standalone sync controls | Not imported anywhere; functionality absorbed into `VideoPlayer.jsx` |
| `UsernameModal.jsx` | Username capture fallback | Not imported anywhere; login flow handled by `LoginPage.jsx` |
