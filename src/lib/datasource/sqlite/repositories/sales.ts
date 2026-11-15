import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import { Decimal } from '../decimal';
import type { SaleRecord, SaleCreateInput, SaleItemRecord, ClientRecord } from '../../types';

interface SaleRow {
  id: string;
  business_id: string;
  client_id: string | null;
  status: string;
  total: string;
  created_at: string;
  updated_at: string;
}

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

interface SaleItemJoinRow {
  id: string;
  sale_id: string;
  product_id: string | null;
  combo_id: string | null;
  quantity: string;
  price: string;
  product_name: string | null;
  combo_name: string | null;
}

function mapClientRow(row: ClientRow): ClientRecord {
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

function mapSaleItemRow(row: SaleItemJoinRow): SaleItemRecord {
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    comboId: row.combo_id,
    quantity: row.quantity,
    price: row.price,
    product: row.product_id ? { id: row.product_id, name: row.product_name ?? '' } : null,
    combo: row.combo_id ? { id: row.combo_id, name: row.combo_name ?? '' } : null,
  };
}

function hydrateSale(db: Database.Database, row: SaleRow): SaleRecord {
  const client = row.client_id
    ? (db.prepare('SELECT * FROM clients WHERE id = ?').get(row.client_id) as ClientRow | undefined)
    : undefined;

  const itemRows = db
    .prepare(
      `SELECT si.*, p.name as product_name, c.name as combo_name
       FROM sale_items si
       LEFT JOIN products p ON p.id = si.product_id
       LEFT JOIN combos c ON c.id = si.combo_id
       WHERE si.sale_id = ?`
    )
    .all(row.id) as SaleItemJoinRow[];

  return {
    id: row.id,
    businessId: row.business_id,
    clientId: row.client_id,
    status: row.status,
    total: row.total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    client: client ? mapClientRow(client) : null,
    items: itemRows.map(mapSaleItemRow),
  };
}

function findSaleRow(db: Database.Database, id: string): SaleRow | undefined {
  return db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as SaleRow | undefined;
}

function decrementProductStock(db: Database.Database, productId: string, amount: Decimal) {
  const row = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as { stock: string };
  const next = new Decimal(row.stock).minus(amount);
  db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(next.toString(), new Date().toISOString(), productId);
}

function incrementProductStock(db: Database.Database, productId: string, amount: Decimal) {
  const row = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId) as { stock: string };
  const next = new Decimal(row.stock).plus(amount);
  db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(next.toString(), new Date().toISOString(), productId);
}

