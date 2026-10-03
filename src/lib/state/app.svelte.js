// The only shared in-memory state (brief section 7): toasts, and any problem
// the whole app has to show.

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
  problem: null
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
