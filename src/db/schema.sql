CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  child_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES parents(id) ON DELETE SET NULL,
  profile JSONB NOT NULL,
  favorites JSONB NOT NULL DEFAULT '[]'::jsonb,
  likes JSONB NOT NULL DEFAULT '[]'::jsonb,
  continue_watching JSONB NOT NULL DEFAULT '{}'::jsonb,
  downloaded_video_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS daily_usage (
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes DOUBLE PRECISION NOT NULL DEFAULT 0,
  by_category JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (child_id, date)
);

CREATE TABLE IF NOT EXISTS viewing_events (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  video_id TEXT,
  event_type TEXT NOT NULL,
  watch_duration_seconds INTEGER NOT NULL DEFAULT 0,
  percentage_watched DOUBLE PRECISION NOT NULL DEFAULT 0,
  category TEXT,
  language TEXT,
  orientation TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS viewing_events_child_idx ON viewing_events (child_id, timestamp);
CREATE INDEX IF NOT EXISTS daily_usage_child_idx ON daily_usage (child_id);
