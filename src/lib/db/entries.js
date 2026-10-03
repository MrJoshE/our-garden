import { db, isCurrent } from './schema.js';
import { AutomaticEntryError, changedFields, write } from './write.js';
import { ValidationError, clean, date, longText, oneOf, ref, shortText, tags } from './fields.js';
import { addPhotoRecords, cleanPhotos } from './photos.js';
import { ENTRY_KINDS, KINDS_WITH_PRODUCT } from '../constants.js';
import { today } from '../dates.js';

const FIELDS = {
  occurredOn: date({ fallback: today, notFuture: true }),
  kind: oneOf(ENTRY_KINDS, 'observation'),
  note: longText,
  product: shortText,
  issueId: ref,
  doneBy: ref,
  tags
};

/**
 * A kind from a newer version of the app is not known here, so its product
 * is left alone rather than wiped.
 * @param {string} kind
 */
const takesNoProduct = (kind) => ENTRY_KINDS.has(kind) && !KINDS_WITH_PRODUCT.includes(kind);

/**
 * An entry needs a note, a photo, or a kind other than "Observation".
 * @param {Record<string, any>} entry
 * @param {number} photoCount
 */
function requireContent(entry, photoCount) {
  if (!entry.note && photoCount === 0 && entry.kind === 'observation') {
    throw new ValidationError('note', 'required');
  }
}

/**
 * @param {string | null} issueId
 * @param {string} plantId
 */
async function checkIssueLink(issueId, plantId) {
  if (!issueId) return;
  const issue = await db.issues.get(issueId);
  if (!isCurrent(issue) || issue.plantId !== plantId) throw new ValidationError('issueId', 'invalid');
}

/**
 * Saves an entry inside a write, filling in its links and defaults.
 * @param {import('./write.js').Writer} w
 * @param {Record<string, any>} plant
 * @param {Record<string, any>} fields
 */
export function addEntryRecord(w, plant, fields) {
  return w.create('entries', {
    gardenId: plant.gardenId,
    plantId: plant.id,
    areaId: plant.areaId ?? null,
    issueId: null,
    visitId: null,
    taskId: null,
    occurredOn: today(),
    kind: 'observation',
    note: null,
    product: null,
    tags: [],
    auto: false,
    ...fields,
    doneBy: fields.doneBy ?? w.by,
    editedAt: null
  });
}

/**
 * A plant's entries, newest first, with their photos. Ask for more by
 * raising the limit ("Show earlier").
 * @param {string} plantId
 * @param {number} [limit]
 * @returns {Promise<{ entries: Record<string, any>[], hasMore: boolean }>}
 */
export async function listEntries(plantId, limit = 30) {
  const all = await db.entries.where('plantId').equals(plantId).filter(isCurrent).toArray();
  all.sort(
    (a, b) =>
      b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
  );
  const page = all.slice(0, limit);
  const photos = await db.photos
    .where('entryId')
    .anyOf(page.map((entry) => entry.id))
    .filter(isCurrent)
    .toArray();
  photos.sort((a, b) => (a.takenAt ?? '').localeCompare(b.takenAt ?? '') || a.createdAt.localeCompare(b.createdAt));
  return {
    entries: page.map((entry) => ({ ...entry, photos: photos.filter((photo) => photo.entryId === entry.id) })),
    hasMore: all.length > limit
  };
}

/**
 * @param {string} plantId
 * @param {Record<string, any> & { photos?: unknown[] }} input
 * @returns {Promise<string>} the new entry's id
 */
export function createEntry(plantId, { photos = [], ...input }) {
  return write('createEntry', ['plants', 'entries', 'issues', 'photos'], async (w) => {
    const fields = clean(input, FIELDS);
    if (takesNoProduct(fields.kind)) fields.product = null;
    const cleanedPhotos = cleanPhotos(photos);
    requireContent(fields, cleanedPhotos.length);
    const plant = await w.get('plants', plantId);
    await checkIssueLink(fields.issueId, plantId);
    const entry = await addEntryRecord(w, plant, fields);
    await addPhotoRecords(w, plant, cleanedPhotos, { entryId: entry.id });
    return entry.id;
  });
}

/**
 * Edits an entry. It keeps createdAt and gains editedAt. Automatic entries
 * cannot be edited.
 * @param {string} id
 * @param {Record<string, any>} input
 */
export async function updateEntry(id, input) {
  await write('updateEntry', ['entries', 'issues', 'photos'], async (w) => {
    const fields = clean(input, FIELDS, { partial: true });
    const entry = await w.get('entries', id);
    if (entry.auto) throw new AutomaticEntryError(id);
    if (takesNoProduct(fields.kind ?? entry.kind)) fields.product = null;
    if (fields.issueId) await checkIssueLink(fields.issueId, entry.plantId);
    const photoCount = await db.photos.where('entryId').equals(id).filter(isCurrent).count();
    requireContent({ ...entry, ...fields }, photoCount);
    if (changedFields(entry, fields).length === 0) return;
    await w.update('entries', id, { ...fields, editedAt: w.at });
  });
}

/**
 * Deletes an entry and its photos.
 * @param {string} id
 * @returns {Promise<string>} the deletedAt to pass to restoreEntry
 */
export function deleteEntry(id) {
  return write('deleteEntry', ['entries', 'photos'], async (w) => {
    const entry = await w.get('entries', id);
    if (entry.auto) throw new AutomaticEntryError(id);
    await w.remove('entries', id);
    await w.removeWhere('photos', 'entryId', id);
    return w.at;
  });
}

/**
 * Undoes deleteEntry.
 * @param {string} id
 * @param {string} deletedAt
 */
export async function restoreEntry(id, deletedAt) {
  await write('restoreEntry', ['entries', 'photos'], async (w) => {
    await w.restoreWhere('entries', 'id', id, deletedAt);
    await w.restoreWhere('photos', 'entryId', id, deletedAt);
  });
}

/**
 * "Checked today". Does nothing if this person has already checked this
 * plant today.
 * @param {string} plantId
 * @returns {Promise<string | null>} the new entry's id, or null if already checked
 */
export function checkToday(plantId) {
  return write('checkToday', ['plants', 'entries'], async (w) => {
    const plant = await w.get('plants', plantId);
    const day = today();
    const already = await db.entries
      .where('[plantId+occurredOn]')
      .equals([plantId, day])
      .filter((entry) => isCurrent(entry) && entry.kind === 'checked' && entry.doneBy === w.by)
      .count();
    if (already > 0) return null;
    const entry = await addEntryRecord(w, plant, { kind: 'checked', occurredOn: day });
    return entry.id;
  });
}
