# WatchParty Living Architecture State
*Auto-updated by AI. Do not manually edit unless correcting a hallucination.*

## Locked Core Services
*These services are foundational. You may read their schemas and connect to them, but NEVER modify them unless explicitly instructed.*
- **Database Connection (`backend-python/app/repository/database.py`)**: Supabase (PostgreSQL) configuration via SQLAlchemy.
- **WebSocket Hub (`backend-go/internal/service/room_manager.go`)**: Go room state management and concurrency controls using Redis.
- **Message Broker (`backend-go/internal/pubsub/` & Python `app/pubsub/`)**: Primary transport is Google Cloud Pub/Sub (`watchparty-events` topic); Go falls back to in-memory `LocalBus` when Pub/Sub initialization fails.

## Global Data Models (Core Entities)
- **`UserModel`** (`backend-python/app/repository/models.py`): Managed by Python API. Fields: `id`, `username`, `email` (nullable), `hashed_password`, `session_id` (nullable; rotated on each login/register/SSO for single active session), `created_at`. Password hashing/verification is implemented in `backend-python/app/api/auth.py`. **Existing PostgreSQL DBs:** apply [`docs/migrations/002_users_session_id.sql`](./migrations/002_users_session_id.sql) once (or equivalent `ALTER TABLE users ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);`). Missing this column causes **500** on any JWT-protected route (`get_current_user` loads `UserModel`).
- **`VideoModel`** (`backend-python/app/repository/models.py`): Stored in PostgreSQL. Fields: `id`, `title`, `video_url`, `thumbnail` (nullable), `room` (default `"general"`), `uploaded_at`, optional TMDB fields `tmdb_id`, `media_type` (`movie`|`tv`), `season`, `episode` (nullable for legacy YouTube rows). TMDB rows use canonical `video_url` values `tmdb://movie/{id}` or `tmdb://tv/{id}/{season}/{episode}` (not third-party stream URLs). **Migration:** [`docs/migrations/001_videos_tmdb_columns.sql`](./migrations/001_videos_tmdb_columns.sql).
- **`domain.Message`** (`backend-go/internal/domain/types.go`): The single unified Go struct handling all WebSocket inbound/outbound payloads. Fields: `Type`, `Username`, `UserID`, `Content`, `Timestamp` (float64), `VideoID` (int), `Room`, `IsHost`, `UserList` ([]UserSummary, omitempty), `Data` (interface{}, omitempty), `Provider` (string, omitempty — embed host key `videasy`|`vidlink`|`vidfast` for `sync_state` / `change_provider` / `identity`).
- **`domain.RoomState`** (`backend-go/internal/domain/types.go`): Redis-persisted room state. Fields: `VideoID` (int), `Timestamp` (float64), `Playing` (bool), `LastUpdated` (time.Time), `Clients` (map[string]UserSummary), `Provider` (string, default `videasy` when empty).
- **`domain.RoomSummary`** (`backend-go/internal/domain/types.go`): Room listing payload. Fields: `Name` (string), `Count` (int), `VideoID` (int).
- **`PubSubMessage`** (`backend-python/app/domain/schemas.py`): Pydantic model for cross-service Pub/Sub messages. Fields: `type`, `username`, `user_id`, `content`, `timestamp`, `video_id`, `room`, `is_host`, `data` (optional dict).

---

## Python Backend (FastAPI - Port 8000)
*Primary source of truth: Pydantic schemas in `backend-python/app/domain/schemas.py`; note that `GoogleAuth` is currently defined inline in `backend-python/app/api/auth.py`.*

### Authentication & Authorization
- **JWT tokens** include `sub` (username), `sid` (session id, matches `UserModel.session_id`), and `exp` (24h TTL). Issued by `create_token()` in `auth.py`. **Single active session:** each successful login/register/Google auth rotates `session_id` and mirrors it to Redis key `wp:sess:{username}` (when `REDIS_ADDR` is set) so the Go WebSocket server can reject stale tokens; prior JWTs return 401 on REST and fail WS auth when Redis holds the new session.
- **`get_current_user`** (`backend-python/app/api/auth.py`): Validates JWT and, if `user.session_id` is set, requires `sid` claim to match (legacy rows with `session_id` NULL still accept old unsigned tokens until the user logs in again).
- **CORS**: Controlled by `ALLOWED_ORIGINS`. Comma-separated origins with `allow_credentials=True`, or set exactly `*` for `Access-Control-Allow-Origin: *` and `allow_credentials=False` (works with JWT in `Authorization`; use for public Cloud Run). Defaults to `http://localhost:5173`. **`EXTRA_ALLOWED_ORIGINS`** (comma-separated) is merged onto any explicit list so deploy can add Firebase Hosting (`https://watchparty-482106.web.app`) without replacing the whole secret. Empty `ALLOWED_ORIGINS` on Cloud Run (`K_SERVICE` set) still defaults to allow-any. Implemented via `resolve_cors_settings()` in `backend-python/app/cors_settings.py`.
- **Google SSO**: Requires `GOOGLE_CLIENT_ID` env var; returns 503 if unset. SSO users get a random `!sso:<hex>` hash as password placeholder (never matches bcrypt verification).

