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
      // Recover interrupted work after process death.
      await db.runAsync("UPDATE photos SET syncState='pending' WHERE syncState='syncing'");
      return db;
    })();
    databases.set(owner, current);
    current.catch(() => databases.delete(owner));
  }
  return current;
}
export async function list(owner: string): Promise<VaultPhoto[]> {
  return (await database(owner)).getAllAsync<VaultPhoto>(
    'SELECT * FROM photos WHERE deletedAt IS NULL ORDER BY sortOrder,createdAt DESC',
  );
}
export async function get(owner: string, id: string): Promise<VaultPhoto | null> {
  return (await database(owner)).getFirstAsync<VaultPhoto>('SELECT * FROM photos WHERE id=?', id);
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
      (id,s3Key,localPath,sha256,size,status,hidden,sortOrder,createdAt,updatedAt,deletedAt,syncState,error)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      photo.id,
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
export async function close(owner: string): Promise<void> {
  const db = databases.get(owner);
  databases.delete(owner);
  if (db) await (await db).closeAsync();
}
