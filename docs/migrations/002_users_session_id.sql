-- Single active session: JWT "sid" must match users.session_id (see auth.py).
-- Run once on every PostgreSQL environment that predates this column (e.g. Supabase SQL editor, psql).
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_id VARCHAR(64);