### Active Routes & Core Functions
| Feature | Method & Endpoint | Input Schema/Params | Output Schema | Auth | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Register** | `POST /api/auth/registration/` | `UserCreate` | `AuthResponse` | None | DB |
| **Login** | `POST /api/auth/login/` | `UserLogin` | `AuthResponse` | None | DB, bcrypt |
| **SSO Login** | `POST /api/auth/google/` | `GoogleAuth` (`backend-python/app/api/auth.py`) | `AuthResponse` | None | Google OAuth |
| **Add Video** | `POST /api/videos/add` | `VideoCreateReq` (exactly one of `url` **or** `tmdb_id`; TMDB requires `title`, `media_type`; TV requires `season`/`episode`) | `VideoResponse` | Bearer JWT | DB, Scraper (URL path), PubSub |
| **List Videos** | `GET /api/videos` | Query: `room` (default `"general"`) | `List[VideoResponse]`| Bearer JWT | DB |
| **Bulk Meta** | `POST /api/videos/metadata` | `MetadataReq` | `List[VideoResponse]`| Bearer JWT | VideoService → VideoRepo |
| **Delete** | `DELETE /api/videos/{video_id}`| Path: `video_id`, Query: `room` (required) | `{"status": "deleted"}` | Bearer JWT | VideoService → VideoRepo, PubSub |
| **TMDB Search** | `GET /api/tmdb/search` | Query: `q`, `page` | `List[TMDBSearchResult]` (sanitized) | Bearer JWT | TMDB API v3 (`TMDB_API_KEY` Bearer); rate-limited per user |
| **TMDB Trending** | `GET /api/tmdb/trending` | Query: `window` (`day`|`week`) | `List[TMDBSearchResult]` (max 20) | Bearer JWT | Same as above |
| **YouTube trending (proxy)** | `GET /api/youtube/trending` | None | JSON (upstream Puffyan shape: list or `{ items }`) | Bearer JWT | Server-side `httpx` to `PUFFYAN_TRENDING_URL` or default `vid.puffyan.us` trending API (avoids browser CORS) |

### Environment
| Variable | Role |
| :--- | :--- |
| `TMDB_API_KEY` | Bearer token for The Movie Database API v3 (Python). If unset, TMDB routes return 503. |
| `EXTRA_ALLOWED_ORIGINS` | Optional comma-separated origins merged into `ALLOWED_ORIGINS` when not using `*`. CI deploy sets Firebase Hosting `https://watchparty-482106.web.app`. |
| `PUFFYAN_TRENDING_URL` | Optional override for lobby YouTube trending proxy (default Puffyan trending URL). |

### Testing
| Suite | Command | Dependencies |
| :--- | :--- | :--- |
| Local env | `conda activate wpenv`; run from `backend-python/` with `PYTHONPATH=.` | Conda env `wpenv` (local/agent runs); CI uses `pip` + `python-version` from workflow. |
| Unit tests | `pytest tests/ -m "not integration"` | None (SQLite in-memory, mocked I/O). Includes `tests/test_cors_http.py`: OPTIONS preflight + `GET /api/tmdb/trending` without auth must still return `Access-Control-Allow-Origin` for the configured browser origin (catches “CORS missing” masking 401/5xx). |
| Integration | `pytest tests/ -m integration` | Live PostgreSQL at `DATABASE_URL`, GCP Pub/Sub or emulator. Optional local stack: repo root `docker compose up -d` (Postgres + Redis); default `DATABASE_URL` in `tests/conftest.py` matches compose credentials. TMDB integration covers `VideoService` + `POST /api/videos/add` with `tmdb_id` (fixtures `postgres_api_client`, `integration_user_headers` in `tests/conftest.py`). |

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
| `JWT_SECRET` | WS JWT verification | **Required** — server exits on startup if unset. Validates HMAC-SHA256 signing method. |
| `ALLOWED_ORIGINS` | CORS & WS origin allowlist | Comma-separated origins (CORS with credentials), or exactly `*` to allow any browser origin (CORS without credentials; WebSocket `CheckOrigin` allows all). Default `http://localhost:5173`. Parsed in `backend-go/internal/corsutil/corsutil.go`. |

