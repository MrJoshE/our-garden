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

// Scroll positions and pages per entry, kept in memory: writing them into
// history state on every scroll would hit Safari's limit on replaceState
// calls. Entries from before a reload are not known, so back() treats them
// as somewhere else.
/** @type {Map<number, number>} */
const scrollPositions = new Map();
/** @type {Map<number, string>} */
const entryPages = new Map([[index, currentPage()]]);
history.scrollRestoration = 'manual';
addEventListener('scroll', () => scrollPositions.set(index, scrollY), { passive: true });

function currentPage() {
  return location.hash.split('?')[0] || '#/';
}

/** @param {number} next */
function startEntry(next) {
  for (const entries of [scrollPositions, entryPages]) {
    for (const key of entries.keys()) if (key >= next) entries.delete(key);
  }
  index = next;
}

addEventListener('popstate', () => {
  /** @type {'forward' | 'back'} */
  let direction = 'forward';
  if (history.state?.index == null) {
    // A link was followed: a new entry
    startEntry(index + 1);
    history.replaceState({ index }, '');
  } else {
    if (history.state.index < index) direction = 'back';
    index = history.state.index;
  }
  entryPages.set(index, currentPage());
  show(direction);
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
  // Between a garden and one of its plants, that plant's photo moves with the page
  const plantId = next.plantId ?? route.plantId;
  changePage(() => Object.assign(route, next), direction, scroll, animate, plantId);
}

// Counts page changes, so scroll and focus waiting on one page change give up
// once another has started.
let pageChanges = 0;

// Waiting for back() to reach its page
/** @type {(() => void)[]} */
const pageWaiters = [];

/** @param {number} scroll */
const canScrollTo = (scroll) => document.documentElement.scrollHeight - innerHeight >= scroll;

/**
 * @param {() => void} apply
 * @param {'forward' | 'back'} direction
 * @param {number} scroll
 * @param {boolean} animate
 * @param {string | null} plantId
 */
async function changePage(apply, direction, scroll, animate, plantId) {
  const change = ++pageChanges;
  document.documentElement.dataset.nav = direction;
  const transitions = animate && !!document.startViewTransition;

  // The card's cover and the plant page's cover share a name for the length
  // of the transition, so the photo grows into place (brief section 13)
  const cover = () => (plantId ? document.querySelector(`[data-cover="${CSS.escape(plantId)}"]`) : null);
  /** @type {HTMLElement[]} */
  const named = [];
  const nameCover = () => {
    const element = cover();
    if (!transitions || !(element instanceof HTMLElement)) return;
    element.style.viewTransitionName = 'plant-cover';
    named.push(element);
  };

  const update = async () => {
    apply();
    await tick();
    for (const resolve of pageWaiters.splice(0)) resolve();
    if (!animate) return;
    // A page draws when its data arrives, usually within a few milliseconds.
    // Waiting briefly for its heading lets the transition show the page, not
    // a blank one; the old page stays on screen meanwhile.
    await waitUntil(() => !!document.querySelector('main h1') && (!plantId || !!cover()), PAGE_WAIT_MS);
    if (canScrollTo(scroll)) scrollTo(0, scroll);
    nameCover();
  };
  if (transitions) {
    nameCover();
    const transition = document.startViewTransition(update);
    // A newer page change skips this transition, which rejects `ready`
    transition.ready.catch(() => {});
    transition.finished.finally(() => named.forEach((element) => (element.style.viewTransitionName = '')));
    await transition.updateCallbackDone;
  } else {
    await update();
  }
  const current = () => change === pageChanges;
  whenReady(
    () => !current() || canScrollTo(scroll),
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

const PAGE_WAIT_MS = 300;

/**
 * Resolves once `isReady` holds, or after `limit` milliseconds. Polls with
 * timers, because the browser pauses animation frames while a view
 * transition's update runs.
 * @param {() => boolean} isReady
 * @param {number} limit
 */
function waitUntil(isReady, limit) {
  const start = performance.now();
  return new Promise((resolve) => {
    const check = () => (isReady() || performance.now() - start > limit ? resolve(undefined) : setTimeout(check, 10));
    check();
  });
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
  entryPages.set(index, currentPage());
  show('forward', !replace);
}

/**
 * Goes up to a page, such as a plant's garden. When the entry before this
 * one is that page, it goes back to it, so its scroll position returns;
 * otherwise, such as after opening a link to the plant, this entry becomes
 * that page.
 * @param {string} hash such as paths.garden(id)
 * @returns {Promise<void>} resolves once that page is showing
 */
export function back(hash) {
  const shown = new Promise((resolve) => pageWaiters.push(() => resolve(undefined)));
  if (entryPages.get(index - 1) === hash) {
    history.back();
  } else {
    history.replaceState({ index }, '', hash);
    entryPages.set(index, hash);
    show('back');
  }
  return shown;
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
  Object.assign(route, next);
  try {
    history.replaceState(history.state, '', params.size ? `${path}?${params}` : path);
  } catch {
    // Safari limits how often the address can change, such as while typing
    // fast; the page already shows the change, and the next one catches up.
  }
}

/**
 * Opens a sheet as a new history entry, so back closes it.
 * @param {string} name
 */
export function openSheet(name) {
  startEntry(index + 1);
  history.pushState({ index, sheet: name }, '');
  entryPages.set(index, currentPage());
  route.sheet = name;
}

/** Closes the open sheet by going back, keeping history in step. */
export function closeSheet() {
  if (route.sheet) history.back();
}
