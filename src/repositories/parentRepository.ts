import { query } from '../config/db';
import { ParentAccount } from '../models/types';

type ParentRow = {
  id: string;
  name: string;
  pin: string;
  phone: string | null;
  child_ids: string[];
};

function mapParent(row: ParentRow): ParentAccount {
  return {
    id: row.id,
    name: row.name,
    pin: row.pin,
    phone: row.phone ?? '',
    childIds: row.child_ids ?? [],
  };
}

export const parentRepository = {
  async getById(id: string): Promise<ParentAccount | undefined> {
    const { rows } = await query<ParentRow>('SELECT id, name, pin, phone, child_ids FROM parents WHERE id = $1', [id]);
    return rows[0] ? mapParent(rows[0]) : undefined;
  },

  async findByPhone(phone: string): Promise<ParentAccount | undefined> {
    const { rows } = await query<ParentRow>(
      'SELECT id, name, pin, phone, child_ids FROM parents WHERE phone = $1',
      [phone],
    );
    return rows[0] ? mapParent(rows[0]) : undefined;
  },

  async create(parent: ParentAccount): Promise<ParentAccount> {
    await query(
      'INSERT INTO parents (id, name, pin, phone, child_ids) VALUES ($1, $2, $3, $4, $5::jsonb)',
      [parent.id, parent.name, parent.pin, parent.phone, JSON.stringify(parent.childIds)],
    );
    return parent;
  },

  async addChildId(parentId: string, childId: string) {
    const parent = await this.getById(parentId);
    const ids = [...new Set([...(parent?.childIds ?? []), childId])];
    await query('UPDATE parents SET child_ids = $2::jsonb WHERE id = $1', [parentId, JSON.stringify(ids)]);
  },
};
