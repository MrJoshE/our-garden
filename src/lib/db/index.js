// The database module's public functions. Pages and components import from
// here and never use Dexie directly.

import { db } from './schema.js';
import { purgeDeletedPhotoBlobs } from './photos.js';
import { logError } from '../log.js';

export { ValidationError } from './fields.js';
export { MissingRecordError, AutomaticEntryError } from './write.js';
export { getMeta } from './meta.js';
export { listGardens, getGarden, createGarden, updateGarden, deleteGarden, createFirstGarden } from './gardens.js';
export { listPlants, getPlant, createPlant, updatePlant, deletePlant, restorePlant } from './plants.js';
export { listEntries, createEntry, updateEntry, deleteEntry, restoreEntry, checkToday } from './entries.js';
export { listIssues, createIssue, updateIssue, setIssueStatus } from './issues.js';
export { setCoverPhoto } from './photos.js';
export { listPeople, getCurrentPerson, updatePerson } from './people.js';
export * from './areas.js';
export * from './tasks.js';
export * from './visits.js';

/** Opens the database and frees space from old deleted photos. Call once on start. */
export async function startDatabase() {
  try {
    await db.open();
  } catch (error) {
    logError(error, { operation: 'openDatabase' });
    throw error;
  }
  purgeDeletedPhotoBlobs().catch((error) => logError(error, { operation: 'purgeDeletedPhotoBlobs' }));
}
