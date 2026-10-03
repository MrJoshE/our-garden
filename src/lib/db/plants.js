import Dexie from 'dexie';
import { db, current, isCurrent } from './schema.js';
import { write } from './write.js';
import { clean, date, longText, number, oneOf, ref, required, shortText, tags } from './fields.js';
import { isActiveIssue } from './issues.js';
import { INACTIVE_PLANT_STATUSES, PLANT_STATUSES } from '../constants.js';
import { compareText } from '../strings.js';

const FIELDS = {
  areaId: ref,
  location: shortText,
  commonName: required(shortText),
  botanicalName: shortText,
  variety: shortText,
  quantity: number({ min: 1, integer: true }),
  plantedOn: date({ notFuture: true }),
  source: shortText,
  status: oneOf(PLANT_STATUSES, 'growing'),
  careNotes: longText,
  tags,
  x: number(),
  y: number()
};

const PLANT_CHILDREN = ['entries', 'issues', 'photos'];

/** @param {Record<string, any>} plant */
const isInactive = (plant) => Number(INACTIVE_PLANT_STATUSES.includes(plant.status));

/** @param {Record<string, any>} photo */
const takenOrAdded = (photo) => photo.takenAt ?? photo.createdAt;

/**
 * Each plant's cover, by plant id: its chosen photo, or if that has been
 * deleted, the most recently taken photo it has left.
 * @param {Record<string, any>[]} plants
 * @returns {Promise<Map<string, Record<string, any>>>}
 */
async function coversFor(plants) {
  const chosen = await db.photos.bulkGet(plants.map((plant) => plant.coverPhotoId).filter(Boolean));
  const covers = new Map(chosen.filter(isCurrent).map((photo) => [photo.plantId, photo]));
  const uncovered = plants.filter((plant) => !covers.has(plant.id)).map((plant) => plant.id);
  const remaining = await db.photos.where('plantId').anyOf(uncovered).filter(isCurrent).toArray();
  for (const photo of remaining) {
    const best = covers.get(photo.plantId);
    if (!best || takenOrAdded(photo) > takenOrAdded(best)) covers.set(photo.plantId, photo);
  }
  return covers;
}

/**
 * The plants in a garden for the grid: removed and dead last, otherwise by
 * name. Each has `needsAttention` and its `cover` photo (or null).
 * @param {string} gardenId
 */
export async function listPlants(gardenId) {
  const [plants, issues] = await Promise.all([
    db.plants.where('gardenId').equals(gardenId).filter(isCurrent).toArray(),
    db.issues.where('gardenId').equals(gardenId).filter(isActiveIssue).toArray()
  ]);
  const flagged = new Set(issues.map((issue) => issue.plantId));
  const covers = await coversFor(plants);
  return plants
    .map((plant) => ({ ...plant, needsAttention: flagged.has(plant.id), cover: covers.get(plant.id) ?? null }))
    .sort((a, b) => isInactive(a) - isInactive(b) || compareText(a.commonName ?? '', b.commonName ?? ''));
}

/**
 * One plant with `needsAttention`, `lastCheckedOn` (the date of its most
 * recent entry of any kind) and its `cover` photo (or null). Undefined if it
 * is missing or deleted.
 * @param {string} id
 */
export async function getPlant(id) {
  const plant = current(await db.plants.get(id));
  if (!plant) return undefined;
  const [activeIssues, lastEntry, covers] = await Promise.all([
    db.issues.where('plantId').equals(id).filter(isActiveIssue).count(),
    db.entries
      .where('[plantId+occurredOn]')
      .between([id, Dexie.minKey], [id, Dexie.maxKey])
      .reverse()
      .filter(isCurrent)
      .first(),
    coversFor([plant])
  ]);
  return {
    ...plant,
    needsAttention: activeIssues > 0,
    lastCheckedOn: lastEntry?.occurredOn ?? null,
    cover: covers.get(id) ?? null
  };
}

/**
 * @param {string} gardenId
 * @param {Record<string, any>} input
 * @returns {Promise<string>} the new plant's id
 */
export function createPlant(gardenId, input) {
  return write('createPlant', ['gardens', 'plants'], async (w) => {
    const fields = clean(input, FIELDS);
    await w.get('gardens', gardenId);
    const plant = await w.create('plants', { gardenId, ...fields, coverPhotoId: null });
    return plant.id;
  });
}

/**
 * @param {string} id
 * @param {Record<string, any>} input
 */
export async function updatePlant(id, input) {
  await write('updatePlant', ['plants'], (w) => w.update('plants', id, clean(input, FIELDS, { partial: true })));
}

/**
 * Deletes a plant with its entries, issues and photos, in one go.
 * @param {string} id
 * @returns {Promise<string>} the deletedAt to pass to restorePlant
 */
export function deletePlant(id) {
  return write('deletePlant', ['plants', ...PLANT_CHILDREN], async (w) => {
    await w.remove('plants', id);
    for (const table of PLANT_CHILDREN) await w.removeWhere(table, 'plantId', id);
    return w.at;
  });
}

/**
 * Undoes deletePlant. Brings back exactly the records that delete changed;
 * anything deleted before it stays deleted.
 * @param {string} id
 * @param {string} deletedAt
 */
export async function restorePlant(id, deletedAt) {
  await write('restorePlant', ['plants', ...PLANT_CHILDREN], async (w) => {
    await w.restoreWhere('plants', 'id', id, deletedAt);
    for (const table of PLANT_CHILDREN) await w.restoreWhere(table, 'plantId', id, deletedAt);
  });
}