### Testing
| Suite | Command | Dependencies |
| :--- | :--- | :--- |
| Unit + repository mocks | `go test ./...` | None (no live Redis). |
| Live integration | `go test -tags=integration ./...` | Redis reachable at `redis://localhost:6379` (or set `REDIS_ADDR`), GCP Pub/Sub or `PUBSUB_EMULATOR_HOST`; GitHub Actions runs this with Redis service + emulator. For **Redis + in-process bus only** (no Pub/Sub): `WP_INTEGRATION_LOCAL_BUS=1 go test -tags=integration ./...`. Integration suite includes `HandleChangeProvider` persistence in Redis (`internal/service/room_manager_test.go`). |

### HTTP Routes
| Feature | Method & Endpoint | Input | Output | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **List Rooms** | `GET /rooms` (and `/api/v1/rooms`) | None | `[]domain.RoomSummary` (`{name, count, video_id}`) | RoomManager |
| **Health** | `GET /health` | None | `{"status":"healthy"}` | None |

### WebSocket Connection (`/ws`)
*Query params:* `?room={id}&action={join/create}` — `room` defaults to `"general"`, `action` defaults to `"join"`. Authentication uses **first-message auth**: the client sends `{type: "auth", token: "<jwt>"}` as the first WebSocket message after connection. JWT `sub` and `sid` are parsed using `JWT_SECRET` (HMAC-SHA256). If Redis has `wp:sess:{username}` and it does not match `sid`, the connection is rejected. Read limit is 64KB per message.

### Inbound WebSocket Events (Client → Server)
| Action Category | Event Types (`msg.Type`) | Handler | Effect |
| :--- | :--- | :--- | :--- |
| **Keepalive** | `ping` | No-op (silently consumed) | Prevents connection timeout |
| **Video Sync** | `play`, `pause`, `seek`, `sync_state` | `HandleVideoCommand` | Updates `RoomState` in Redis, publishes via EventBus. **Host-only**: rejects non-host senders. |
| **Queue Mgmt** | `change_video` | `HandleChangeVideo` | Sets new `VideoID`, `Playing=true` in Redis, publishes via EventBus. **Host-only**: rejects non-host senders. |
| **Social** | `chat`, `reaction`, `typing`, `new_video` | `PublishDirectEvent` | Direct pass-through publish via EventBus |
| **Permissions** | `grant_control`, `revoke_control` | `HandleHostChange` | Updates host flag in `RoomState.Clients`, publishes `host_updated` + `user_list`. **Host-only**: rejects non-host senders. |
| **Recommendations** | `recommend_video` | `HandleRecommendVideo` | Delivers payload to **host clients only** (not room broadcast). `Data` JSON ≤1KB; max 5/min per connection. |
| **Provider** | `change_provider` | `HandleChangeProvider` | Host-only; allowlist `videasy`/`vidlink`/`vidfast`; updates `RoomState.Provider`, publishes `change_provider` to room via EventBus. |

### Outbound WebSocket Events (Server → Client)
| Event Type | Emitted By | Payload Notes |
| :--- | :--- | :--- |
| `identity` | `JoinRoom` | Server sends `domain.Message` with `type`, `user_id`, `is_host`, and `provider` (room’s `RoomState.Provider`, default `videasy`). Clients use `user_id`, `is_host`, and `provider` for embed host selection. |
| `request_sync` | `JoinRoom` | Asks the current host to broadcast playback state |
| `user_list` | `BroadcastUserList` | Contains `user_list` array of `UserSummary` objects |
| `system` | `JoinRoom` / `LeaveRoom` | Content: "X joined the party!" or "X left the party." |
| `host_updated` | `HandleHostChange` | Contains `user_id` of target and new `is_host` status |
| `room_empty` | `LeaveRoom` | Backend integration event published when last client leaves; consumed by Python Pub/Sub listener, not a frontend-facing room event |
| `playlist_updated` | `HandleIncomingPubSubMessage` | Remapped from inbound Pub/Sub `video_added` events |
| `error` | `WebSocketHandler` | Sent on validation failure or join error |
| Pass-through | EventBus subscriber | `play`, `pause`, `seek`, `sync_state`, `change_video`, `change_provider`, `chat`, `reaction`, `typing`, `new_video` forwarded to room clients |
| `recommend_video` | `HandleRecommendVideo` | Sent only to host’s `client.Send` channel (same payload as received). |

---

## Frontend (React/Vite)
*Location:* `frontend/wpfe/src/`

