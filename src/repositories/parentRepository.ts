import { query } from '../config/db';
import { ParentAccount } from '../models/types';

export const parentRepository = {
  async getDefault(): Promise<ParentAccount | undefined> {
    const { rows } = await query<{
      id: string;
      name: string;
      pin: string;
      child_ids: string[];
    }>('SELECT id, name, pin, child_ids FROM parents ORDER BY id LIMIT 1');
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      pin: row.pin,
      childIds: row.child_ids,
    };
  },

  async addChildId(parentId: string, childId: string) {
    const parent = await this.getDefault();
    const ids = [...new Set([...(parent?.childIds ?? []), childId])];
    await query('UPDATE parents SET child_ids = $2::jsonb WHERE id = $1', [parentId, JSON.stringify(ids)]);
  },
};
