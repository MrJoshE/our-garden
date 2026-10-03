// Where the user is lives in the URL hash; which sheet is open lives in the
// history entry, so the back button closes it. Plain <a href="#/…"> links
// are the way to move between pages: following one fires popstate like the
// back and forward buttons do, so every route change comes through one place.

import { tick } from 'svelte';

/**
 * @typedef {object} Route
 * @property {'start' | 'garden' | 'plant' | 'notFound'} name
 * @property {string | null} gardenId
 * @property {string | null} plantId
 * @property {'all' | 'attention'} filter the garden page's filter
 * @property {string} search the garden page's search text
 * @property {string | null} sheet the open sheet's name, if any
 */

/** @type {[RegExp, (ids: string[]) => Partial<Route>][]} */
const ROUTES = [
  [/^\/$/, () => ({ name: 'start' })],
  [/^\/g\/([^/]+)$/, ([gardenId]) => ({ name: 'garden', gardenId })],
  [/^\/g\/([^/]+)\/plant\/([^/]+)$/, ([gardenId, plantId]) => ({ name: 'plant', gardenId, plantId })]
];

export const paths = {
  start: '#/',
  /** @param {string} gardenId */
  garden: (gardenId) => `#/g/${encodeURIComponent(gardenId)}`,
  /**
   * @param {string} gardenId
   * @param {string} plantId
   */
  plant: (gardenId, plantId) => `#/g/${encodeURIComponent(gardenId)}/plant/${encodeURIComponent(plantId)}`
};

/**
 * @param {string} hash
 * @returns {Omit<Route, 'sheet'>}
 */
function parse(hash) {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  /** @type {Pick<Route, 'filter' | 'search'>} */
  const view = {
    filter: params.get('filter') === 'attention' ? 'attention' : 'all',
    search: params.get('q') ?? ''
  };
  for (const [pattern, make] of ROUTES) {
    const match = pattern.exec(path || '/');
    if (match) {
      return { name: 'start', gardenId: null, plantId: null, ...view, ...make(match.slice(1).map(decodeURIComponent)) };
    }
  }
  return { name: 'notFound', gardenId: null, plantId: null, ...view };
}

/** @type {Route} */
export const route = $state({ ...parse(location.hash), sheet: history.state?.sheet ?? null });

// Each history entry gets an increasing index, so popstate can tell back
// from forward.
let index = history.state?.index ?? 0;
if (history.state?.index == null) history.replaceState({ ...history.state, index }, '');

// Scroll positions per entry, kept in memory: writing them into history state
// on every scroll would hit Safari's limit on replaceState calls.
/** @type {Map<number, number>} */
const scrollPositions = new Map();
history.scrollRestoration = 'manual';
addEventListener('scroll', () => scrollPositions.set(index, scrollY), { passive: true });

/** @param {number} next */
function startEntry(next) {
  for (const key of scrollPositions.keys()) if (key >= next) scrollPositions.delete(key);
  index = next;
}

addEventListener('popstate', () => {
  if (history.state?.index == null) {
    // A link was followed: a new entry, going forward
    startEntry(index + 1);
    history.replaceState({ index }, '');
    show('forward');
  } else {
    const direction = history.state.index < index ? 'back' : 'forward';
    index = history.state.index;
    show(direction);
  }
});

/**
 * Brings the route in line with the current history entry, animating when
 * the page itself changes.
 * @param {'forward' | 'back'} direction
 * @param {boolean} [animate]
 */
function show(direction, animate = true) {
  const next = { ...parse(location.hash), sheet: history.state?.sheet ?? null };
  const pageChanged = next.name !== route.name || next.gardenId !== route.gardenId || next.plantId !== route.plantId;
  if (!pageChanged) {
    Object.assign(route, next);
    return;
  }
  const scroll = direction === 'back' ? (scrollPositions.get(index) ?? 0) : 0;
  changePage(() => Object.assign(route, next), direction, scroll, animate);
}

// Counts page changes, so scroll and focus waiting on one page change give up
// once another has started.
let pageChanges = 0;

/**
 * @param {() => void} apply
 * @param {'forward' | 'back'} direction
 * @param {number} scroll
 * @param {boolean} animate
 */
async function changePage(apply, direction, scroll, animate) {
  const change = ++pageChanges;
  document.documentElement.dataset.nav = direction;
  const update = async () => {
    apply();
    await tick();
  };
  if (animate && document.startViewTransition) await document.startViewTransition(update).updateCallbackDone;
  else await update();
  const current = () => change === pageChanges;
  whenReady(
    () => !current() || document.documentElement.scrollHeight - innerHeight >= scroll,
    () => current() && scrollTo(0, scroll)
  );
  const heading = () => document.querySelector('main h1');
  whenReady(
    () => !current() || heading() !== null,
    () => {
      const h1 = heading();
      if (current() && h1 instanceof HTMLElement) h1.focus({ preventScroll: true });
    }
  );
}

/**
 * Runs `then` once `isReady` holds, checking each frame for up to a second,
 * because a page draws its content when its data arrives.
 * @param {() => boolean} isReady
 * @param {() => void} then
 */
function whenReady(isReady, then, frames = 60) {
  if (isReady() || frames === 0) then();
  else requestAnimationFrame(() => whenReady(isReady, then, frames - 1));
}

/**
 * Goes to a page from code. Use plain links where there is something to tap.
 * @param {string} hash such as paths.garden(id)
 * @param {{ replace?: boolean }} [options] replace: leave no entry to come back to
 */
export function navigate(hash, { replace = false } = {}) {
  if (replace) {
    history.replaceState({ index }, '', hash);
  } else {
    startEntry(index + 1);
    history.pushState({ index }, '', hash);
  }
  show('forward', !replace);
}

/**
 * Changes the garden page's filter or search without adding history.
 * @param {{ filter?: Route['filter'], search?: string }} changes
 */
export function setView(changes) {
  const next = { filter: route.filter, search: route.search, ...changes };
  const params = new URLSearchParams();
  if (next.filter === 'attention') params.set('filter', 'attention');
  if (next.search) params.set('q', next.search);
  const path = location.hash.split('?')[0] || '#/';
  history.replaceState(history.state, '', params.size ? `${path}?${params}` : path);
  Object.assign(route, next);
}

/**
 * Opens a sheet as a new history entry, so back closes it.
 * @param {string} name
 */
export function openSheet(name) {
  startEntry(index + 1);
  history.pushState({ index, sheet: name }, '');
  route.sheet = name;
}

/** Closes the open sheet by going back, keeping history in step. */
export function closeSheet() {
  if (route.sheet) history.back();
}
