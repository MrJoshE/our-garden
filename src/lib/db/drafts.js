// What was typed into a form and not yet saved, so a phone discarding the
// page loses nothing. Drafts belong to this device, not the journal, so they
// are written directly rather than through write() and are left out of
// backups.

import { db } from './schema.js';

/**
 * @param {string} key such as `plant:<gardenId>`
 * @returns {Promise<Record<string, any> | undefined>}
 */
export async function getDraft(key) {
  return (await db.drafts.get(key))?.data;
}

/**
 * @param {string} key
 * @param {Record<string, any>} data
 */
export async function saveDraft(key, data) {
  await db.drafts.put({ key, data, updatedAt: new Date().toISOString() });
}

/** @param {string} key */
export async function clearDraft(key) {
  await db.drafts.delete(key);
}
