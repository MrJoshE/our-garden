import { db } from '../lib/db/schema.js';
import { getErrorLog } from '../lib/log.js';
import { createFirstGarden, createPlant } from '../lib/db/index.js';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Empties every table. Waits for error log saves first so none land after. */
export async function resetDatabase() {
  await getErrorLog();
  await Promise.all(db.tables.map((table) => table.clear()));
}

/** A person, their garden and one plant, the way first run leaves things */
export async function startGarden() {
  const gardenId = await createFirstGarden({ personName: 'Sam', gardenName: 'Back garden' });
  const personId = (await db.meta.get('currentPersonId'))?.value;
  const plantId = await createPlant(gardenId, { commonName: 'Foxglove' });
  return { gardenId, personId, plantId };
}

/** A photo as images.js will hand it over */
export function makePhoto(overrides = {}) {
  return {
    blob: new Blob(['full'], { type: 'image/jpeg' }),
    thumb: new Blob(['thumb'], { type: 'image/jpeg' }),
    width: 1600,
    height: 1200,
    bytes: 4,
    sha256: 'abc123',
    takenAt: '2026-09-01T10:00:00.000Z',
    caption: null,
    ...overrides
  };
}

/** @param {string} recordId */
export function changesFor(recordId) {
  return db.changes.where('recordId').equals(recordId).toArray();
}
