// Adds the per-printer right-margin shift compensation (see
// src/lib/datasource/prisma-datasource.ts's matching Prisma field for why)
// as an editable business setting instead of a fixed env var baked into the
// installer — existing installs (already-migrated customer databases) pick
// this up automatically the next time the embedded server starts, via
// migrate.ts's _migrations tracking.
export const name = '0002_print_left_offset';

export const sql = `
ALTER TABLE business_settings ADD COLUMN print_left_offset_mm REAL NOT NULL DEFAULT 0;
`;
