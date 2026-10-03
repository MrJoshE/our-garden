// The error log. Every error is recorded here with as much detail as can be
// gathered, kept on the device (the last 50, shown in settings) and passed
// to any sinks, which is where an analytics service can plug in later.
//
// Never pass journal content (notes, names, titles, search text, photos) in
// the context. Ids, table names and field names only.

import Dexie from 'dexie';
import { db } from './db/schema.js';
import { uuid } from './ids.js';

const KEEP = 50;

/** @typedef {{ name: string, message: string, stack: string | null }} ErrorSummary */

/**
 * @typedef {ErrorSummary & {
 *   id: string,
 *   at: string,
 *   details: Record<string, string | number | boolean | null>,
 *   causes: ErrorSummary[],
 *   context: Record<string, unknown>,
 *   page: string | null,
 *   userAgent: string | null,
 *   online: boolean | null
 * }} ErrorRecord
 */

/** @type {Set<(record: ErrorRecord) => void>} */
const sinks = new Set();

/** Errors already logged, so one passed up through several handlers is recorded once */
/** @type {WeakMap<object, ErrorRecord>} */
const logged = new WeakMap();

/** Saves run one after another so two errors at once cannot overwrite each other */
let saving = Promise.resolve();

/**
 * Sends every future error record somewhere else as well.
 * @param {(record: ErrorRecord) => void} sink
 * @returns {() => void} removes the sink
 */
export function addErrorSink(sink) {
  sinks.add(sink);
  return () => sinks.delete(sink);
}

/**
 * Records an error. Never throws.
 * @param {unknown} error
 * @param {Record<string, unknown>} [context] the operation, ids, table and field names
 * @returns {ErrorRecord}
 */
export function logError(error, context = {}) {
  const isObject = error !== null && typeof error === 'object';
  const previous = isObject ? logged.get(error) : undefined;
  if (previous) return previous;

  /** @type {ErrorRecord} */
  const record = {
    id: uuid(),
    at: new Date().toISOString(),
    ...summarise(error),
    details: detailsOf(error),
    causes: causesOf(error).map(summarise),
    context: plain(context),
    // The hash without its query, which can hold search text
    page: globalThis.location ? globalThis.location.hash.split('?')[0] || '#/' : null,
    userAgent: globalThis.navigator?.userAgent ?? null,
    online: globalThis.navigator?.onLine ?? null
  };
  if (isObject) logged.set(error, record);

  console.error(`[Garden Journal] ${record.context.operation ?? 'error'}: ${record.name}: ${record.message}`, record);
  for (const sink of sinks) {
    try {
      sink(record);
    } catch (sinkError) {
      console.error('[Garden Journal] An error sink failed', sinkError);
    }
  }
  saving = saving.then(() => save(record));
  return record;
}

/**
 * The saved error records, oldest first.
 * @returns {Promise<ErrorRecord[]>}
 */
export async function getErrorLog() {
  await saving;
  return (await db.meta.get('errors'))?.value ?? [];
}

/** @param {ErrorRecord} record */
async function save(record) {
  try {
    // Outside any transaction the caller is in, which may not include meta
    await Dexie.ignoreTransaction(() =>
      db.transaction('rw', db.meta, async () => {
        const records = (await db.meta.get('errors'))?.value ?? [];
        await db.meta.put({ key: 'errors', value: [...records, record].slice(-KEEP) });
      })
    );
  } catch (saveError) {
    // Out of space or no database: the console record above is all there is.
    console.error('[Garden Journal] Could not save the error log', saveError);
  }
}

/**
 * @param {unknown} error
 * @returns {ErrorSummary}
 */
function summarise(error) {
  if (error instanceof Error || error instanceof DOMException) {
    return { name: error.name, message: error.message, stack: error.stack ?? null };
  }
  return { name: typeof error, message: String(error), stack: null };
}

/**
 * Simple values the error carries, such as a ValidationError's field and
 * reason or a MissingRecordError's table and id.
 * @param {unknown} error
 */
function detailsOf(error) {
  /** @type {Record<string, string | number | boolean | null>} */
  const details = {};
  if (error === null || typeof error !== 'object') return details;
  for (const [key, value] of Object.entries(error)) {
    if (key === 'name' || key === 'message' || key === 'stack' || key.startsWith('_')) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) details[key] = value;
  }
  const failures = /** @type {any} */ (error).failures;
  if (Array.isArray(failures)) details.failureCount = failures.length;
  return details;
}

/**
 * The errors wrapped inside this one, through `cause` and Dexie's `inner`.
 * @param {unknown} error
 * @returns {unknown[]}
 */
export function causesOf(error) {
  const causes = [];
  let next = /** @type {any} */ (error);
  while (causes.length < 5) {
    next = next?.inner ?? next?.cause;
    if (next == null) break;
    causes.push(next);
  }
  return causes;
}

/**
 * The context as plain data, safe to store and send.
 * @param {Record<string, unknown>} context
 */
function plain(context) {
  try {
    return JSON.parse(JSON.stringify(context));
  } catch {
    return { unserialisable: true };
  }
}
