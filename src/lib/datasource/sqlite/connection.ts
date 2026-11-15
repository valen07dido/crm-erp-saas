import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

function resolveDbPath(): string {
  // Set by WALTI Desktop's Electron main process (app.getPath('userData')).
  // Falls back to a gitignored file in the repo for `npm run dev:desktop`
  // (iterating on desktop-mode logic without the full Electron shell).
  const configured = process.env.WALTI_DB_PATH;
  if (configured) return configured;
  return path.join(process.cwd(), '.data', 'walti.db');
}

// Next.js dev mode re-evaluates this module between some API requests
// (its own server module cache isn't as stable as a plain long-lived Node
// process) — a plain module-scoped `let db` would silently open a new,
// never-closed better-sqlite3 connection on each such reload, leaking file
// handles on walti.db-wal/-shm until the whole process exits (this is what
// made backup restore's file swap intermittently fail with EBUSY: earlier
// requests' connections were still holding the file open, invisible to the
// current request's own `db` variable). Stashing the instance on
// `globalThis` survives module reloads — the same pattern Next.js's own
// docs recommend for a dev-mode PrismaClient singleton.
const globalForDb = globalThis as unknown as { __waltiDb?: Database.Database | null };

export function getDb(): Database.Database {
  if (globalForDb.__waltiDb) return globalForDb.__waltiDb;
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  globalForDb.__waltiDb = db;
  return db;
}

export function getDbPath(): string {
  return resolveDbPath();
}

// Used by the backup/restore flow (src/lib/backup.ts) — better-sqlite3 holds
// an open file handle, so the underlying .db file can't be safely replaced
// without closing it first. getDb() lazily reopens on the next call.
export function closeDb(): void {
  if (globalForDb.__waltiDb) {
    globalForDb.__waltiDb.close();
    globalForDb.__waltiDb = null;
  }
}