### Core State & Providers
| Hook/Service | Purpose | Inputs/Props | State/Outputs |
| :--- | :--- | :--- | :--- |
| `useWatchParty` | Core WS connection & Room Sync | `urlRoom` (string\|null), `action` (`"join"`\|`"create"`) | Above plus: `provider`, `providerVersion`, `embedStartSeconds`, `recommendations`, `dismissRecommendation`, `changeProvider`, `sendRecommendVideo`, `guestResyncEmbed`. Host `sync_state` / `play`/`pause`/`seek` include `provider`. Guests ignore `sync_state` if `msg.provider` ≠ local provider. |
| `embedProviders.js` | TMDB iframe URL builder | `PROVIDERS`, `buildEmbedUrl`, `normalizeEmbedMessage`, `ALLOWED_EMBED_ORIGINS` | Videasy / VidLink / VidFast origins and postMessage normalization |
| `Config.js` | Environment configuration | None | `API_URL` (Python backend), `WS_URL` (Go backend). Dev: auto-detects `hostname:8000` / `hostname:8080`. Prod: reads `VITE_API_URL`, `VITE_WS_URL` baked at CI build. GitHub Actions `deploy-backends` sets job outputs from `gcloud run services describe … --format='value(status.url)'` for `watchparty-api` and `watchparty-ws`; `deploy-frontend` uses those for `.env`. Optional repo secrets `VITE_API_URL` / `VITE_WS_URL` override (e.g. mapped custom domains). |

### UI Component Tree
| Component | Purpose | Core Responsibilities |
| :--- | :--- | :--- |
| `App.jsx` | Root Router | Manages authentication boundary (`RequireAuth`) and routing (`/login`, `/`, `/room/:roomId`) |
| `LoginPage.jsx` | Auth UI | Handles standard login/register and Google SSO via Python API |
| `RoomSelector.jsx` | Lobby UI | `onJoin(name, mode, preload?)` — third arg optional `preload` for trending quick-start (`tmdb` fields or `youtubeUrl`). Embeds `TrendingCarousel`. Optional `onLogout`, `username`. Lobby layout: hero (gradient title), section panels (discover / create / live parties), skeleton loading for room list, `button.room-card` for join. |
| `TrendingCarousel.jsx` | Lobby discovery | `GET /api/tmdb/trending` + `GET /api/youtube/trending` (server proxy); click creates room via `onPickTmdb` / `onPickYoutube` with generated slug and `preload` payload. Row headers with TMDB/YouTube badges and horizontal scroll with snap. |
| `Dashboard.jsx` | Main Room Layout | `PlayerRouter`, `ProviderSelector` (host, TMDB video), `RecommendationPanel` (host), `AddVideoBar` with recommend path; consumes `location.state.preload` once to `POST /api/videos/add`. |
| `PlayerRouter.jsx` | Player selection | If `currentVideo.tmdb_id` set → `EmbedPlayer` (iframe). Else → `VideoPlayer` (`react-player`). |
| `EmbedPlayer.jsx` | TMDB iframe player | `sandbox` iframe, origin-filtered `postMessage`, 10s load fallback with switch-host actions, guest **Re-sync** (`guestResyncEmbed`). |
| `VideoPlayer.jsx` | Media Engine | Unchanged: `react-player` for YouTube/direct URLs. |
| `AddVideoBar.jsx` | Queue Input | Tabs: YouTube (`vid.puffyan.us` search) vs Movies/TV (`GET /api/tmdb/search`). Host adds TMDB via `POST /api/videos/add`; guest sends `recommend_video` via `sendRecommendVideo`. |
| `RecommendationPanel.jsx` | Host inbox | Ephemeral recommendations; dismiss; **Add to queue** → REST add + `new_video`. |
| `ProviderSelector.jsx` | Host embed host | Dropdown → `changeProvider` → WS `change_provider`. |
| `VideoList.jsx` | Queue UI | Renders upcoming videos, emits `change_video` events (host-only), handles delete |
| `ChatSidebar.jsx` | Social Panel | Renders chat/system message history, emits `chat` and `typing` events, emoji reaction picker |
| `ReactionOverlay.jsx`| Real-time UI | Displays floating emojis mapped to `reaction` events |
| `UserList.jsx` | Roster UI | Displays active users with host badges, handles `grant_control`/`revoke_control` emissions |

### Unused Components (candidates for removal)
| Component | Original Purpose | Status |
| :--- | :--- | :--- |
| `CustomControls.jsx` | Standalone sync controls | Not imported anywhere; functionality absorbed into `VideoPlayer.jsx` |
| `UsernameModal.jsx` | Username capture fallback | Not imported anywhere; login flow handled by `LoginPage.jsx` |
