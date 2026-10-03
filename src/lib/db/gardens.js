import { db, current, isCurrent } from './schema.js';
import { write } from './write.js';
import { clean, longText, number, oneOf, required, shortText } from './fields.js';
import { GARDEN_STATUSES } from '../constants.js';
import { compareText } from '../strings.js';

const FIELDS = {
  name: required(shortText),
  ownerName: shortText,
  contact: shortText,
  address: longText,
  notes: longText,
  soil: shortText,
  aspect: shortText,
  status: oneOf(GARDEN_STATUSES, 'active'),
  latitude: number({ min: -90, max: 90 }),
  longitude: number({ min: -180, max: 180 })
};

const GARDEN_TABLES = ['areas', 'plants', 'issues', 'entries', 'photos', 'tasks', 'visits'];

/** Gardens by name, with archived ones last */
export async function listGardens() {
  const gardens = await db.gardens.filter(isCurrent).toArray();
  const isArchived = (/** @type {any} */ g) => Number(g.status === 'archived');
  return gardens.sort((a, b) => isArchived(a) - isArchived(b) || compareText(a.name ?? '', b.name ?? ''));
}

/** @param {string} id */
export async function getGarden(id) {
  return current(await db.gardens.get(id));
}

/**
 * Remembers the garden being looked at, so the app reopens it next time.
 * @param {string} id
 */
export async function setLastGarden(id) {
  await db.meta.put({ key: 'lastGardenId', value: id });
}

/**
 * The garden to open on start: the last one used if it still exists, then
 * the first active garden, or null before first run.
 * @returns {Promise<string | null>}
 */
export async function findStartGardenId() {
  const lastId = (await db.meta.get('lastGardenId'))?.value;
  if (lastId && current(await db.gardens.get(lastId))) return lastId;
  return (await listGardens())[0]?.id ?? null;
}

/**
 * @param {Record<string, any>} input
 * @returns {Promise<string>} the new garden's id
 */
export function createGarden(input) {
  return write('createGarden', ['gardens'], async (w) => (await w.create('gardens', clean(input, FIELDS))).id);
}

/**
 * @param {string} id
 * @param {Record<string, any>} input
 */
export async function updateGarden(id, input) {
  await write('updateGarden', ['gardens'], (w) => w.update('gardens', id, clean(input, FIELDS, { partial: true })));
}

/**
 * Deletes a garden and everything in it. The page asks the user to type the
 * garden's name first; there is no undo.
 * @param {string} id
 */
export async function deleteGarden(id) {
  await write('deleteGarden', ['gardens', ...GARDEN_TABLES], async (w) => {
    await w.remove('gardens', id);
    for (const table of GARDEN_TABLES) await w.removeWhere(table, 'gardenId', id);
    if ((await db.meta.get('lastGardenId'))?.value === id) await db.meta.delete('lastGardenId');
  });
}

/**
 * First run: creates the person using this device and their first garden,
 * together, and makes them current.
 * @param {{ personName: string, gardenName: string }} input
 * @returns {Promise<string>} the new garden's id
 */
export function createFirstGarden({ personName, gardenName }) {
  return write('createFirstGarden', ['people', 'gardens'], async (w) => {
    const person = { name: required(shortText)(personName, 'personName'), role: null };
    const garden = clean({ name: required(shortText)(gardenName, 'gardenName') }, FIELDS);
    const { id: personId } = await w.create('people', person);
    await db.meta.put({ key: 'currentPersonId', value: personId });
    w.by = personId;
    const { id } = await w.create('gardens', garden);
    await db.meta.put({ key: 'lastGardenId', value: id });
    return id;
  });
}
