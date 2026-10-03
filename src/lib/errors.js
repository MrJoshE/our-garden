// Turns any error into what the user is told: what went wrong, in plain
// words, and what they can do about it. Never show error.message itself.

import { ValidationError } from './db/fields.js';
import { MissingRecordError, AutomaticEntryError } from './db/write.js';
import { BackupError } from './db/backup.js';
import { causesOf } from './log.js';
import { strings } from './strings.js';

/**
 * Buttons the page should offer. "backup" opens Backup and settings.
 * @typedef {'retry' | 'reload' | 'back' | 'backup'} Recovery
 */

/** What each kind of problem lets the user do about it */
const RECOVERY = /** @type {const} */ ({
  notFound: ['back'],
  readOnly: [],
  quota: ['backup', 'retry'],
  unavailable: [],
  closed: ['reload'],
  blocked: [],
  notBackup: [],
  newerBackup: ['reload'],
  unknown: ['retry', 'reload']
});

/** @typedef {keyof typeof RECOVERY} ProblemKind */
/** @typedef {ProblemKind | 'invalid'} Kind */

/**
 * @typedef {object} Explanation
 * @property {Kind} kind
 * @property {string} title
 * @property {string} message
 * @property {readonly Recovery[]} actions
 * @property {string} [field] for a ValidationError, the field to mark and focus
 * @property {string} [fieldMessage] for a ValidationError, the message to show under it
 */

/**
 * The words and recovery actions for a kind of problem, including ones that
 * are not errors, such as an upgrade waiting for other tabs to close.
 * @param {ProblemKind} kind
 * @returns {Explanation}
 */
export function describeProblem(kind) {
  return { kind, ...strings.errors[kind], actions: RECOVERY[kind] };
}

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
  if (error instanceof MissingRecordError) return describeProblem('notFound');
  if (error instanceof AutomaticEntryError) return describeProblem('readOnly');
  if (error instanceof BackupError) return describeProblem(error.reason);

  // Browser and Dexie errors are recognised by name, and are often wrapped
  // (a transaction abort caused by a full disk, for example).
  const names = [error, ...causesOf(error)].map((e) => /** @type {any} */ (e)?.name);
  const has = (/** @type {string} */ name) => names.includes(name);

  if (has('QuotaExceededError')) return describeProblem('quota');
  if (has('MissingAPIError') || has('SecurityError') || (has('OpenFailedError') && has('InvalidStateError'))) {
    return describeProblem('unavailable');
  }
  if (has('DatabaseClosedError') || has('VersionChangeError')) return describeProblem('closed');
  return describeProblem('unknown');
}

/** @typedef {{ label: string, run: () => void }} RecoveryButton */

/**
 * The buttons to offer with a problem: Try again where there is something to
 * retry, and Reload where reloading helps.
 * @param {Explanation} problem
 * @param {() => void} [onRetry]
 * @returns {RecoveryButton[]}
 */
export function recoveryButtons(problem, onRetry) {
  /** @type {RecoveryButton[]} */
  const buttons = [];
  if (onRetry && problem.actions.includes('retry')) buttons.push({ label: strings.actions.retry, run: onRetry });
  if (problem.actions.includes('reload')) buttons.push({ label: strings.actions.reload, run: () => location.reload() });
  return buttons;
}