export const salesRepository = {
  async list(businessId: string): Promise<SaleRecord[]> {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM sales WHERE business_id = ? ORDER BY created_at DESC').all(businessId) as SaleRow[];
    return rows.map((row) => hydrateSale(db, row));
  },

  async findById(id: string): Promise<SaleRecord | null> {
    const db = getDb();
    const row = findSaleRow(db, id);
    return row ? hydrateSale(db, row) : null;
  },

  async create(input: SaleCreateInput): Promise<SaleRecord> {
    const db = getDb();
    const saleId = randomUUID();
    const now = new Date().toISOString();

    const run = db.transaction(() => {
      db.prepare(
        `INSERT INTO sales (id, business_id, client_id, status, total, created_at, updated_at)
         VALUES (?, ?, ?, ?, '0', ?, ?)`
      ).run(saleId, input.businessId, input.clientId ?? null, input.status || 'COMPLETED', now, now);

      let total = new Decimal(0);

      for (const item of input.items) {
        if (item.comboId) {
          const combo = db
            .prepare('SELECT * FROM combos WHERE id = ? AND business_id = ?')
            .get(item.comboId, input.businessId) as { id: string; name: string; price: string } | undefined;
          if (!combo) throw new Error(`Combo not found: ${item.comboId}`);

          const comboItems = db.prepare('SELECT * FROM combo_items WHERE combo_id = ?').all(combo.id) as {
            product_id: string;
            quantity: string;
          }[];

          for (const ci of comboItems) {
            const product = db.prepare('SELECT * FROM products WHERE id = ?').get(ci.product_id) as
              | { id: string; name: string; stock: string }
              | undefined;
            if (!product) throw new Error(`Product not found: ${ci.product_id}`);
            const needed = new Decimal(ci.quantity).times(item.quantity);
            if (new Decimal(product.stock).lessThan(needed)) {
              throw new Error(`Stock insuficiente de ${product.name} para el combo ${combo.name}`);
            }
          }

          total = total.plus(new Decimal(combo.price).times(item.quantity));

          db.prepare(
            `INSERT INTO sale_items (id, sale_id, product_id, combo_id, quantity, price) VALUES (?, ?, NULL, ?, ?, ?)`
          ).run(randomUUID(), saleId, combo.id, String(item.quantity), combo.price);

          for (const ci of comboItems) {
            decrementProductStock(db, ci.product_id, new Decimal(ci.quantity).times(item.quantity));
          }
          continue;
        }

        const product = db
          .prepare('SELECT * FROM products WHERE id = ? AND business_id = ?')
          .get(item.productId, input.businessId) as { id: string; name: string; price: string; stock: string } | undefined;
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        if (new Decimal(product.stock).lessThan(item.quantity)) throw new Error(`Insufficient stock for ${product.name}`);

        total = total.plus(new Decimal(product.price).times(item.quantity));

        db.prepare(
          `INSERT INTO sale_items (id, sale_id, product_id, combo_id, quantity, price) VALUES (?, ?, ?, NULL, ?, ?)`
        ).run(randomUUID(), saleId, product.id, String(item.quantity), product.price);

        decrementProductStock(db, product.id, new Decimal(item.quantity));
      }

      const finishedAt = new Date().toISOString();
      db.prepare('UPDATE sales SET total = ?, updated_at = ? WHERE id = ?').run(total.toString(), finishedAt, saleId);

      db.prepare(
        `INSERT INTO transactions (id, business_id, type, amount, description, category, sale_id, date, created_at, updated_at)
         VALUES (?, ?, 'INCOME', ?, ?, 'Ventas', ?, ?, ?, ?)`
      ).run(randomUUID(), input.businessId, total.toString(), `Venta #${saleId.slice(0, 8)}`, saleId, finishedAt, finishedAt, finishedAt);
    });

    run();
    return hydrateSale(db, findSaleRow(db, saleId)!);
  },

  async updateStatus(id: string, businessId: string, status: string): Promise<SaleRecord> {
    const db = getDb();
    const sale = findSaleRow(db, id);
    if (!sale || sale.business_id !== businessId) throw new Error('Sale not found');
    if (sale.status === status) return hydrateSale(db, sale);

    const run = db.transaction(() => {
      const now = new Date().toISOString();

      if (sale.status === 'PENDING_WEB' && status === 'COMPLETED') {
        db.prepare(
          `INSERT INTO transactions (id, business_id, type, amount, description, category, sale_id, date, created_at, updated_at)
           VALUES (?, ?, 'INCOME', ?, ?, 'Ventas', ?, ?, ?, ?)`
        ).run(randomUUID(), businessId, sale.total, `Venta Web #${sale.id.slice(0, 8)} Completada`, sale.id, now, now, now);
      }

      if (status === 'CANCELLED' && sale.status !== 'CANCELLED') {
        const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as {
          product_id: string | null;
          combo_id: string | null;
          quantity: string;
        }[];

        for (const item of items) {
          if (item.combo_id) {
            const comboItems = db.prepare('SELECT * FROM combo_items WHERE combo_id = ?').all(item.combo_id) as {
              product_id: string;
              quantity: string;
            }[];
            for (const ci of comboItems) {
              incrementProductStock(db, ci.product_id, new Decimal(ci.quantity).times(item.quantity));
            }
            continue;
          }
          if (!item.product_id) continue;
          incrementProductStock(db, item.product_id, new Decimal(item.quantity));
        }

        // Unlike the original Postgres version, this also reverses the
        // sale's INCOME transaction (if one was created) — a cancelled sale
        // shouldn't keep counting as revenue in Caja/Reportes. Fixed while
        // porting, since this repository has to get it right anyway; safe to
        // do precisely because sale_id links a transaction to its sale (the
        // Postgres `Transaction` model has no such column, which is why that
        // path still can't do this — see prisma-datasource.ts).
        db.prepare('DELETE FROM transactions WHERE business_id = ? AND sale_id = ?').run(businessId, id);
      }

      db.prepare('UPDATE sales SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    });

    run();
    return hydrateSale(db, findSaleRow(db, id)!);
  },
};
