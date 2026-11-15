import { randomUUID } from 'crypto';
import { getDb } from '../connection';
import type { SupplierRecord, SupplierInput } from '../../types';

interface SupplierRow {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: SupplierRow): SupplierRecord {
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

function findRowById(id: string): SupplierRow | undefined {
  return getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as SupplierRow | undefined;
}

export const suppliersRepository = {
  async list(businessId: string): Promise<SupplierRecord[]> {
    const rows = getDb()
      .prepare('SELECT * FROM suppliers WHERE business_id = ? ORDER BY created_at DESC')
      .all(businessId) as SupplierRow[];
    return rows.map(mapRow);
  },

  async create(businessId: string, input: SupplierInput): Promise<SupplierRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO suppliers (id, business_id, name, email, phone, address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, businessId, input.name, input.email ?? null, input.phone ?? null, input.address ?? null, now, now);
    return mapRow(findRowById(id)!);
  },

  async update(id: string, businessId: string, input: SupplierInput): Promise<SupplierRecord> {
    const existing = findRowById(id);
    if (!existing || existing.business_id !== businessId) throw new Error('Supplier not found');
    const now = new Date().toISOString();
    getDb()
      .prepare('UPDATE suppliers SET name=?, email=?, phone=?, address=?, updated_at=? WHERE id=?')
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
    const existing = findRowById(id);
    if (!existing || existing.business_id !== businessId) throw new Error('Supplier not found');
    getDb().prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  },
};
