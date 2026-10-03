import { db, current, isCurrent } from './schema.js';
import { write } from './write.js';
import { clean, required, shortText } from './fields.js';
import { getMeta } from './meta.js';

const PERSON_FIELDS = {
  name: required(shortText),
  role: shortText
};

export function listPeople() {
  return db.people.filter(isCurrent).toArray();
}

/** The person using this device */
export async function getCurrentPerson() {
  const id = await getMeta('currentPersonId');
  return id ? current(await db.people.get(id)) : undefined;
}

/**
 * @param {string} id
 * @param {{ name?: string, role?: string | null }} input
 */
export async function updatePerson(id, input) {
  await write('updatePerson', ['people'], (w) => w.update('people', id, clean(input, PERSON_FIELDS, { partial: true })));
}
