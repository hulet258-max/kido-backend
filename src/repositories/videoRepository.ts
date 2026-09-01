import { query } from '../config/db';
import { Video } from '../models/types';
import { withLocalPlayback } from '../services/mediaService';

export const videoRepository = {
  async all(): Promise<Video[]> {
    const { rows } = await query<{ data: Video }>('SELECT data FROM videos ORDER BY id');
    return rows.map((row) => withLocalPlayback(row.data));
  },

  async byId(id: string): Promise<Video | undefined> {
    const { rows } = await query<{ data: Video }>('SELECT data FROM videos WHERE id = $1', [id]);
    return rows[0]?.data ? withLocalPlayback(rows[0].data) : undefined;
  },

  async save(video: Video): Promise<Video> {
    await query(
      'INSERT INTO videos (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = $2::jsonb',
      [video.id, JSON.stringify(video)],
    );
    return video;
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
