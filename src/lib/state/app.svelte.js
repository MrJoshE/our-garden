// The only shared in-memory state (brief section 7): toasts, any problem
// the whole app has to show, the storage warning, and today's date.

import { today } from '../dates.js';
import { describeProblem, explainError } from '../errors.js';
import { logError } from '../log.js';

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
  storageLow: false
});

const STORAGE_WARNING_SHARE = 0.8;

/** Checks the space left, on start and after saving photos. */
export async function checkStorage() {
  try {
    const { usage = 0, quota = 0 } = (await navigator.storage?.estimate?.()) ?? {};
    app.storageLow = quota > 0 && usage / quota > STORAGE_WARNING_SHARE;
  } catch (error) {
    logError(error, { operation: 'checkStorage' });
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
