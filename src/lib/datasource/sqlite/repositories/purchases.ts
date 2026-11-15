import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection';
import { Decimal, decToStr } from '../decimal';
import type {
  PurchaseRecord,
  PurchaseCreateInput,
  PurchaseItemRecord,
  PurchaseImportInput,
  PurchaseImportResult,
  SupplierRecord,
} from '../../types';

interface PurchaseRow {
  id: string;
  business_id: string;
  supplier_id: string | null;
  status: string;
  total: string;
  created_at: string;
  updated_at: string;
}

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

interface PurchaseItemJoinRow {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: string;
  price: string;
  product_name: string | null;
}

function mapSupplierRow(row: SupplierRow): SupplierRecord {
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

function mapItemRow(row: PurchaseItemJoinRow): PurchaseItemRecord {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    productId: row.product_id,
    quantity: row.quantity,
    price: row.price,
    product: row.product_id ? { id: row.product_id, name: row.product_name ?? '' } : null,
  };
}

function hydratePurchase(db: Database.Database, row: PurchaseRow): PurchaseRecord {
  const supplier = row.supplier_id
    ? (db.prepare('SELECT * FROM suppliers WHERE id = ?').get(row.supplier_id) as SupplierRow | undefined)
    : undefined;

  const itemRows = db
    .prepare(
      `SELECT pi.*, p.name as product_name
       FROM purchase_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.purchase_id = ?`
    )
    .all(row.id) as PurchaseItemJoinRow[];

  return {
    id: row.id,
    businessId: row.business_id,
    supplierId: row.supplier_id,
    status: row.status,
    total: row.total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    supplier: supplier ? mapSupplierRow(supplier) : null,
    items: itemRows.map(mapItemRow),
  };
}

function findRowById(db: Database.Database, id: string): PurchaseRow | undefined {
  return db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as PurchaseRow | undefined;
}

