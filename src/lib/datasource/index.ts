import type { DataSource } from './types';

export * from './types';

let cached: DataSource | null = null;

/**
 * Picks which backend every API route talks to. WALTI_RUNTIME is set by
 * WALTI Desktop's Electron main process before it spawns the embedded
 * Next.js server — unset (the normal Vercel deployment) always means Prisma
 * + Postgres, exactly as before this file existed.
 *
 * Loading each implementation lazily via dynamic `import()` (not a static
 * import, and NOT a runtime `require()` either — confirmed by hand that
 * Next.js's webpack bundling for API routes silently produces an empty
 * exports object for a conditionally-`require()`'d local module, with no
 * thrown error) keeps `better-sqlite3` — a native module — out of the
 * module graph entirely unless this ever actually picks the desktop branch.
 */
export async function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  if (process.env.WALTI_RUNTIME === 'desktop') {
    cached = (await import('./sqlite-datasource')).sqliteDataSource;
  } else {
    cached = (await import('./prisma-datasource')).prismaDataSource;
  }
  return cached;
}
