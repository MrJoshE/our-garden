import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './schema.js';
import { purgeDeletedPhotoBlobs } from './photos.js';
import {
  createEntry,
  createPlant,
  deleteEntry,
  getPlant,
  listPlants,
  restoreEntry,
  setCoverPhoto,
  startDatabase
} from './index.js';
import { changesFor, makePhoto, resetDatabase, startGarden } from '../../test/helpers.js';

beforeEach(resetDatabase);

const DAY = 86_400_000;

describe('cover photo', () => {
  it('"Use as cover" changes the cover to a photo of the same plant only', async () => {
    const { gardenId, plantId } = await startGarden();
    await createEntry(plantId, { photos: [makePhoto()] });
    const second = await createEntry(plantId, { photos: [makePhoto()] });
    const [photo] = await db.photos.where('entryId').equals(second).toArray();
    await setCoverPhoto(plantId, photo.id);
    expect((await getPlant(plantId))?.coverPhotoId).toBe(photo.id);

    const rose = await createPlant(gardenId, { commonName: 'Rose' });
    await expect(setCoverPhoto(rose, photo.id)).rejects.toMatchObject({ field: 'photoId' });
  });
});

describe('when the cover photo is deleted', () => {
  /** @param {string} entryId */
  const photoOf = async (entryId) => (await db.photos.where('entryId').equals(entryId).first()).id;

  it('shows the most recently taken remaining photo instead', async () => {
    const { gardenId, plantId } = await startGarden();
    const coverEntry = await createEntry(plantId, { photos: [makePhoto({ takenAt: '2026-06-01T10:00:00Z' })] });
    const newest = await createEntry(plantId, { photos: [makePhoto({ takenAt: '2026-08-01T10:00:00Z' })] });
    await createEntry(plantId, { photos: [makePhoto({ takenAt: '2026-07-01T10:00:00Z' })] });
    await deleteEntry(coverEntry);
    const expected = await photoOf(newest);
    expect((await getPlant(plantId))?.cover?.id).toBe(expected);
    expect((await listPlants(gardenId)).find((p) => p.id === plantId)?.cover?.id).toBe(expected);
  });

  it('uses when a photo was added if when it was taken is unknown', async () => {
    const { plantId } = await startGarden();
    const coverEntry = await createEntry(plantId, { photos: [makePhoto()] });
    await createEntry(plantId, { photos: [makePhoto({ takenAt: null })] });
    const latest = await createEntry(plantId, { photos: [makePhoto({ takenAt: null })] });
    await deleteEntry(coverEntry);
    expect((await getPlant(plantId))?.cover?.id).toBe(await photoOf(latest));
  });

  it('keeps the chosen cover, so undoing the delete brings it back', async () => {
    const { plantId } = await startGarden();
    const coverEntry = await createEntry(plantId, { photos: [makePhoto()] });
    const chosen = await photoOf(coverEntry);
    const deletedAt = await deleteEntry(coverEntry);
    await createEntry(plantId, { photos: [makePhoto()] });
    expect((await getPlant(plantId))?.cover?.id).not.toBe(chosen);
    await restoreEntry(coverEntry, deletedAt);
    expect((await getPlant(plantId))?.cover?.id).toBe(chosen);
  });

  it('shows no cover once no photos remain', async () => {
    const { plantId } = await startGarden();
    const only = await createEntry(plantId, { photos: [makePhoto()] });
    await deleteEntry(only);
    expect((await getPlant(plantId))?.cover).toBeNull();
  });
});

describe('purging deleted photos', () => {
  it('removes the image data of photos deleted more than 30 days ago and keeps the rows', async () => {
    const { plantId } = await startGarden();
    const kept = await createEntry(plantId, { photos: [makePhoto()] });
    const recent = await createEntry(plantId, { photos: [makePhoto()] });
    const old = await createEntry(plantId, { photos: [makePhoto()] });
    await deleteEntry(recent);
    await deleteEntry(old);
    const now = new Date();
    const [oldPhoto] = await db.photos.where('entryId').equals(old).toArray();
    await db.photos.update(oldPhoto.id, { deletedAt: new Date(now.getTime() - 31 * DAY).toISOString() });
    const [recentPhoto] = await db.photos.where('entryId').equals(recent).toArray();
    await db.photos.update(recentPhoto.id, { deletedAt: new Date(now.getTime() - 29 * DAY).toISOString() });
    const changesBefore = await db.changes.count();

    expect(await purgeDeletedPhotoBlobs(now)).toBe(1);

    const purged = await db.photos.get(oldPhoto.id);
    expect(purged).toMatchObject({ blob: null, thumb: null, updatedAt: oldPhoto.updatedAt, width: 1600 });
    expect((await db.photos.get(recentPhoto.id)).blob).toBeInstanceOf(Blob);
    expect((await db.photos.where('entryId').equals(kept).first()).blob).toBeInstanceOf(Blob);
    expect(await db.changes.count()).toBe(changesBefore);
    expect(await changesFor(oldPhoto.id)).toHaveLength(2);
    expect(await purgeDeletedPhotoBlobs(now)).toBe(0);
  });

  it('runs when the database starts', async () => {
    const { plantId } = await startGarden();
    const entryId = await createEntry(plantId, { photos: [makePhoto()] });
    await deleteEntry(entryId);
    const [photo] = await db.photos.where('entryId').equals(entryId).toArray();
    await db.photos.update(photo.id, { deletedAt: new Date(Date.now() - 31 * DAY).toISOString() });
    await startDatabase();
    await vi.waitFor(async () => expect((await db.photos.get(photo.id)).blob).toBeNull());
  });
});
