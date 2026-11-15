// Money/quantity columns are TEXT (exact decimal strings), never REAL — see
// the plan doc for why: SQLite's NUMERIC affinity can't guarantee the exact
// precision Prisma's Decimal gives on Postgres. Repositories read/write them
// through decimal.js (src/lib/datasource/sqlite/decimal.ts).
export const name = '0001_init';

export const sql = `
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

-- Combos/compras: esquema reservado ya para la Etapa C (evita otra
-- migración disruptiva), aunque sus repositorios todavía no existen.
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
  -- Links an auto-generated INCOME transaction back to the sale that created
  -- it (NULL for manual entries from Caja/Gastos) — lets cancelling a sale
  -- reverse exactly its own transaction, never matching by description text.
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
`;
