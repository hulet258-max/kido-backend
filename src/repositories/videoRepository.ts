import { query } from '../config/db';
import { Video } from '../models/types';
import { withLocalPlayback } from '../services/mediaService';

function withTimestamp(data: Video, createdAt?: Date | string | null): Video {
  const stamp = createdAt instanceof Date ? createdAt.toISOString() : createdAt || data.createdAt;
  return stamp ? { ...data, createdAt: stamp } : data;
}

export const videoRepository = {
  async all(): Promise<Video[]> {
    const { rows } = await query<{ data: Video; created_at: Date }>(
      'SELECT data, created_at FROM videos ORDER BY created_at DESC, id DESC',
    );
    return rows.map((row) => withLocalPlayback(withTimestamp(row.data, row.created_at)));
  },

  async byId(id: string): Promise<Video | undefined> {
    const { rows } = await query<{ data: Video; created_at: Date }>(
      'SELECT data, created_at FROM videos WHERE id = $1',
      [id],
    );
    return rows[0]?.data ? withLocalPlayback(withTimestamp(rows[0].data, rows[0].created_at)) : undefined;
  },

  async revision() {
    const { rows } = await query<{ count: string; stamp: string }>(
      `SELECT COUNT(*)::text AS count,
              COALESCE(MAX(updated_at)::text, '0') AS stamp
       FROM videos`,
    );
    const count = Number(rows[0]?.count ?? 0);
    const stamp = rows[0]?.stamp ?? '0';
    return { revision: `${count}:${stamp}`, count };
  },

  async save(video: Video): Promise<Video> {
    const createdAt = video.createdAt ?? new Date().toISOString();
    const stored = { ...video, createdAt };
    await query(
      `INSERT INTO videos (id, data, created_at, updated_at)
       VALUES ($1, $2::jsonb, $3::timestamptz, NOW())
       ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = NOW()`,
      [stored.id, JSON.stringify(stored), createdAt],
    );
    return stored;
  },

  async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM videos WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async categories() {
    const videos = await this.all();
    const unique = [...new Set(videos.map((v) => v.category))];
    return unique.map((id) => ({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      count: videos.filter((v) => v.category === id).length,
    }));
  },
};
