#!/usr/bin/env node
/**
 * One-off tool: exports ONE business's full data from the production
 * Postgres/Neon database into a ready-to-use WALTI Desktop data folder
 * (SQLite db + local images), for businesses switching from the web/SaaS
 * product to the desktop one who don't want to lose what they already
 * loaded. Read-only against Postgres — never writes back.
 *
 * The SQLite schema here is copied from
 * src/lib/datasource/sqlite/migrations/0001_init.ts — if that file
 * changes, update this too.
 *
 * Usage: node scripts/migrate-business-to-desktop.cjs <businessId> <outputDir>
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');

const SCHEMA_SQL = `
CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE business_users (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  business_id TEXT NOT NULL REFERENCES businesses(id),
  role TEXT NOT NULL DEFAULT 'ADMIN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_business_users_user ON business_users(user_id);
CREATE INDEX idx_business_users_business ON business_users(business_id);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  price TEXT NOT NULL DEFAULT '0',
  stock TEXT NOT NULL DEFAULT '0',
  image_url TEXT,
  barcode TEXT,
  category TEXT,
  expiration_date TEXT,
  sold_by_weight INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_products_business ON products(business_id);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_clients_business ON clients(business_id);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_suppliers_business ON suppliers(business_id);

CREATE TABLE combos (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  price TEXT NOT NULL DEFAULT '0',
  image_url TEXT,
  barcode TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_combos_business ON combos(business_id);

CREATE TABLE combo_items (
  id TEXT PRIMARY KEY,
  combo_id TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity TEXT NOT NULL
);
CREATE INDEX idx_combo_items_combo ON combo_items(combo_id);

CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  client_id TEXT REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  total TEXT NOT NULL DEFAULT '0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_sales_business ON sales(business_id);

CREATE TABLE sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  combo_id TEXT REFERENCES combos(id),
  quantity TEXT NOT NULL,
  price TEXT NOT NULL
);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  supplier_id TEXT REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  total TEXT NOT NULL DEFAULT '0',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_purchases_business ON purchases(business_id);

CREATE TABLE purchase_items (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity TEXT NOT NULL,
  price TEXT NOT NULL
);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id),
  type TEXT NOT NULL,
  amount TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  sale_id TEXT REFERENCES sales(id),
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_transactions_business ON transactions(business_id);
CREATE INDEX idx_transactions_sale ON transactions(sale_id);

CREATE TABLE business_settings (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE REFERENCES businesses(id),
  currency TEXT NOT NULL DEFAULT 'ARS',
  tax_rate REAL NOT NULL DEFAULT 0,
  shift_morning_start_hour INTEGER NOT NULL DEFAULT 8,
  shift_morning_end_hour INTEGER NOT NULL DEFAULT 12,
  shift_night_start_hour INTEGER NOT NULL DEFAULT 16,
  shift_night_end_hour INTEGER NOT NULL DEFAULT 21,
  shift_morning_label TEXT NOT NULL DEFAULT 'Turno Mañana',
  shift_night_label TEXT NOT NULL DEFAULT 'Turno Noche',
  ticket_width_mm INTEGER NOT NULL DEFAULT 58,
  print_ticket_on_sale INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
`;

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function iso(d) {
  return d ? new Date(d).toISOString() : new Date().toISOString();
}

async function downloadImage(url, businessId, imagesRoot, log) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log(`  ! no se pudo descargar imagen (${res.status}): ${url}`);
      return null;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = EXT_BY_MIME[contentType.split(';')[0].trim()] || 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const dir = path.join(imagesRoot, businessId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), Buffer.from(await res.arrayBuffer()));
    return `/api/local-images/file/${businessId}/${filename}`;
  } catch (err) {
    log(`  ! error descargando imagen: ${url} (${err.message})`);
    return null;
  }
}

async function migrateBusiness(businessId, outputDir) {
  const prisma = new PrismaClient();
  const log = (msg) => console.log(`[migrate] ${msg}`);

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error(`No existe el negocio ${businessId}`);
  log(`Migrando negocio "${business.name}" (${businessId})`);

  const dataDir = path.join(outputDir, 'data');
  const imagesRoot = path.join(dataDir, 'images');
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'walti.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run('0001_init', new Date().toISOString());

  const [businessUsers, products, clients, suppliers, combos, comboItems, sales, saleItems, purchases, purchaseItems, transactions, settings] =
    await Promise.all([
      prisma.businessUser.findMany({ where: { businessId }, include: { user: true } }),
      prisma.product.findMany({ where: { businessId } }),
      prisma.client.findMany({ where: { businessId } }),
      prisma.supplier.findMany({ where: { businessId } }),
      prisma.combo.findMany({ where: { businessId } }),
      prisma.comboItem.findMany({ where: { combo: { businessId } } }),
      prisma.sale.findMany({ where: { businessId } }),
      prisma.saleItem.findMany({ where: { sale: { businessId } } }),
      prisma.purchase.findMany({ where: { businessId } }),
      prisma.purchaseItem.findMany({ where: { purchase: { businessId } } }),
      prisma.transaction.findMany({ where: { businessId } }),
      prisma.businessSettings.findUnique({ where: { businessId } }),
    ]);

  log(
    `Datos encontrados: ${businessUsers.length} usuarios, ${products.length} productos, ${clients.length} clientes, ` +
      `${suppliers.length} proveedores, ${combos.length} combos, ${sales.length} ventas, ${purchases.length} compras, ${transactions.length} movimientos de caja`
  );

  // Download images up front (sequential — there are only ever a handful per business).
  const productImageMap = new Map();
  for (const p of products) {
    if (!p.imageUrl) continue;
    log(`Descargando imagen de producto "${p.name}"...`);
    const localUrl = await downloadImage(p.imageUrl, businessId, imagesRoot, log);
    if (localUrl) productImageMap.set(p.id, localUrl);
  }
  const comboImageMap = new Map();
  for (const c of combos) {
    if (!c.imageUrl) continue;
    log(`Descargando imagen de combo "${c.name}"...`);
    const localUrl = await downloadImage(c.imageUrl, businessId, imagesRoot, log);
    if (localUrl) comboImageMap.set(c.id, localUrl);
  }

  const run = db.transaction(() => {
    db.prepare('INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(
      business.id,
      business.name,
      iso(business.createdAt),
      iso(business.updatedAt)
    );

    const insertedUserIds = new Set();
    for (const bu of businessUsers) {
      if (!insertedUserIds.has(bu.user.id)) {
        db.prepare(
          'INSERT INTO users (id, email, username, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(bu.user.id, bu.user.email, bu.user.username, bu.user.passwordHash, bu.user.name, iso(bu.user.createdAt), iso(bu.user.updatedAt));
        insertedUserIds.add(bu.user.id);
      }
      db.prepare(
        'INSERT INTO business_users (id, user_id, business_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(bu.id, bu.userId, bu.businessId, bu.role, iso(bu.createdAt), iso(bu.updatedAt));
    }

    for (const p of products) {
      db.prepare(
        `INSERT INTO products (id, business_id, name, description, price, stock, image_url, barcode, category, expiration_date, sold_by_weight, created_at, updated_at)
         VALUES (@id, @businessId, @name, @description, @price, @stock, @imageUrl, @barcode, @category, @expirationDate, @soldByWeight, @createdAt, @updatedAt)`
      ).run({
        id: p.id,
        businessId: p.businessId,
        name: p.name,
        description: p.description,
        price: p.price.toString(),
        stock: p.stock.toString(),
        imageUrl: productImageMap.get(p.id) || null,
        barcode: p.barcode,
        category: p.category,
        expirationDate: p.expirationDate ? iso(p.expirationDate) : null,
        soldByWeight: p.soldByWeight ? 1 : 0,
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
      });
    }

    for (const c of clients) {
      db.prepare('INSERT INTO clients (id, business_id, name, email, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        c.id, c.businessId, c.name, c.email, c.phone, c.address, iso(c.createdAt), iso(c.updatedAt)
      );
    }

    for (const s of suppliers) {
      db.prepare('INSERT INTO suppliers (id, business_id, name, email, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        s.id, s.businessId, s.name, s.email, s.phone, s.address, iso(s.createdAt), iso(s.updatedAt)
      );
    }

    for (const c of combos) {
      db.prepare(
        `INSERT INTO combos (id, business_id, name, description, price, image_url, barcode, is_active, created_at, updated_at)
         VALUES (@id, @businessId, @name, @description, @price, @imageUrl, @barcode, @isActive, @createdAt, @updatedAt)`
      ).run({
        id: c.id,
        businessId: c.businessId,
        name: c.name,
        description: c.description,
        price: c.price.toString(),
        imageUrl: comboImageMap.get(c.id) || null,
        barcode: c.barcode,
        isActive: c.isActive ? 1 : 0,
        createdAt: iso(c.createdAt),
        updatedAt: iso(c.updatedAt),
      });
    }
    for (const ci of comboItems) {
      db.prepare('INSERT INTO combo_items (id, combo_id, product_id, quantity) VALUES (?, ?, ?, ?)').run(
        ci.id, ci.comboId, ci.productId, ci.quantity.toString()
      );
    }

    for (const s of sales) {
      db.prepare(
        'INSERT INTO sales (id, business_id, client_id, status, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(s.id, s.businessId, s.clientId, s.status, s.total.toString(), iso(s.createdAt), iso(s.updatedAt));
    }
    for (const si of saleItems) {
      db.prepare('INSERT INTO sale_items (id, sale_id, product_id, combo_id, quantity, price) VALUES (?, ?, ?, ?, ?, ?)').run(
        si.id, si.saleId, si.productId, si.comboId, si.quantity.toString(), si.price.toString()
      );
    }

    for (const p of purchases) {
      db.prepare(
        'INSERT INTO purchases (id, business_id, supplier_id, status, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(p.id, p.businessId, p.supplierId, p.status, p.total.toString(), iso(p.createdAt), iso(p.updatedAt));
    }
    for (const pi of purchaseItems) {
      db.prepare('INSERT INTO purchase_items (id, purchase_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)').run(
        pi.id, pi.purchaseId, pi.productId, pi.quantity.toString(), pi.price.toString()
      );
    }

    // sale_id is always NULL here — the Postgres Transaction model has no
    // such column (it was added only for the SQLite repository, see
    // src/lib/datasource/sqlite/repositories/sales.ts), so there is no way
    // to know from the source data which income transaction belongs to
    // which sale. Cancelling one of these migrated sales later won't
    // auto-reverse its transaction — same limitation the web version
    // always had for these records.
    for (const t of transactions) {
      db.prepare(
        'INSERT INTO transactions (id, business_id, type, amount, description, category, sale_id, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)'
      ).run(t.id, t.businessId, t.type, t.amount.toString(), t.description, t.category, iso(t.date), iso(t.createdAt), iso(t.updatedAt));
    }

    if (settings) {
      db.prepare(
        `INSERT INTO business_settings (id, business_id, currency, tax_rate, shift_morning_start_hour, shift_morning_end_hour,
          shift_night_start_hour, shift_night_end_hour, shift_morning_label, shift_night_label, ticket_width_mm, print_ticket_on_sale)
         VALUES (@id, @businessId, @currency, @taxRate, @shiftMorningStartHour, @shiftMorningEndHour,
          @shiftNightStartHour, @shiftNightEndHour, @shiftMorningLabel, @shiftNightLabel, @ticketWidthMm, @printTicketOnSale)`
      ).run({
        id: settings.id,
        businessId: settings.businessId,
        currency: settings.currency,
        taxRate: Number(settings.taxRate),
        shiftMorningStartHour: settings.shiftMorningStartHour,
        shiftMorningEndHour: settings.shiftMorningEndHour,
        shiftNightStartHour: settings.shiftNightStartHour,
        shiftNightEndHour: settings.shiftNightEndHour,
        shiftMorningLabel: settings.shiftMorningLabel,
        shiftNightLabel: settings.shiftNightLabel,
        ticketWidthMm: settings.ticketWidthMm,
        printTicketOnSale: settings.printTicketOnSale ? 1 : 0,
      });
    }
  });

  run();
  db.close();
  await prisma.$disconnect();

  log(`Listo -> ${dataDir}`);
  log(`Usuarios para loguearse: ${businessUsers.map((bu) => bu.user.username || bu.user.email).join(', ')}`);
}

const [, , businessId, outputDir] = process.argv;
if (!businessId || !outputDir) {
  console.error('Uso: node scripts/migrate-business-to-desktop.cjs <businessId> <outputDir>');
  process.exit(1);
}

migrateBusiness(businessId, outputDir).catch((err) => {
  console.error('[migrate] Falló:', err);
  process.exit(1);
});
