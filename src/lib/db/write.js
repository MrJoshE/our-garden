// The single write path. Every change to a record goes through write(), which
// runs in one transaction, stamps the record and logs the change.

import { db, isCurrent } from './schema.js';
import { uuid } from '../ids.js';
import { logError } from '../log.js';

// Dexie swaps an error thrown inside a transaction for its own when the
// error's name is one of IndexedDB's (NotFoundError, ReadOnlyError and so
// on). These names must not clash with those, or callers never see them.

export class MissingRecordError extends Error {
  /**
   * @param {string} table
   * @param {string} id
   */
  constructor(table, id) {
    super(`No ${table} record ${id}`);
    this.name = 'MissingRecordError';
    this.table = table;
    this.id = id;
  }
}

/** Thrown when something tries to change an entry the app wrote itself */
export class AutomaticEntryError extends Error {
  /** @param {string} id */
  constructor(id) {
    super(`Entry ${id} was written by the app and cannot be changed`);
    this.name = 'AutomaticEntryError';
    this.id = id;
  }
}

/** @typedef {'create' | 'update' | 'delete'} Action */

let lastStamp = '';

/**
 * Now as a UTC ISO string, always later than the last one this tab handed
 * out. Undo finds the records a delete changed by their deletedAt, so two
 * deletes must never share one, even within the same millisecond.
 */
function stamp() {
  let now = new Date().toISOString();
  if (now <= lastStamp) now = new Date(Date.parse(lastStamp) + 1).toISOString();
  lastStamp = now;
  return now;
}

/**
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
function same(a, b) {
  if (a == null && b == null) return true;
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  return false;
}

/**
 * @param {Record<string, any>} record
 * @param {Record<string, any>} patch
 * @returns {string[]} the fields in `patch` whose values differ from `record`
 */
export function changedFields(record, patch) {
  return Object.keys(patch).filter((field) => !same(record[field], patch[field]));
}

/** Makes the changes inside one write() call. All of them share `at`. */
export class Writer {
  /**
   * @param {string} at
   * @param {string | null} by the current person's id
   * @param {string} deviceId
   */
  constructor(at, by, deviceId) {
    this.at = at;
    this.by = by;
    this.deviceId = deviceId;
  }

  /**
   * @param {string} table
   * @param {string} id
   * @returns {Promise<Record<string, any>>} the record, which must exist and not be deleted
   */
  async get(table, id) {
    const record = await db.table(table).get(id);
    if (!isCurrent(record)) throw new MissingRecordError(table, id);
    return record;
  }

  /**
   * @param {string} table
   * @param {Record<string, any>} fields
   * @returns {Promise<Record<string, any>>}
   */
  async create(table, fields) {
    /** @type {Record<string, any>} */
    const record = { ...fields, id: uuid(), createdAt: this.at, updatedAt: this.at, deletedAt: null, extra: {} };
    if (table === 'gardens') record.gardenId = record.id;
    await db.table(table).add(record);
    await this.#log(table, record, 'create', Object.keys(fields));
    return record;
  }

  /**
   * Changes the given fields. Does nothing, and logs nothing, if none of
   * them differ from what is saved.
   * @param {string} table
   * @param {string} id
   * @param {Record<string, any>} patch
   */
  async update(table, id, patch) {
    return this.#change(table, await this.get(table, id), patch, 'update');
  }

  /**
   * Saves a record from a backup as it is, keeping its own id and
   * timestamps, and logs it as created or as changed from `existing`.
   * @param {string} table
   * @param {Record<string, any>} record
   * @param {Record<string, any> | undefined} existing this device's record with the same id
   */
  async putImported(table, record, existing) {
    await db.table(table).put(record);
    await this.#log(table, record, existing ? 'update' : 'create', existing ? changedFields(existing, record) : Object.keys(record));
  }

  /**
   * Soft deletes one record.
   * @param {string} table
   * @param {string} id
   */
  async remove(table, id) {
    return this.#change(table, await this.get(table, id), { deletedAt: this.at }, 'delete');
  }

  /**
   * Soft deletes every current record whose `index` equals `value`. Records
   * already deleted keep their own deletedAt, so undo leaves them alone.
   * @param {string} table
   * @param {string} index
   * @param {string} value
   */
  async removeWhere(table, index, value) {
    const records = await db.table(table).where(index).equals(value).filter(isCurrent).toArray();
    for (const record of records) await this.#change(table, record, { deletedAt: this.at }, 'delete');
  }

  /**
   * Undoes a delete: brings back the records whose `index` equals `value`
   * and that were deleted at exactly `deletedAt`.
   * @param {string} table
   * @param {string} index
   * @param {string} value
   * @param {string} deletedAt
   */
  async restoreWhere(table, index, value, deletedAt) {
    const records = await db.table(table).where(index).equals(value).filter((r) => r.deletedAt === deletedAt).toArray();
    for (const record of records) await this.#change(table, record, { deletedAt: null }, 'update');
  }

  /**
   * @param {string} table
   * @param {Record<string, any>} record
   * @param {Record<string, any>} patch
   * @param {Action} action
   * @returns {Promise<Record<string, any>>}
   */
  async #change(table, record, patch, action) {
    const fields = changedFields(record, patch);
    if (fields.length === 0) return record;
    /** @type {Record<string, any>} */
    const next = { ...record, updatedAt: this.at };
    for (const field of fields) next[field] = patch[field];
    await db.table(table).put(next);
    await this.#log(table, next, action, fields);
    return next;
  }

  /**
   * @param {string} table
   * @param {Record<string, any>} record
   * @param {Action} action
   * @param {string[]} changedFields
   */
  async #log(table, record, action, changedFields) {
    await db.table('changes').add({
      id: uuid(),
      gardenId: record.gardenId ?? null,
      table,
      recordId: record.id,
      action,
      changedFields,
      at: this.at,
      by: this.by,
      deviceId: this.deviceId
    });
  }
}

/**
 * Runs `work` in one read-write transaction over `tables`, plus changes and
 * meta. If `work` throws, nothing it did is saved, and the error is logged
 * with the operation's name before it is passed on. Validate inside `work`
 * so that rejected input is logged too.
 *
 * Inside `work`, only await Dexie calls. Awaiting anything else (image
 * decoding, crypto.subtle) lets IndexedDB commit the transaction early, so
 * do that work before calling write().
 * @template T
 * @param {string} operation the calling function's name, for the error log
 * @param {string[]} tables
 * @param {(w: Writer) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function write(operation, tables, work) {
  const scope = [...new Set([...tables, 'changes', 'meta'])];
  try {
    return await db.transaction('rw', scope, async () => {
      const [person, device] = await Promise.all([db.table('meta').get('currentPersonId'), db.table('meta').get('deviceId')]);
      let deviceId = device?.value;
      if (!deviceId) {
        deviceId = uuid();
        await db.table('meta').put({ key: 'deviceId', value: deviceId });
      }
      return work(new Writer(stamp(), person?.value ?? null, deviceId));
    });
  } catch (error) {
    logError(error, { operation, tables: scope });
    throw error;
  }
}
