CREATE TABLE vessel_positions(id TEXT PRIMARY KEY, data TEXT NOT NULL, recorded_ms INTEGER NOT NULL);
CREATE INDEX vessel_positions_time ON vessel_positions(recorded_ms);
CREATE TABLE publications(id TEXT PRIMARY KEY,data TEXT NOT NULL,captured_at TEXT NOT NULL);
CREATE TABLE sync_state(id INTEGER PRIMARY KEY,checked_at TEXT,unavailable INTEGER);
