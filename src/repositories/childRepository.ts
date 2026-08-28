import { pool, query } from '../config/db';
import { ChildProfile, ChildState, DailyUsage, ViewingEvent } from '../models/types';
import { parentRepository } from './parentRepository';

type ChildRow = {
  id: string;
  profile: ChildProfile;
  favorites: string[];
  likes: string[];
  continue_watching: Record<string, number>;
  downloaded_video_ids: string[];
};

function mapEvent(row: {
  id: string;
  child_id: string;
  video_id: string | null;
  event_type: ViewingEvent['eventType'];
  watch_duration_seconds: number;
  percentage_watched: number;
  category: ViewingEvent['category'] | null;
  language: ViewingEvent['language'] | null;
  orientation: ViewingEvent['orientation'] | null;
  timestamp: Date | string;
}): ViewingEvent {
  return {
    id: row.id,
    childId: row.child_id,
    videoId: row.video_id ?? '',
    eventType: row.event_type,
    watchDurationSeconds: Number(row.watch_duration_seconds),
    percentageWatched: Number(row.percentage_watched),
    category: row.category ?? undefined,
    language: row.language ?? undefined,
    orientation: row.orientation ?? undefined,
    timestamp: new Date(row.timestamp).toISOString(),
  };
}

async function hydrate(row: ChildRow): Promise<ChildState> {
  const usage = await query<{
    date: string;
    minutes: number;
    by_category: Record<string, number>;
  }>('SELECT date::text AS date, minutes, by_category FROM daily_usage WHERE child_id = $1 ORDER BY date', [
    row.id,
  ]);
  const events = await query<{
    id: string;
    child_id: string;
    video_id: string | null;
    event_type: ViewingEvent['eventType'];
    watch_duration_seconds: number;
    percentage_watched: number;
    category: ViewingEvent['category'] | null;
    language: ViewingEvent['language'] | null;
    orientation: ViewingEvent['orientation'] | null;
    timestamp: Date;
  }>(
    `SELECT id, child_id, video_id, event_type, watch_duration_seconds, percentage_watched,
            category, language, orientation, timestamp
     FROM viewing_events WHERE child_id = $1 ORDER BY timestamp`,
    [row.id],
  );
  return {
    profile: row.profile,
    favorites: row.favorites ?? [],
    likes: row.likes ?? [],
    continueWatching: row.continue_watching ?? {},
    dailyUsage: usage.rows.map(
      (d): DailyUsage => ({
        date: d.date.slice(0, 10),
        minutes: Number(d.minutes),
        byCategory: d.by_category ?? {},
      }),
    ),
    events: events.rows.map(mapEvent),
    downloadedVideoIds: row.downloaded_video_ids ?? [],
  };
}

export const childRepository = {
  async get(id: string): Promise<ChildState | undefined> {
    const { rows } = await query<ChildRow>(
      'SELECT id, profile, favorites, likes, continue_watching, downloaded_video_ids FROM children WHERE id = $1',
      [id],
    );
    if (!rows[0]) return undefined;
    return hydrate(rows[0]);
  },

  async list(): Promise<ChildProfile[]> {
    const { rows } = await query<{ profile: ChildProfile }>('SELECT profile FROM children ORDER BY id');
    return rows.map((r) => r.profile);
  },

  async create(profile: ChildProfile): Promise<ChildProfile> {
    const parent = await parentRepository.getDefault();
    await query(
      `INSERT INTO children (id, parent_id, profile, favorites, likes, continue_watching)
       VALUES ($1, $2, $3::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb)`,
      [profile.id, parent?.id ?? null, JSON.stringify(profile)],
    );
    if (parent) {
      await parentRepository.addChildId(parent.id, profile.id);
    }
    return profile;
  },

  async update(id: string, patch: Partial<ChildProfile>): Promise<ChildProfile> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Child ${id} not found`);
    }
    const profile = { ...existing.profile, ...patch, id };
    await query('UPDATE children SET profile = $2::jsonb WHERE id = $1', [id, JSON.stringify(profile)]);
    return profile;
  },

  async save(state: ChildState): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE children
         SET profile = $2::jsonb,
             favorites = $3::jsonb,
             likes = $4::jsonb,
             continue_watching = $5::jsonb,
             downloaded_video_ids = $6::jsonb
         WHERE id = $1`,
        [
          state.profile.id,
          JSON.stringify(state.profile),
          JSON.stringify(state.favorites),
          JSON.stringify(state.likes),
          JSON.stringify(state.continueWatching),
          JSON.stringify(state.downloadedVideoIds),
        ],
      );
      for (const day of state.dailyUsage) {
        await client.query(
          `INSERT INTO daily_usage (child_id, date, minutes, by_category)
           VALUES ($1, $2, $3, $4::jsonb)
           ON CONFLICT (child_id, date)
           DO UPDATE SET minutes = EXCLUDED.minutes, by_category = EXCLUDED.by_category`,
          [state.profile.id, day.date, day.minutes, JSON.stringify(day.byCategory)],
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async addEvent(event: ViewingEvent): Promise<void> {
    await query(
      `INSERT INTO viewing_events
        (id, child_id, video_id, event_type, watch_duration_seconds, percentage_watched, category, language, orientation, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
  },
};
