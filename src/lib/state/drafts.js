import { clearDraft, saveDraft } from '../db/index.js';
import { logError } from '../log.js';

const SAVE_EVERY_MS = 500;

/** The save of every draft whose changes are waiting on its timer */
const waiting = new Set();

/** Saves every draft that has changes waiting, such as before the app reloads to update. */
export function saveWaitingDrafts() {
  return Promise.all([...waiting].map((save) => save()));
}

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

  function save() {
    clearTimeout(timer);
    timer = undefined;
    waiting.delete(save);
    return saveDraft(key, read()).catch((error) => logError(error, { operation: 'saveDraft' }));
  }
  function saveIfHidden() {
    if (document.visibilityState === 'hidden' && timer) save();
  }
  document.addEventListener('visibilitychange', saveIfHidden);

  return {
    /** Call when a value changes. */
    changed() {
      if (timer) return;
      timer = setTimeout(save, SAVE_EVERY_MS);
      waiting.add(save);
    },
    /** Saves anything pending and stops watching, keeping the draft for next time. */
    stop() {
      document.removeEventListener('visibilitychange', saveIfHidden);
      if (timer) save();
    },
    /**
     * Removes the draft, once the form is saved or she cancels it. Changes
     * made afterwards start a new draft, as in a form that stays open.
     */
    async discard() {
      clearTimeout(timer);
      timer = undefined;
      waiting.delete(save);
      await clearDraft(key);
    }
  };
}
