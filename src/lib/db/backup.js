// A backup is a zip: garden-journal.json holds every record except drafts,
// and photos/ holds each photo and thumbnail as a file named by the photo's
// id. Change the format only with a new schemaVersion.

import { Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8, unzipSync } from 'fflate';
import { db, SCHEMA_VERSION } from './schema.js';
import { write } from './write.js';
import { logError } from '../log.js';

const JSON_FILE = 'garden-journal.json';
const PHOTO_FIELDS = /** @type {const} */ (['blob', 'thumb']);

/**
 * @param {string} id
 * @param {'blob' | 'thumb'} field
 */
const photoFile = (id, field) => `photos/${id}${field === 'thumb' ? '-thumb' : ''}.jpg`;

/** Why a file was refused. Raised before anything is changed. */
export class BackupError extends Error {
  /**
   * @param {'notBackup' | 'newerBackup'} reason
   * @param {unknown} [cause]
   */
  constructor(reason, cause) {
    super(reason === 'notBackup' ? 'The file is not a Garden Journal backup' : 'The backup is from a newer schema version', { cause });
    this.name = 'BackupError';
    this.reason = reason;
  }
}

/**
 * The whole journal as a zip, built a photo at a time so a large journal is
 * never held in memory all at once.
 * @param {(done: number, total: number) => void} [onProgress] called after each photo
 * @returns {Promise<{ zip: Blob, unreadable: number }>} unreadable: photos left out
 *   because the browser could no longer read their files
 */
export async function exportJournal(onProgress) {
  // One read, so the records agree with each other. Photos come back holding
  // Blob handles; their bytes are read afterwards, because waiting on
  // anything but the database inside the transaction would end it.
  const tables = db.tables.filter((table) => table.name !== 'drafts');
  const rows = await db.transaction('r', tables, () => Promise.all(tables.map((table) => table.toArray())));
  const records = Object.fromEntries(tables.map((table, index) => [table.name, rows[index]]));
  const photos = records.photos.filter((photo) => photo.blob || photo.thumb);
  records.photos = records.photos.map(({ blob, thumb, ...photo }) => photo);

  /** @type {Blob[]} */
  const parts = [];
  /** @type {BlobPart[]} */
  let chunks = [];
  // The streams here are synchronous, so this runs inside each push
  const zip = new Zip((error, chunk) => {
    if (error) throw error;
    chunks.push(chunk);
  });
  // A Blob lets the browser move what's written so far out of memory
  const flush = () => {
    parts.push(new Blob(chunks));
    chunks = [];
  };

  const json = new ZipDeflate(JSON_FILE, { level: 6 });
  zip.add(json);
  const backup = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), appVersion: __APP_VERSION__, tables: records };
  json.push(strToU8(JSON.stringify(backup)), true);
  flush();

  let unreadable = 0;
  for (const [index, photo] of photos.entries()) {
    let lost = false;
    for (const field of PHOTO_FIELDS) {
      if (!photo[field]) continue;
      let bytes;
      try {
        bytes = new Uint8Array(await photo[field].arrayBuffer());
      } catch (error) {
        // Browsers have lost stored files before. Leave this one out, as if
        // purged, rather than fail the whole backup.
        logError(error, { operation: 'exportJournal', table: 'photos', recordId: photo.id, field });
        lost = true;
        continue;
      }
      const file = new ZipPassThrough(photoFile(photo.id, field));
      zip.add(file);
      file.push(bytes, true);
    }
    if (lost) unreadable++;
    flush();
    onProgress?.(index + 1, photos.length);
  }

  zip.end();
  flush();
  return { zip: new Blob(parts, { type: 'application/zip' }), unreadable };
}

/** Photos are read from the zip this many at a time, to keep memory down */
const PHOTO_BATCH = 50;

/**
 * Merges a backup into the journal in one transaction. A record new to this
 * device is added; one it already has is replaced only if the backup's copy
 * was changed more recently. Throws a BackupError, changing nothing, for a
 * file that isn't a backup or comes from a newer version of the app.
 * @param {Blob} file
 * @param {(done: number, total: number) => void} [onProgress] called as photos are read
 * @returns {Promise<{ added: Record<string, number>, updated: Record<string, number>, skipped: number }>}
 *   added and updated count records by table; skipped counts records too damaged to use
 */
