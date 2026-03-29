-- Run once on existing PostgreSQL databases (Supabase).
ALTER TABLE videos ADD COLUMN IF NOT EXISTS tmdb_id INTEGER;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS media_type VARCHAR(10);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS season INTEGER;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS episode INTEGER;
CREATE INDEX IF NOT EXISTS ix_videos_tmdb_id ON videos (tmdb_id);
