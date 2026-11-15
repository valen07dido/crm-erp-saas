import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../connection';
import type { BusinessUserRecord, BusinessUserCreateInput, BusinessUserUpdateInput } from '../../types';

interface BusinessUserJoinRow {
  id: string;
  user_id: string;
  business_id: string;
  role: string;
  created_at: string;
  updated_at: string;
  email: string;
  username: string | null;
  name: string | null;
}

function mapRow(row: BusinessUserJoinRow): BusinessUserRecord {
  return {
    id: row.id,
    userId: row.user_id,
    businessId: row.business_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: { id: row.user_id, email: row.email, username: row.username, name: row.name },
  };
}

function findRowById(id: string): BusinessUserJoinRow | undefined {
  return getDb()
    .prepare(
      `SELECT bu.*, u.email, u.username, u.name
       FROM business_users bu JOIN users u ON u.id = bu.user_id
       WHERE bu.id = ?`
    )
    .get(id) as BusinessUserJoinRow | undefined;
}

export const businessUsersRepository = {
  async list(businessId: string): Promise<BusinessUserRecord[]> {
    const rows = getDb()
      .prepare(
        `SELECT bu.*, u.email, u.username, u.name
         FROM business_users bu JOIN users u ON u.id = bu.user_id
         WHERE bu.business_id = ? ORDER BY bu.created_at ASC`
      )
      .all(businessId) as BusinessUserJoinRow[];
    return rows.map(mapRow);
  },

  async findById(id: string): Promise<BusinessUserRecord | null> {
    const row = findRowById(id);
    return row ? mapRow(row) : null;
  },

  async findConflict(email: string, username: string): Promise<'email' | 'username' | null> {
    const existing = getDb().prepare('SELECT email, username FROM users WHERE email = ? OR username = ?').get(email, username) as
      | { email: string; username: string | null }
      | undefined;
    if (!existing) return null;
    return existing.email === email ? 'email' : 'username';
  },

  async create(input: BusinessUserCreateInput): Promise<BusinessUserRecord> {
    const db = getDb();
    const userId = randomUUID();
    const businessUserId = randomUUID();
    const now = new Date().toISOString();

    const run = db.transaction(() => {
      db.prepare(
        `INSERT INTO users (id, email, username, password_hash, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, input.email, input.username, bcrypt.hashSync(input.password, 10), input.name ?? null, now, now);

      db.prepare(
        `INSERT INTO business_users (id, user_id, business_id, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(businessUserId, userId, input.businessId, input.role, now, now);
    });
    run();

    return mapRow(findRowById(businessUserId)!);
  },

  async update(id: string, businessId: string, input: BusinessUserUpdateInput): Promise<BusinessUserRecord> {
    const db = getDb();
    const existing = findRowById(id);
    if (!existing || existing.business_id !== businessId) throw new Error('Usuario no encontrado en este negocio');

    const run = db.transaction(() => {
      if (input.role !== undefined) {
        db.prepare('UPDATE business_users SET role = ?, updated_at = ? WHERE id = ?').run(input.role, new Date().toISOString(), id);
      }
      if (input.password) {
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
          bcrypt.hashSync(input.password, 10),
          new Date().toISOString(),
          existing.user_id
        );
      }
    });
    run();

    return mapRow(findRowById(id)!);
  },

  async delete(id: string, businessId: string): Promise<void> {
    const existing = findRowById(id);
    if (!existing || existing.business_id !== businessId) throw new Error('Usuario no encontrado en este negocio');
    getDb().prepare('DELETE FROM business_users WHERE id = ?').run(id);
  },
};
