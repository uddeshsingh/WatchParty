-- One-shot bootstrap for older WatchParty Postgres DBs (e.g. Supabase SQL editor).
-- Idempotent: safe to run multiple times.
--
-- Fixes:
--   • users.session_id — required for JWT auth (get_current_user)
--   • videos.tmdb_* — required whenever the API loads rows from `videos`
--
-- Why this shows up when "creating a room":
--   Create/join only navigates to `/room/:slug`; the Dashboard then calls
--   GET /api/videos?room=... to load the playlist. That query selects all
--   VideoModel columns (including tmdb_id). If those columns are missing,
--   you get ProgrammingError and the room looks broken right after create.

-- 002_users_session_id.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);

-- 001_videos_tmdb_columns.sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS tmdb_id INTEGER;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS media_type VARCHAR(10);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS season INTEGER;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS episode INTEGER;
CREATE INDEX IF NOT EXISTS ix_videos_tmdb_id ON videos (tmdb_id);
