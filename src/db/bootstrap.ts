import { pool } from '../config/db';
import { env } from '../config/env';
import { seededVideos } from '../seed/videos';
import { ingestCatalog } from '../services/mediaService';

const schemaSql = `
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  phone TEXT,
  child_ids JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES parents(id) ON DELETE SET NULL,
  profile JSONB NOT NULL,
  favorites JSONB NOT NULL DEFAULT '[]'::jsonb,
  likes JSONB NOT NULL DEFAULT '[]'::jsonb,
  dislikes JSONB NOT NULL DEFAULT '[]'::jsonb,
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
  reaction TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS viewing_events_child_idx ON viewing_events (child_id, timestamp);
CREATE INDEX IF NOT EXISTS daily_usage_child_idx ON daily_usage (child_id);
`;

export async function bootstrapDatabase() {
  await pool.query(schemaSql);
  await pool.query('ALTER TABLE parents ADD COLUMN IF NOT EXISTS phone TEXT');
  await pool.query('ALTER TABLE children ADD COLUMN IF NOT EXISTS dislikes JSONB NOT NULL DEFAULT \'[]\'::jsonb');
  await pool.query('ALTER TABLE viewing_events ADD COLUMN IF NOT EXISTS reaction TEXT');
  await pool.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS parents_phone_idx ON parents (phone) WHERE phone IS NOT NULL AND phone <> \'\'',
  );

  await pool.query(`DELETE FROM viewing_events WHERE child_id IN ('child_001', 'child_002')`);
  await pool.query(`DELETE FROM daily_usage WHERE child_id IN ('child_001', 'child_002')`);
  await pool.query(`DELETE FROM children WHERE id IN ('child_001', 'child_002')`);
  await pool.query(`DELETE FROM parents WHERE id = 'parent_001'`);

  for (const video of seededVideos) {
    await pool.query('INSERT INTO videos (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = $2::jsonb', [
      video.id,
      JSON.stringify(video),
    ]);
  }

  if (env.cacheRemoteMedia) {
    void ingestCatalog(seededVideos).catch((err) => {
      console.error('Public clip ingest failed', err);
    });
  }
}
