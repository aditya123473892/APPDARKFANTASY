import * as SQLite from 'expo-sqlite';
import * as FS from 'expo-file-system/legacy';
import type { VaultPhoto, QueueJob } from './types';

const databases = new Map<string, Promise<SQLite.SQLiteDatabase>>();
export function directory(owner: string): string {
  if (!/^[a-f0-9]{24}$/.test(owner)) throw new Error('Invalid local account');
  if (!FS.documentDirectory) throw new Error('Vault requires Android');
  // Preserve encrypted-build data separately for recovery using branch encrypt.
  return `${FS.documentDirectory}vault/${owner}/simple/`;
}
export function database(owner: string): Promise<SQLite.SQLiteDatabase> {
  let current = databases.get(owner);
  if (!current) {
    current = (async () => {
      const dir = directory(owner);
      await FS.makeDirectoryAsync(dir, { intermediates: true });
      const db = await SQLite.openDatabaseAsync('vault.db', {}, dir);
      await db.execAsync(`PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
        CREATE TABLE IF NOT EXISTS photos (
          id TEXT PRIMARY KEY, s3Key TEXT, localPath TEXT, sha256 TEXT NOT NULL, size INTEGER NOT NULL,
          status TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 1, sortOrder INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, deletedAt INTEGER, syncState TEXT NOT NULL, error TEXT);
        CREATE TABLE IF NOT EXISTS queue (id TEXT PRIMARY KEY, photoId TEXT NOT NULL, operation TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0, nextAttemptAt INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
      // Videos were added later; existing rows are photos. Fails harmlessly once the column exists.
      await db
        .execAsync("ALTER TABLE photos ADD COLUMN kind TEXT NOT NULL DEFAULT 'photo'")
        .catch(() => undefined);
      for (const column of [
        'localEncrypted INTEGER NOT NULL DEFAULT 0',
        'remoteEncrypted INTEGER NOT NULL DEFAULT 0',
      ])
        await db.execAsync('ALTER TABLE photos ADD COLUMN ' + column).catch(() => undefined);
      // Recover interrupted work after process death.
      await db.runAsync("UPDATE photos SET syncState='pending' WHERE syncState='syncing'");
      await repairQueueIn(db);
      return db;
    })();
    databases.set(owner, current);
    current.catch(() => databases.delete(owner));
  }
  return current;
}
/** Repair work left without a queue entry by an older build or interrupted migration. */
async function repairQueueIn(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(`INSERT OR IGNORE INTO queue (id,photoId,operation)
    SELECT id || ':' || CASE WHEN deletedAt IS NOT NULL THEN 'delete' WHEN s3Key IS NULL THEN 'upload' ELSE 'patch' END,
      id, CASE WHEN deletedAt IS NOT NULL THEN 'delete' WHEN s3Key IS NULL THEN 'upload' ELSE 'patch' END
    FROM photos WHERE syncState NOT IN ('synced','rejected')
      AND (deletedAt IS NOT NULL OR s3Key IS NOT NULL OR localPath IS NOT NULL)`);
}
export async function repairQueue(owner: string): Promise<void> {
  await repairQueueIn(await database(owner));
}
export async function list(owner: string): Promise<VaultPhoto[]> {
  const rows = await (
    await database(owner)
  ).getAllAsync<VaultPhoto>(
    'SELECT * FROM photos WHERE deletedAt IS NULL ORDER BY sortOrder,createdAt DESC',
  );
  return rows.map((row) => ({ ...row, remoteEncrypted: !!row.remoteEncrypted }));
}
export async function get(owner: string, id: string): Promise<VaultPhoto | null> {
  const row = await (
    await database(owner)
  ).getFirstAsync<VaultPhoto>('SELECT * FROM photos WHERE id=?', id);
  return row ? { ...row, remoteEncrypted: !!row.remoteEncrypted } : null;
}
export async function save(
  owner: string,
  photo: VaultPhoto,
  operation?: QueueJob['operation'],
): Promise<void> {
  const db = await database(owner);
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync(
      `INSERT OR REPLACE INTO photos
      (id,kind,s3Key,localPath,sha256,size,status,hidden,sortOrder,createdAt,updatedAt,deletedAt,syncState,error)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      photo.id,
      photo.kind === 'video' ? 'video' : 'photo',
      photo.s3Key,
      photo.localPath,
      photo.sha256,
      photo.size,
      photo.status,
      photo.hidden,
      photo.sortOrder,
      photo.createdAt,
      photo.updatedAt,
      photo.deletedAt,
      photo.syncState,
      photo.error,
    );
    await tx.runAsync(
      'UPDATE photos SET localEncrypted=?, remoteEncrypted=? WHERE id=?',
      photo.localEncrypted === 1 ? 1 : 0,
      photo.remoteEncrypted ? 1 : 0,
      photo.id,
    );
    if (operation)
      await tx.runAsync(
        `INSERT OR IGNORE INTO queue (id,photoId,operation) VALUES (?,?,?)`,
        `${photo.id}:${operation}`,
        photo.id,
        operation,
      );
  });
}
export async function setting(owner: string, id: string): Promise<string | null> {
  return (
    (
      await (
        await database(owner)
      ).getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE id=?', id)
    )?.value ?? null
  );
}
export async function setSetting(owner: string, id: string, value: string): Promise<void> {
  await (await database(owner)).runAsync('INSERT OR REPLACE INTO settings VALUES (?,?)', id, value);
}
export async function unsynced(owner: string): Promise<number> {
  const row = await (
    await database(owner)
  ).getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM photos WHERE syncState!='synced'",
  );
  // A different build may still hold unsynced encrypted photos in its original DB.
  // Never discard those silently when logging out of the simpler build.
  const legacyDir = directory(owner).replace(/simple\/$/, '');
  if (!(await FS.getInfoAsync(`${legacyDir}vault.db`)).exists) return row?.count ?? 0;
  const legacy = await SQLite.openDatabaseAsync('vault.db', { useNewConnection: true }, legacyDir);
  try {
    const older = await legacy.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM photos WHERE syncState!='synced'",
    );
    return (row?.count ?? 0) + (older?.count ?? 0);
  } finally {
    await legacy.closeAsync();
  }
}
/** Whether queued backup work is due. Never creates a vault for an account that has none. */
export async function hasDueJobs(owner: string): Promise<boolean> {
  if (!databases.has(owner) && !(await FS.getInfoAsync(`${directory(owner)}vault.db`)).exists)
    return false;
  const row = await (
    await database(owner)
  ).getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM queue WHERE nextAttemptAt<=?',
    Date.now(),
  );
  return (row?.count ?? 0) > 0;
}
export async function close(owner: string): Promise<void> {
  const db = databases.get(owner);
  databases.delete(owner);
  if (db) await (await db).closeAsync();
}
