import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import { decToStr } from '../decimal';
import type { ComboRecord, ComboCreateInput, ComboUpdateInput, ComboItemRecord } from '../../types';

interface ComboRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: string;
  image_url: string | null;
  barcode: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface ComboItemJoinRow {
  id: string;
  combo_id: string;
  product_id: string;
  quantity: string;
  product_name: string | null;
}

function mapItemRow(row: ComboItemJoinRow): ComboItemRecord {
  return {
    id: row.id,
    productId: row.product_id,
    quantity: Number(row.quantity),
    product: { id: row.product_id, name: row.product_name ?? '' },
  };
}

function hydrateCombo(db: Database.Database, row: ComboRow): ComboRecord {
  const itemRows = db
    .prepare(
      `SELECT ci.*, p.name as product_name
       FROM combo_items ci
       LEFT JOIN products p ON p.id = ci.product_id
       WHERE ci.combo_id = ?`
    )
    .all(row.id) as ComboItemJoinRow[];

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    imageUrl: row.image_url,
    barcode: row.barcode,
    isActive: !!row.is_active,
    businessId: row.business_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: itemRows.map(mapItemRow),
  };
}

function findRowById(db: Database.Database, id: string): ComboRow | undefined {
  return db.prepare('SELECT * FROM combos WHERE id = ?').get(id) as ComboRow | undefined;
}

export const combosRepository = {
  async list(businessId: string): Promise<ComboRecord[]> {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM combos WHERE business_id = ? ORDER BY created_at DESC')
      .all(businessId) as ComboRow[];
    return rows.map((row) => hydrateCombo(db, row));
  },

  async findById(id: string): Promise<ComboRecord | null> {
    const db = getDb();
    const row = findRowById(db, id);
    return row ? hydrateCombo(db, row) : null;
  },

  async create(input: ComboCreateInput): Promise<ComboRecord> {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    const run = db.transaction(() => {
      db.prepare(
        `INSERT INTO combos (id, business_id, name, description, price, image_url, barcode, is_active, created_at, updated_at)
         VALUES (@id, @businessId, @name, @description, @price, @imageUrl, @barcode, @isActive, @createdAt, @updatedAt)`
      ).run({
        id,
        businessId: input.businessId,
        name: input.name,
        description: input.description ?? null,
        price: decToStr(input.price),
        imageUrl: input.imageUrl ?? null,
        barcode: input.barcode ?? null,
        isActive: input.isActive ?? true ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      });

      for (const item of input.items) {
        db.prepare(
          `INSERT INTO combo_items (id, combo_id, product_id, quantity) VALUES (?, ?, ?, ?)`
        ).run(randomUUID(), id, item.productId, String(item.quantity));
      }
    });
    run();

    return hydrateCombo(db, findRowById(db, id)!);
  },

  async update(id: string, businessId: string, input: ComboUpdateInput): Promise<ComboRecord> {
    const db = getDb();
    const existing = findRowById(db, id);
    if (!existing || existing.business_id !== businessId) throw new Error('Combo not found');

    const now = new Date().toISOString();
    const next = {
      id,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      price: input.price !== undefined ? decToStr(input.price) : existing.price,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl : existing.image_url,
      barcode: input.barcode !== undefined ? input.barcode : existing.barcode,
      isActive: (input.isActive !== undefined ? input.isActive : !!existing.is_active) ? 1 : 0,
      updatedAt: now,
    };

    const run = db.transaction(() => {
      db.prepare(
        `UPDATE combos SET name=@name, description=@description, price=@price, image_url=@imageUrl,
          barcode=@barcode, is_active=@isActive, updated_at=@updatedAt WHERE id=@id`
      ).run(next);

      if (input.items) {
        db.prepare('DELETE FROM combo_items WHERE combo_id = ?').run(id);
        for (const item of input.items) {
          db.prepare(
            `INSERT INTO combo_items (id, combo_id, product_id, quantity) VALUES (?, ?, ?, ?)`
          ).run(randomUUID(), id, item.productId, String(item.quantity));
        }
      }
    });
    run();

    return hydrateCombo(db, findRowById(db, id)!);
  },

  async delete(id: string, businessId: string): Promise<void> {
    const db = getDb();
    const existing = findRowById(db, id);
    if (!existing || existing.business_id !== businessId) throw new Error('Combo not found');
    db.prepare('DELETE FROM combos WHERE id = ?').run(id);
  },
};
