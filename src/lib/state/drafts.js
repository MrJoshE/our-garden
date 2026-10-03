import { clearDraft, saveDraft } from '../db/index.js';
import { logError } from '../log.js';

const SAVE_EVERY_MS = 500;

/**
 * Keeps a form's contents as a draft while it is open (brief section 7): at
 * most every half second while she types, and straight away when the page
 * is hidden, since a phone can discard a hidden page.
 * @param {string} key
 * @param {() => Record<string, any>} read the form's current values
 */
export function keepDraft(key, read) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  let discarded = false;

  function save() {
    clearTimeout(timer);
    timer = undefined;
    saveDraft(key, read()).catch((error) => logError(error, { operation: 'saveDraft' }));
  }
  function saveIfHidden() {
    if (document.visibilityState === 'hidden' && timer) save();
  }
  document.addEventListener('visibilitychange', saveIfHidden);

  return {
    /** Call when a value changes. */
    changed() {
      if (!discarded && !timer) timer = setTimeout(save, SAVE_EVERY_MS);
    },
    /** Saves anything pending and stops watching, keeping the draft for next time. */
    stop() {
      document.removeEventListener('visibilitychange', saveIfHidden);
      if (timer && !discarded) save();
    },
    /** Removes the draft, once the form is saved or she cancels it. */
    async discard() {
      discarded = true;
      clearTimeout(timer);
      timer = undefined;
      await clearDraft(key);
    }
  };
}
