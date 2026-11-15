import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { getDb, getDbPath, closeDb } from './datasource/sqlite/connection';

// WALTI Desktop's local backup system — a single .zip containing the SQLite
// database plus the local image store (see src/lib/local-images.ts). Manual
// export/import today via src/pages/api/backups/*; a scheduled version of
// createBackupArchive() can be called from Electron's main process on a
// timer once that wiring exists (see project notes — still staged work).

const BACKUP_FORMAT_VERSION = 1;

function imagesRoot(): string {
  return process.env.WALTI_IMAGES_DIR || path.join(process.cwd(), '.data', 'images');
}

function backupsRoot(): string {
  return process.env.WALTI_BACKUPS_DIR || path.join(process.cwd(), '.data', 'backups');
}

export function createBackupArchive(): Buffer {
  // Folds the WAL file's contents into the main .db file so a raw copy of
  // it alone is a complete, consistent snapshot (the sidecar -wal/-shm
  // files are otherwise required too, and are excluded on purpose here).
  getDb().pragma('wal_checkpoint(TRUNCATE)');

  const zip = new AdmZip();
  const manifest = { version: BACKUP_FORMAT_VERSION, createdAt: new Date().toISOString() };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));

  const dbPath = getDbPath();
  if (fs.existsSync(dbPath)) {
    zip.addLocalFile(dbPath, 'db', 'walti.db');
  }

  const imgRoot = imagesRoot();
  if (fs.existsSync(imgRoot)) {
    zip.addLocalFolder(imgRoot, 'images');
  }

  return zip.toBuffer();
}

export interface RestoreResult {
  safetyBackupPath: string;
}

// On Windows, the OS can briefly keep the WAL/SHM sidecar files locked for a
// few milliseconds after better-sqlite3's synchronous db.close() returns
// (observed in testing: an immediate unlink throws EBUSY). Retrying a few
// times with a short synchronous wait clears it reliably; it's a known
// class of Windows file-handle-release delay, not a real lock contention.
function withFsRetry<T>(fn: () => T, attempts = 10): T {
  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (error: any) {
      if (i === attempts - 1) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  throw new Error('unreachable');
}

function removeFileWithRetry(filePath: string): void {
  withFsRetry(() => {
    try {
      fs.rmSync(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  });
}

export function restoreBackupArchive(buffer: Buffer): RestoreResult {
  const zip = new AdmZip(buffer);

  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) throw new Error('Archivo de backup inválido: falta manifest.json');

  let manifest: { version?: number };
  try {
    manifest = JSON.parse(zip.readAsText(manifestEntry));
  } catch {
    throw new Error('Archivo de backup inválido: manifest.json corrupto');
  }
  if (manifest.version !== BACKUP_FORMAT_VERSION) {
    throw new Error(`Versión de backup no soportada: ${manifest.version}`);
  }

  const dbEntry = zip.getEntry('db/walti.db');
  if (!dbEntry) throw new Error('Archivo de backup inválido: falta la base de datos');

  // Safety net: snapshot the current state before touching anything, so a
  // bad restore (or the wrong file picked by mistake) can always be undone.
  fs.mkdirSync(backupsRoot(), { recursive: true });
  const safetyBackupPath = path.join(backupsRoot(), `pre-restore-${Date.now()}.zip`);
  fs.writeFileSync(safetyBackupPath, createBackupArchive());

  // better-sqlite3 holds an open file handle on the .db file — it has to be
  // closed before that file can be safely overwritten. getDb() reopens it
  // lazily on the next call, against whatever file is on disk at that point.
  closeDb();

  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  withFsRetry(() => fs.writeFileSync(dbPath, dbEntry.getData()));
  // Stale WAL/SHM files from the previous database would otherwise be
  // replayed on top of the just-restored file the next time it's opened.
  removeFileWithRetry(dbPath + '-wal');
  removeFileWithRetry(dbPath + '-shm');

  const imgRoot = path.resolve(imagesRoot());
  fs.rmSync(imgRoot, { recursive: true, force: true });
  fs.mkdirSync(imgRoot, { recursive: true });
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.startsWith('images/') || entry.isDirectory) continue;
    const relative = entry.entryName.slice('images/'.length);
    const dest = path.resolve(imgRoot, relative);
    // Path-traversal guard (zip-slip): a backup file is often handed to the
    // business owner by someone else (email, USB) and imported on trust — an
    // entry name like "../../../Startup/evil.js" must not be allowed to
    // resolve outside imgRoot. Same guard as local-images.ts's readLocalImage.
    if (dest !== imgRoot && !dest.startsWith(imgRoot + path.sep)) {
      throw new Error(`Archivo de backup inválido: entrada fuera de la carpeta de imágenes (${entry.entryName})`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.getData());
  }

  return { safetyBackupPath };
}
