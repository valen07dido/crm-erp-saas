// Numbered migrations as TS modules (not loose .sql files on disk) so they
// get bundled by webpack/SWC like any other code — a plain
// fs.readdirSync('migrations') at runtime isn't guaranteed to survive
// Next.js's `output: standalone` file-tracing into the packaged app.
import * as m0001 from './0001_init';
import * as m0002 from './0002_print_left_offset';

export interface Migration {
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [m0001, m0002];
