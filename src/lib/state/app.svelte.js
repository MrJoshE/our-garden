// The only shared in-memory state (brief section 7): toasts, any problem
// the whole app has to show, the storage warning, and today's date.

import { today } from '../dates.js';
import { describeProblem, explainError } from '../errors.js';
import { logError } from '../log.js';
import { setMeta, shouldRemindBackup } from '../db/index.js';

/**
 * @typedef {object} Toast
 * @property {number} id
 * @property {string} message
 * @property {'danger'} [tone]
 * @property {{ label: string, run: () => void }} [action] such as Undo
 */

export const app = $state({
  /** @type {Toast[]} */
  toasts: [],
  /**
   * A problem that stops the app, shown instead of any page
   * @type {import('../errors.js').Explanation | null}
   */
  blocking: null,
  /**
   * An unexpected error, shown as a banner over the page
   * @type {import('../errors.js').Explanation | null}
   */
  problem: null,
  /** Today's date, which moves on at midnight so words such as "Today" stay right */
  today: today(),
  /** The device's storage is more than 80% full (brief section 11) */
  storageLow: false,
  /** Time for the once-only backup reminder (brief section 16) */
  backupReminder: false,
  /** A new version of the app is waiting for her to choose Update now (brief section 7) */
  updateReady: false
});

export const STORAGE_WARNING_SHARE = 0.8;

/**
 * How much of the device's space the journal uses, if the browser says.
 * @returns {Promise<{ usage: number, quota: number } | null>}
 */
export async function storageEstimate() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return estimate?.quota ? { usage: estimate.usage ?? 0, quota: estimate.quota } : null;
  } catch (error) {
    logError(error, { operation: 'storageEstimate' });
    return null;
  }
}

/** Checks the space left, on start and after saving photos. */
export async function checkStorage() {
  const estimate = await storageEstimate();
  app.storageLow = !!estimate && estimate.usage / estimate.quota > STORAGE_WARNING_SHARE;
}

/** Shows the backup reminder if it's due. Call once on start. */
export async function checkBackupReminder() {
  try {
    if (!(await shouldRemindBackup())) return;
    app.backupReminder = true;
    await setMeta('backupReminderShownAt', new Date().toISOString());
  } catch (error) {
    logError(error, { operation: 'checkBackupReminder', tables: ['meta', 'people', 'entries'] });
  }
}

function followTheDate() {
  app.today = today();
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  setTimeout(followTheDate, nextMidnight.getTime() - now.getTime() + 1000);
}
followTheDate();
// Timers are held back while the app is in the background, so check on return
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') app.today = today();
});

let nextToastId = 1;

/**
 * @param {string} message
 * @param {{ tone?: 'danger', action?: Toast['action'] }} [options]
 */
export function showToast(message, { tone, action } = {}) {
  const toast = { id: nextToastId++, message, tone, action };
  // Only one undo toast at a time. A new one replaces it, and the earlier
  // delete stands.
  const others = action ? app.toasts.filter((t) => !t.action) : app.toasts;
  app.toasts = [...others, toast];
}

/** @param {number} id */
export function dismissToast(id) {
  app.toasts = app.toasts.filter((t) => t.id !== id);
}

/** @param {import('../errors.js').ProblemKind} kind */
export function block(kind) {
  app.blocking = describeProblem(kind);
}

/**
 * Records an error and tells the user what happened and what to do next.
 * @param {unknown} error
 * @param {Record<string, unknown>} context the operation, ids, table and field names
 */
export function reportError(error, context) {
  logError(error, context);
  const explanation = explainError(error);
  if (explanation.kind === 'closed' || explanation.kind === 'unavailable') app.blocking = explanation;
  else app.problem = explanation;
}
