import { query } from '../config/db';
import { Activity } from '../models/types';

export const activityRepository = {
  async all(filters: { category?: string; age?: number } = {}): Promise<Activity[]> {
    const { rows } = await query<{ data: Activity }>('SELECT data FROM activities ORDER BY id');
    return rows.map((row) => row.data).filter((activity) =>
      (!filters.category || activity.category === filters.category) &&
      (filters.age == null || (filters.age >= activity.minAge && filters.age <= activity.maxAge)),
    );
  },

  async byId(id: string): Promise<Activity | undefined> {
    const { rows } = await query<{ data: Activity }>('SELECT data FROM activities WHERE id = $1', [id]);
    return rows[0]?.data;
  },

  async save(activity: Activity): Promise<Activity> {
    await query(
      'INSERT INTO activities (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = $2::jsonb',
      [activity.id, JSON.stringify(activity)],
    );
    return activity;
  },

  async delete(id: string): Promise<boolean> {
    const result = await query('DELETE FROM activities WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
