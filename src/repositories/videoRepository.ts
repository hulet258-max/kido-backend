import { query } from '../config/db';
import { Video } from '../models/types';

export const videoRepository = {
  async all(): Promise<Video[]> {
    const { rows } = await query<{ data: Video }>('SELECT data FROM videos ORDER BY id');
    return rows.map((row) => row.data);
  },

  async byId(id: string): Promise<Video | undefined> {
    const { rows } = await query<{ data: Video }>('SELECT data FROM videos WHERE id = $1', [id]);
    return rows[0]?.data;
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
