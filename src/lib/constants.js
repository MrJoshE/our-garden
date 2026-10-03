import { strings } from './strings.js';

/**
 * A fixed list of short lowercase values. A value the app does not know
 * (from a newer backup, for example) is labelled "Other" rather than
 * breaking the page.
 * @param {readonly string[]} values
 * @param {Record<string, string>} labels
 */
function fixedList(values, labels) {
  /** @param {any} value */
  const has = (value) => values.includes(value);
  return Object.freeze({ values, has, label: (/** @type {any} */ value) => (has(value) ? labels[value] : strings.other) });
}

export const GARDEN_STATUSES = fixedList(['active', 'archived'], strings.gardenStatus);
export const SUN = fixedList(['full', 'part', 'shade'], strings.sun);
export const PLANT_STATUSES = fixedList(['growing', 'dormant', 'removed', 'dead'], strings.plantStatus);
export const ISSUE_KINDS = fixedList(['pest', 'disease', 'deficiency', 'damage', 'weather', 'other'], strings.issueKind);
export const SEVERITIES = fixedList(['low', 'medium', 'high'], strings.severity);
export const ISSUE_STATUSES = fixedList(['open', 'watching', 'resolved'], strings.issueStatus);
export const ENTRY_KINDS = fixedList(
  ['observation', 'checked', 'watered', 'fed', 'pruned', 'treated', 'planted', 'moved', 'harvested', 'other'],
  strings.entryKind
);

/** Issue statuses that mean a plant needs attention */
export const ACTIVE_ISSUE_STATUSES = ['open', 'watching'];
/** Plant statuses shown last and muted */
export const INACTIVE_PLANT_STATUSES = ['removed', 'dead'];
export const KINDS_WITH_PRODUCT = ['fed', 'treated'];

export const LIMITS = Object.freeze({ name: 120, note: 5000, photosPerEntry: 10 });

/** Days after a photo is deleted before its image data is removed */
export const PHOTO_PURGE_DAYS = 30;

export const COVER_TINTS = /** @type {const} */ (['rose', 'sage', 'rain', 'lavender', 'primrose']);

/**
 * The tint behind a plant's sprig when it has no photo. Taken from its id,
 * so a plant keeps the same colour every time.
 * @param {string} id
 */
export function tintFor(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVER_TINTS[hash % COVER_TINTS.length];
}
