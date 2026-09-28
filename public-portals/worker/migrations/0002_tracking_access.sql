CREATE TABLE tracking_members (id TEXT PRIMARY KEY, registration_hash TEXT NOT NULL UNIQUE);
CREATE TABLE tracking_sessions (token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL, expires_ms INTEGER NOT NULL);
CREATE INDEX tracking_sessions_expiry ON tracking_sessions(expires_ms);
CREATE TABLE tracking_visits (id TEXT PRIMARY KEY, member_id TEXT NOT NULL, visited_ms INTEGER NOT NULL);
CREATE INDEX tracking_visits_time ON tracking_visits(visited_ms);
CREATE TABLE tracking_attempts (id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_ms INTEGER NOT NULL);
