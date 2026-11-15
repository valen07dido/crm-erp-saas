import { getDb } from './connection';
import { MIGRATIONS } from './migrations';

export function runMigrations(): void {
  const db = getDb();
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');

  const appliedRows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
  const applied = new Set(appliedRows.map((r) => r.name));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    db.exec(migration.sql);
    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(migration.name, new Date().toISOString());
  }
}
