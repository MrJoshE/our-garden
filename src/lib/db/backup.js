// A backup is a zip: garden-journal.json holds every record except drafts,
// and photos/ holds each photo and thumbnail as a file named by the photo's
// id. Import (5.3) reads exactly this, so change it only with a new
// schemaVersion.

import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate';
import { db, SCHEMA_VERSION } from './schema.js';
import { logError } from '../log.js';

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

  const json = new ZipDeflate('garden-journal.json', { level: 6 });
  zip.add(json);
  const backup = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), appVersion: __APP_VERSION__, tables: records };
  json.push(strToU8(JSON.stringify(backup)), true);
  flush();

  let unreadable = 0;
  for (const [index, photo] of photos.entries()) {
    let lost = false;
    for (const [field, name] of [
      ['blob', `photos/${photo.id}.jpg`],
      ['thumb', `photos/${photo.id}-thumb.jpg`]
    ]) {
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
      const file = new ZipPassThrough(name);
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
