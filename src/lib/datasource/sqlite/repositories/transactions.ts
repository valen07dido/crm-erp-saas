import { randomUUID } from 'crypto';
import { getDb } from '../connection';
import type { TransactionRecord, TransactionCreateInput } from '../../types';

interface TransactionRow {
  id: string;
  business_id: string;
  type: string;
  amount: string;
  description: string;
  category: string | null;
  date: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    category: row.category,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const transactionsRepository = {
  async list(businessId: string, type?: string): Promise<TransactionRecord[]> {
    const db = getDb();
    const rows = (
      type
        ? db.prepare('SELECT * FROM transactions WHERE business_id = ? AND type = ? ORDER BY date DESC').all(businessId, type)
        : db.prepare('SELECT * FROM transactions WHERE business_id = ? ORDER BY date DESC').all(businessId)
    ) as TransactionRow[];
    return rows.map(mapRow);
  },

  async create(input: TransactionCreateInput): Promise<TransactionRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const date = input.date ? new Date(input.date).toISOString() : now;
    getDb()
      .prepare(
        `INSERT INTO transactions (id, business_id, type, amount, description, category, date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.businessId, input.type, String(input.amount), input.description, input.category ?? null, date, now, now);
    const row = getDb().prepare('SELECT * FROM transactions WHERE id = ?').get(id) as TransactionRow;
    return mapRow(row);
  },

  async delete(id: string, businessId: string): Promise<void> {
    getDb().prepare('DELETE FROM transactions WHERE id = ? AND business_id = ?').run(id, businessId);
  },
};
