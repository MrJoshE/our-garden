// Settings for this device. They are not journal records, so they are written
// directly rather than through write().

import { db } from './schema.js';

/**
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getMeta(key) {
  return (await db.meta.get(key))?.value;
}
