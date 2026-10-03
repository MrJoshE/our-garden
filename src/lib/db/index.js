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
export { listIssues, createIssue, updateIssue, setIssueStatus, deleteIssue, restoreIssue } from './issues.js';
export { setCoverPhoto } from './photos.js';
export { listPeople, getCurrentPerson, updatePerson } from './people.js';
export * from './areas.js';
export * from './tasks.js';
export * from './visits.js';

/**
 * Opens the database and frees space from old deleted photos. Call once on start.
 * @param {{ onClosedByUpgrade?: () => void, onUpgradeBlocked?: () => void }} [handlers]
 *   onClosedByUpgrade: another tab is upgrading the database, so this tab has
 *   closed it. onUpgradeBlocked: this tab's upgrade is waiting for other tabs
 *   to close; opening carries on by itself once they do.
 */
export async function startDatabase({ onClosedByUpgrade, onUpgradeBlocked } = {}) {
  // Dexie runs the newest listener first; returning false skips its default,
  // which only repeats this in a console warning.
  db.on('versionchange', () => {
    db.close();
    onClosedByUpgrade?.();
    return false;
  });
  db.on('blocked', () => {
    onUpgradeBlocked?.();
    return false;
  });
  try {
    await db.open();
  } catch (error) {
    logError(error, { operation: 'openDatabase' });
    throw error;
  }
  purgeDeletedPhotoBlobs().catch((error) => logError(error, { operation: 'purgeDeletedPhotoBlobs' }));
}
