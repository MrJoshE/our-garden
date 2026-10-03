// What every form does when a submit is refused: show the message under the
// field and move focus there, or explain a problem with the whole form.

import { tick } from 'svelte';
import { explainError } from './errors.js';

/** Moves focus to the first field marked invalid in the open sheet. */
export async function focusFirstProblem() {
  await tick();
  /** @type {HTMLElement | null} */ (document.querySelector('dialog[open] [aria-invalid="true"]'))?.focus();
}

/**
 * Splits a failed save into a message for one of the form's fields, or a
 * problem for the form as a whole.
 * @param {unknown} error
 * @param {string[]} fields the form's field names
 * @returns {{ field: string, message: string, problem: null } | { field: null, message: '', problem: import('./errors.js').Explanation }}
 */
export function saveFailure(error, fields) {
  const explanation = explainError(error);
  if (explanation.field && fields.includes(explanation.field)) {
    return { field: explanation.field, message: explanation.fieldMessage ?? '', problem: null };
  }
  return { field: null, message: '', problem: explanation };
}
