import { randomUUID } from 'crypto';
import { getDb } from '../connection';
import type { ClientRecord, ClientInput } from '../../types';

interface ClientRow {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    businessId: row.business_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findRowById(id: string): ClientRow | undefined {
  return getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id) as ClientRow | undefined;
}

export const clientsRepository = {
  async list(businessId: string): Promise<ClientRecord[]> {
    const rows = getDb()
      .prepare('SELECT * FROM clients WHERE business_id = ? ORDER BY created_at DESC')
      .all(businessId) as ClientRow[];
    return rows.map(mapRow);
  },

  async create(businessId: string, input: ClientInput): Promise<ClientRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO clients (id, business_id, name, email, phone, address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, businessId, input.name, input.email ?? null, input.phone ?? null, input.address ?? null, now, now);
    return mapRow(findRowById(id)!);
  },

  async update(id: string, businessId: string, input: ClientInput): Promise<ClientRecord> {
    const existing = getDb().prepare('SELECT * FROM clients WHERE id = ? AND business_id = ?').get(id, businessId) as
      | ClientRow
      | undefined;
    if (!existing) throw new Error('Client not found');
    const now = new Date().toISOString();
    getDb()
      .prepare('UPDATE clients SET name=?, email=?, phone=?, address=?, updated_at=? WHERE id=?')
      .run(
        input.name ?? existing.name,
        input.email !== undefined ? input.email : existing.email,
        input.phone !== undefined ? input.phone : existing.phone,
        input.address !== undefined ? input.address : existing.address,
        now,
        id
      );
    return mapRow(findRowById(id)!);
  },

  async delete(id: string, businessId: string): Promise<void> {
    getDb().prepare('DELETE FROM clients WHERE id = ? AND business_id = ?').run(id, businessId);
  },
};
