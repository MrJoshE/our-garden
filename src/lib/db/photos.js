import { db, isCurrent } from './schema.js';
import { write } from './write.js';
import { ValidationError, clean, longText, number, shortText, timestamp } from './fields.js';
import { LIMITS, PHOTO_PURGE_DAYS } from '../constants.js';

/** @type {import('./fields.js').Rule} */
function blob(value, field) {
  if (!(value instanceof Blob)) throw new ValidationError(field, 'invalid');
  return value;
}

const PHOTO_FIELDS = {
  blob,
  thumb: blob,
  width: number({ min: 1, integer: true }),
  height: number({ min: 1, integer: true }),
  bytes: number({ min: 0, integer: true }),
  sha256: shortText,
  takenAt: timestamp,
  caption: longText
};

/**
 * @param {unknown} photos
 * @returns {Record<string, any>[]}
 */
export function cleanPhotos(photos) {
  if (!Array.isArray(photos)) throw new ValidationError('photos', 'invalid');
  if (photos.length > LIMITS.photosPerEntry) throw new ValidationError('photos', 'tooMany', LIMITS.photosPerEntry);
  return photos.map((photo) => clean(photo ?? {}, PHOTO_FIELDS));
}

/**
 * Saves photos for a plant inside a write. If the plant has no cover, or its
 * cover was deleted, the first of these becomes the cover.
 * @param {import('./write.js').Writer} w
 * @param {Record<string, any>} plant
 * @param {Record<string, any>[]} photos already cleaned
 * @param {{ entryId: string, issueId?: string | null }} links
 */
export async function addPhotoRecords(w, plant, photos, { entryId, issueId = null }) {
  if (photos.length === 0) return;
  /** @type {string[]} */
  const ids = [];
  for (const photo of photos) {
    const record = await w.create('photos', { gardenId: plant.gardenId, plantId: plant.id, entryId, issueId, ...photo });
    ids.push(record.id);
  }
  const cover = plant.coverPhotoId ? await db.photos.get(plant.coverPhotoId) : undefined;
  if (!isCurrent(cover)) await w.update('plants', plant.id, { coverPhotoId: ids[0] });
}

/**
 * "Use as cover" in the lightbox.
 * @param {string} plantId
 * @param {string} photoId
 */
export async function setCoverPhoto(plantId, photoId) {
  await write('setCoverPhoto', ['plants', 'photos'], async (w) => {
    const photo = await w.get('photos', photoId);
    if (photo.plantId !== plantId) throw new ValidationError('photoId', 'invalid');
    await w.update('plants', plantId, { coverPhotoId: photoId });
  });
}

/**
 * Frees the space used by photos deleted more than 30 days ago. The rows
 * stay, so the journal still knows a photo was there.
 *
 * This is housekeeping, not a change anyone made, so it bypasses write():
 * it leaves updatedAt alone and adds nothing to the change log.
 * @param {Date} [now]
 * @returns {Promise<number>} how many photos were purged
 */
export function purgeDeletedPhotoBlobs(now = new Date()) {
  const cutoff = new Date(now.getTime() - PHOTO_PURGE_DAYS * 86_400_000).toISOString();
  return db.photos
    .where('deletedAt')
    .below(cutoff)
    .filter((photo) => photo.blob != null || photo.thumb != null)
    .modify({ blob: null, thumb: null });
}
