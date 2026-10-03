// Turns any error into what the user is told: what went wrong, in plain
// words, and what they can do about it. Never show error.message itself.

import { ValidationError } from './db/fields.js';
import { MissingRecordError, AutomaticEntryError } from './db/write.js';
import { causesOf } from './log.js';
import { strings } from './strings.js';

/**
 * Buttons the page should offer. "backup" opens Backup and settings.
 * @typedef {'retry' | 'reload' | 'back' | 'backup'} Recovery
 */

/** @typedef {'invalid' | 'notFound' | 'readOnly' | 'quota' | 'unavailable' | 'closed' | 'unknown'} Kind */

/**
 * @typedef {object} Explanation
 * @property {Kind} kind
 * @property {string} title
 * @property {string} message
 * @property {Recovery[]} actions
 * @property {string} [field] for a ValidationError, the field to mark and focus
 * @property {string} [fieldMessage] for a ValidationError, the message to show under it
 */

/**
 * @param {unknown} error
 * @returns {Explanation}
 */
export function explainError(error) {
  if (error instanceof ValidationError) {
    const field = strings.errors.field;
    const fieldMessage =
      error.reason === 'tooLong' || error.reason === 'tooMany'
        ? field[error.reason](error.limit ?? 0)
        : field[error.reason];
    return { kind: 'invalid', ...strings.errors.invalid, actions: [], field: error.field, fieldMessage };
  }
  if (error instanceof MissingRecordError) return explanation('notFound', ['back']);
  if (error instanceof AutomaticEntryError) return explanation('readOnly', []);

  // Browser and Dexie errors are recognised by name, and are often wrapped
  // (a transaction abort caused by a full disk, for example).
  const names = [error, ...causesOf(error)].map((e) => /** @type {any} */ (e)?.name);
  const has = (/** @type {string} */ name) => names.includes(name);

  if (has('QuotaExceededError')) return explanation('quota', ['backup', 'retry']);
  if (has('MissingAPIError') || has('SecurityError') || (has('OpenFailedError') && has('InvalidStateError'))) {
    return explanation('unavailable', []);
  }
  if (has('DatabaseClosedError') || has('VersionChangeError')) return explanation('closed', ['reload']);
  return explanation('unknown', ['retry', 'reload']);
}

/**
 * @param {Exclude<Kind, 'invalid'>} kind
 * @param {Recovery[]} actions
 * @returns {Explanation}
 */
function explanation(kind, actions) {
  return { kind, ...strings.errors[kind], actions };
}
