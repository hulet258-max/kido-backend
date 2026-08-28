import { pool } from '../config/db';
import { demoParent, hanaProfile, samiProfile, seedDailyUsage, seedHistory } from '../seed/demo';
import { seededVideos } from '../seed/videos';

const schemaSql = `
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
`;

export async function bootstrapDatabase() {
  await pool.query(schemaSql);

  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM videos');
  if (Number(rows[0]?.count ?? 0) > 0) {
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const video of seededVideos) {
      await client.query('INSERT INTO videos (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [
        video.id,
        JSON.stringify(video),
      ]);
    }
    await client.query(
      'INSERT INTO parents (id, name, pin, child_ids) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO NOTHING',
      [demoParent.id, demoParent.name, demoParent.pin, JSON.stringify(demoParent.childIds)],
    );

    await insertChild(client, demoParent.id, samiProfile, {
      favorites: ['video_002', 'video_009'],
      likes: ['video_001', 'video_006'],
      continueWatching: { video_009: 0.62, video_005: 0.4 },
      dailyUsage: seedDailyUsage(78),
      events: seedHistory('child_001'),
    });
    await insertChild(client, demoParent.id, hanaProfile, {
      favorites: ['video_010', 'video_003'],
      likes: ['video_002'],
      continueWatching: { video_010: 0.3 },
      dailyUsage: seedDailyUsage(41),
      events: seedHistory('child_002'),
    });
    await client.query('COMMIT');
    console.log('KIDO PostgreSQL database seeded');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function insertChild(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  parentId: string,
  profile: object & { id: string },
  extras: {
    favorites: string[];
    likes: string[];
    continueWatching: Record<string, number>;
    dailyUsage: { date: string; minutes: number; byCategory: Record<string, number> }[];
    events: {
      id: string;
      childId: string;
      videoId: string;
      eventType: string;
      watchDurationSeconds: number;
      percentageWatched: number;
      category?: string;
      language?: string;
      orientation?: string;
      timestamp: string;
    }[];
  },
) {
  await client.query(
    `INSERT INTO children (id, parent_id, profile, favorites, likes, continue_watching)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      profile.id,
      parentId,
      JSON.stringify(profile),
      JSON.stringify(extras.favorites),
      JSON.stringify(extras.likes),
      JSON.stringify(extras.continueWatching),
    ],
  );
  for (const day of extras.dailyUsage) {
    await client.query(
      `INSERT INTO daily_usage (child_id, date, minutes, by_category)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (child_id, date) DO NOTHING`,
      [profile.id, day.date, day.minutes, JSON.stringify(day.byCategory)],
    );
  }
  for (const event of extras.events) {
    await client.query(
      `INSERT INTO viewing_events
        (id, child_id, video_id, event_type, watch_duration_seconds, percentage_watched, category, language, orientation, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.childId,
        event.videoId,
        event.eventType,
        event.watchDurationSeconds,
        event.percentageWatched,
        event.category ?? null,
        event.language ?? null,
        event.orientation ?? null,
        event.timestamp,
      ],
    );
  }
}