export async function importJournal(file, onProgress) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  /** @param {(name: string) => boolean} wanted */
  const unzip = (wanted) => unzipSync(bytes, { filter: (entry) => wanted(entry.name) });

  // A backup unzipped and zipped again, as the Files app's Compress does,
  // holds everything in a folder. Mac zips add a __MACOSX folder of their own.
  let json;
  let folder = '';
  try {
    const found = unzip((name) => (name === JSON_FILE || name.endsWith(`/${JSON_FILE}`)) && !name.startsWith('__MACOSX/'));
    const name = Object.keys(found).sort((a, b) => a.length - b.length)[0];
    json = found[name];
    folder = name?.slice(0, -JSON_FILE.length) ?? '';
  } catch (error) {
    throw new BackupError('notBackup', error);
  }
  /** @type {any} */
  let backup;
  try {
    backup = JSON.parse(strFromU8(json));
  } catch {
    // Not passed on as the cause: its message can quote the file, which holds journal text
    throw new BackupError('notBackup');
  }
  if (typeof backup?.tables !== 'object' || !Number.isInteger(backup.schemaVersion)) throw new BackupError('notBackup');
  if (backup.schemaVersion > SCHEMA_VERSION) throw new BackupError('newerBackup');

  let skipped = 0;
  /**
   * The rows of one table that are sound enough to use
   * @param {string} table
   * @param {(row: any) => boolean} isSound
   * @returns {any[]}
   */
  const rows = (table, isSound) => {
    const all = Array.isArray(backup.tables[table]) ? backup.tables[table] : [];
    const sound = all.filter((row) => row !== null && typeof row === 'object' && isSound(row));
    skipped += all.length - sound.length;
    return sound;
  };
  const isRecord = (/** @type {any} */ row) => typeof row.id === 'string' && !Number.isNaN(Date.parse(row.updatedAt));

  const tables = db.tables.map((table) => table.name).filter((name) => !['drafts', 'changes', 'meta'].includes(name));
  const records = Object.fromEntries(tables.map((table) => [table, rows(table, isRecord)]));
  const changes = rows('changes', (row) => typeof row.id === 'string');
  const meta = rows('meta', (row) => typeof row.key === 'string');

  // Photo files become Blobs before the transaction, because waiting on
  // anything but the database inside it would end it
  /** @type {Map<string, Record<string, Blob>>} */
  const photoFiles = new Map();
  for (let start = 0; start < records.photos.length; start += PHOTO_BATCH) {
    const batch = records.photos.slice(start, start + PHOTO_BATCH);
    const names = new Set(batch.flatMap((photo) => PHOTO_FIELDS.map((field) => folder + photoFile(photo.id, field))));
    const files = unzip((name) => names.has(name));
    for (const photo of batch) {
      /** @type {Record<string, Blob>} */
      const found = {};
      for (const field of PHOTO_FIELDS) {
        const data = files[folder + photoFile(photo.id, field)];
        if (data) found[field] = new Blob([data], { type: 'image/jpeg' });
      }
      photoFiles.set(photo.id, found);
    }
    onProgress?.(start + batch.length, records.photos.length);
    // Lets the page show the progress
    await new Promise((resolve) => setTimeout(resolve));
  }

  return write('importJournal', tables, async (w) => {
    /** @type {Record<string, number>} */
    const added = {};
    /** @type {Record<string, number>} */
    const updated = {};
    for (const table of tables) {
      const existing = await db.table(table).bulkGet(records[table].map((record) => record.id));
      for (const [index, record] of records[table].entries()) {
        const local = existing[index];
        if (local && Date.parse(record.updatedAt) <= Date.parse(local.updatedAt)) continue;
        let next = record;
        if (table === 'photos') {
          // A file missing from the backup keeps the one this device has
          const files = photoFiles.get(record.id) ?? {};
          next = { ...record, blob: files.blob ?? local?.blob ?? null, thumb: files.thumb ?? local?.thumb ?? null };
        }
        await w.putImported(table, next, local);
        const counts = local ? updated : added;
        counts[table] = (counts[table] ?? 0) + 1;
      }
    }

    // History from the other device. Its rows are never edited, so only new ones matter.
    const known = await db.table('changes').bulkGet(changes.map((row) => row.id));
    await db.table('changes').bulkPut(changes.filter((_, index) => !known[index]));

    // The rest of meta belongs to this device, such as its id and error log
    for (const key of ['currentPersonId', 'lastGardenId']) {
      const row = meta.find((each) => each.key === key);
      if (row && !(await db.table('meta').get(key))) await db.table('meta').put({ key, value: row.value });
    }
    return { added, updated, skipped };
  });
}