export const purchasesRepository = {
  async list(businessId: string): Promise<PurchaseRecord[]> {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM purchases WHERE business_id = ? ORDER BY created_at DESC')
      .all(businessId) as PurchaseRow[];
    return rows.map((row) => hydratePurchase(db, row));
  },

  async create(input: PurchaseCreateInput): Promise<PurchaseRecord> {
    const db = getDb();
    const purchaseId = randomUUID();
    const now = new Date().toISOString();

    const run = db.transaction(() => {
      db.prepare(
        `INSERT INTO purchases (id, business_id, supplier_id, status, total, created_at, updated_at)
         VALUES (?, ?, ?, ?, '0', ?, ?)`
      ).run(purchaseId, input.businessId, input.supplierId ?? null, input.status || 'COMPLETED', now, now);

      let total = new Decimal(0);

      for (const item of input.items) {
        const product = db
          .prepare('SELECT * FROM products WHERE id = ? AND business_id = ?')
          .get(item.productId, input.businessId) as { id: string; price: string; stock: string } | undefined;
        if (!product) throw new Error(`Product not found: ${item.productId}`);

        const itemPrice = item.price !== undefined ? new Decimal(item.price) : new Decimal(product.price);
        total = total.plus(itemPrice.times(item.quantity));

        db.prepare(
          `INSERT INTO purchase_items (id, purchase_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)`
        ).run(randomUUID(), purchaseId, item.productId, String(item.quantity), itemPrice.toString());

        const nextStock = new Decimal(product.stock).plus(item.quantity);
        db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(nextStock.toString(), now, product.id);
      }

      const finishedAt = new Date().toISOString();
      db.prepare('UPDATE purchases SET total = ?, updated_at = ? WHERE id = ?').run(total.toString(), finishedAt, purchaseId);

      db.prepare(
        `INSERT INTO transactions (id, business_id, type, amount, description, category, date, created_at, updated_at)
         VALUES (?, ?, 'EXPENSE', ?, ?, 'Compras a Proveedores', ?, ?, ?)`
      ).run(randomUUID(), input.businessId, total.toString(), `Compra #${purchaseId.slice(0, 8)}`, finishedAt, finishedAt, finishedAt);
    });

    run();
    return hydratePurchase(db, findRowById(db, purchaseId)!);
  },

  // Unlike the Postgres version (which batches a raw `UPDATE ... FROM
  // (VALUES ...)` to dodge Prisma's interactive-transaction timeout over a
  // network round-trip), better-sqlite3 is synchronous and local — a plain
  // loop over prepared statements inside one db.transaction() is already as
  // fast as it gets here, and there's no portable equivalent of that
  // Postgres-only SQL anyway.
  async bulkImport(input: PurchaseImportInput): Promise<PurchaseImportResult> {
    const db = getDb();
    const now = new Date().toISOString();

    const result = db.transaction((): PurchaseImportResult => {
      const existingProducts = db
        .prepare('SELECT * FROM products WHERE business_id = ?')
        .all(input.businessId) as { id: string; name: string; barcode: string | null; price: string; stock: string }[];

      const byBarcode = new Map(existingProducts.filter((p) => p.barcode).map((p) => [p.barcode as string, p]));
      const byName = new Map(existingProducts.map((p) => [p.name.toLowerCase(), p]));

      const updates = new Map<string, { price: string; stockIncrement: Decimal }>();
      const staged = new Map<string, { id: string; name: string; barcode: string | null; price: string; stock: Decimal }>();
      const purchaseLines: { productId: string; quantity: number; cost: number }[] = [];
      let total = new Decimal(0);
      let productsUpdated = 0;

      for (const item of input.items) {
        const quantity = Number(item.quantity) || 0;
        const cost = Number(item.cost) || 0;
        const salePrice = Number(item.salePrice) || 0;
        const name = item.name || 'Producto sin nombre';
        const stageKey = item.barcode || `name:${name.toLowerCase()}`;

        let productId: string;

        const stagedProduct = staged.get(stageKey);
        if (stagedProduct) {
          stagedProduct.price = decToStr(salePrice);
          stagedProduct.stock = stagedProduct.stock.plus(quantity);
          productId = stagedProduct.id;
        } else {
          const existing = (item.barcode && byBarcode.get(item.barcode)) || byName.get(name.toLowerCase());
          if (existing) {
            productId = existing.id;
            const u = updates.get(existing.id) || { price: decToStr(salePrice), stockIncrement: new Decimal(0) };
            u.price = decToStr(salePrice);
            u.stockIncrement = u.stockIncrement.plus(quantity);
            updates.set(existing.id, u);
          } else {
            productId = randomUUID();
            staged.set(stageKey, {
              id: productId,
              name,
              barcode: item.barcode || null,
              price: decToStr(salePrice),
              stock: new Decimal(quantity),
            });
          }
        }
        productsUpdated++;

        if (quantity > 0) {
          purchaseLines.push({ productId, quantity, cost });
          total = total.plus(new Decimal(cost).times(quantity));
        }
      }

      for (const p of staged.values()) {
        db.prepare(
          `INSERT INTO products (id, business_id, name, description, price, stock, image_url, barcode, category, expiration_date, sold_by_weight, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, NULL, ?, NULL, NULL, 0, ?, ?)`
        ).run(p.id, input.businessId, p.name, p.price, p.stock.toString(), p.barcode, now, now);
      }

      for (const [id, u] of updates.entries()) {
        const current = db.prepare('SELECT stock FROM products WHERE id = ?').get(id) as { stock: string };
        const nextStock = new Decimal(current.stock).plus(u.stockIncrement);
        db.prepare('UPDATE products SET price = ?, stock = ?, updated_at = ? WHERE id = ?').run(
          u.price,
          nextStock.toString(),
          now,
          id
        );
      }

      if (purchaseLines.length === 0) {
        return { productsUpdated, purchase: null };
      }

      const purchaseId = randomUUID();
      db.prepare(
        `INSERT INTO purchases (id, business_id, supplier_id, status, total, created_at, updated_at)
         VALUES (?, ?, ?, 'COMPLETED', ?, ?, ?)`
      ).run(purchaseId, input.businessId, input.supplierId || null, total.toString(), now, now);

      for (const line of purchaseLines) {
        db.prepare(
          `INSERT INTO purchase_items (id, purchase_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)`
        ).run(randomUUID(), purchaseId, line.productId, String(line.quantity), decToStr(line.cost));
      }

      db.prepare(
        `INSERT INTO transactions (id, business_id, type, amount, description, category, date, created_at, updated_at)
         VALUES (?, ?, 'EXPENSE', ?, ?, 'Compras a Proveedores', ?, ?, ?)`
      ).run(
        randomUUID(),
        input.businessId,
        total.toString(),
        `Compra #${purchaseId.slice(0, 8)} (Factura PDF)`,
        now,
        now,
        now
      );

      return { productsUpdated, purchase: hydratePurchase(db, findRowById(db, purchaseId)!) };
    })();

    return result;
  },
};
