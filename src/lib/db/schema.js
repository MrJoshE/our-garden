import Dexie from 'dexie';

const DB_NAME = 'garden-journal';

/** The newest schema version. Keep it equal to the last db.version() below. */
export const SCHEMA_VERSION = 1;

/** @typedef {Record<string, any>} JournalRecord */
/** @typedef {import('dexie').Table<JournalRecord, string>} RecordTable */
/** @typedef {import('dexie').Table<{ key: string, [field: string]: any }, string>} KeyedTable */

// Dexie adds a property for each table at runtime; this tells the checker.
/**
 * @typedef {Dexie & {
 *   gardens: RecordTable, areas: RecordTable, plants: RecordTable, issues: RecordTable,
 *   entries: RecordTable, photos: RecordTable, tasks: RecordTable, visits: RecordTable,
 *   people: RecordTable, changes: RecordTable, drafts: KeyedTable, meta: KeyedTable
 * }} Database
 */

/**
 * The database with every schema version.
 *
 * Schema changes go through new versions only. Never edit an existing
 * version's stores. Each new version needs an upgrade that also writes its
 * number to schemaVersion in meta, and importJournal (backup.js) needs to
 * upgrade backups made at older versions in the same way. For example:
 *
 *   db.version(2).stores({ ... }).upgrade(async (tx) => {
 *     ...
 *     await tx.table('meta').put({ key: 'schemaVersion', value: 2 });
 *   });
 *
 * @param {string} [name]
 * @returns {Database}
 */
export function createDatabase(name = DB_NAME) {
  const db = new Dexie(name);

  db.version(1).stores({
    gardens: 'id',
    areas: 'id, gardenId',
    plants: 'id, gardenId, areaId, coverPhotoId, status, *tags',
    issues: 'id, gardenId, plantId, areaId, status, *tags',
    entries: 'id, gardenId, plantId, areaId, issueId, visitId, taskId, doneBy, [plantId+occurredOn], *tags',
    // deletedAt is indexed so the start-up purge reads only deleted photos.
    // IndexedDB leaves null out of an index, so live photos cost nothing.
    photos: 'id, gardenId, entryId, plantId, issueId, sha256, deletedAt',
    tasks: 'id, gardenId, plantId, areaId, issueId, dueOn',
    visits: 'id, gardenId, personId',
    people: 'id',
    changes: 'id, gardenId, recordId, by',
    drafts: 'key',
    meta: 'key'
  });

  // A new database is created at the newest version and runs no upgrades.
  db.on('populate', (tx) => tx.table('meta').add({ key: 'schemaVersion', value: SCHEMA_VERSION }));

  return /** @type {Database} */ (db);
}

export const db = createDatabase();

/**
 * @param {JournalRecord | undefined} record
 * @returns {record is JournalRecord} true for a record that exists and is not deleted
 */
export function isCurrent(record) {
  return record != null && record.deletedAt == null;
}

/**
 * @param {JournalRecord | undefined} record
 * @returns {JournalRecord | undefined} the record, or undefined if it is missing or deleted
 */
export function current(record) {
  return isCurrent(record) ? record : undefined;
}
