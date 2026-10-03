import { liveQuery } from 'dexie';
import { logError } from '../log.js';

// Bumped when the page comes back from the back/forward cache, where open
// subscriptions may have gone quiet.
let restored = $state(0);
addEventListener('pageshow', (event) => {
  if (event.persisted) restored++;
});

const SLOW_MS = 150;

/**
 * Saved data that stays current: the query runs again whenever what it read
 * changes, in this tab or another. Call while a component is being set up.
 *
 *   const plants = live(() => gardenId, listPlants);
 *
 * The input is read here, where Svelte can see it, and handed to the query.
 * (Dexie sometimes starts a query a moment later, where Svelte could not
 * tell that it depended on gardenId.)
 *
 * @template I, T
 * @param {() => I} input
 * @param {(input: I) => Promise<T>} query a read function from lib/db
 */
export function live(input, query) {
  let attempt = $state(0);
  const state = $state({
    /** @type {T | undefined} */
    value: undefined,
    loading: true,
    /** True once loading has taken long enough to show a skeleton */
    slow: false,
    /** @type {unknown} */
    error: null,
    retry() {
      attempt++;
    }
  });

  /** @type {I | undefined} */
  let previous;

  $effect(() => {
    restored;
    attempt;
    const args = input();
    // Another garden or plant: don't show the old one while the new one loads
    if (!Object.is(args, previous)) state.value = undefined;
    previous = args;
    state.loading = true;
    state.error = null;
    const slowTimer = setTimeout(() => (state.slow = state.loading), SLOW_MS);
    const subscription = liveQuery(() => query(args)).subscribe({
      next: (value) => {
        state.value = value;
        state.loading = false;
        state.slow = false;
      },
      error: (error) => {
        logError(error, { operation: query.name || 'live query' });
        state.error = error;
        state.loading = false;
        state.slow = false;
      }
    });
    return () => {
      clearTimeout(slowTimer);
      subscription.unsubscribe();
    };
  });

  return state;
}
