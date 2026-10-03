import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema.js';
import { AutomaticEntryError } from './write.js';
import { ValidationError } from './fields.js';
import {
  checkToday,
  createEntry,
  createIssue,
  createPlant,
  deleteEntry,
  getPlant,
  listEntries,
  restoreEntry,
  updateEntry,
  updatePlant
} from './index.js';
import { today } from '../dates.js';
import { changesFor, makePhoto, resetDatabase, startGarden } from '../../test/helpers.js';

beforeEach(resetDatabase);

describe('adding an entry', () => {
  it('fills in today, "Observation", the current person and the plant’s links', async () => {
    const { gardenId, personId, plantId } = await startGarden();
    await updatePlant(plantId, { areaId: 'area-1' });
    const id = await createEntry(plantId, { note: '  First buds  ' });
    expect(await db.entries.get(id)).toMatchObject({
      gardenId,
      plantId,
      areaId: 'area-1',
      issueId: null,
      visitId: null,
      taskId: null,
      occurredOn: today(),
      kind: 'observation',
      note: 'First buds',
      product: null,
      doneBy: personId,
      editedAt: null,
      auto: false,
      tags: []
    });
  });

  it('needs a note, a photo, or a kind other than "Observation"', async () => {
    const { plantId } = await startGarden();
    const error = await createEntry(plantId, { note: '   ' }).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ field: 'note', reason: 'required' });
    await expect(createEntry(plantId, { kind: 'watered' })).resolves.toBeTruthy();
    await expect(createEntry(plantId, { photos: [makePhoto()] })).resolves.toBeTruthy();
    expect(await db.entries.count()).toBe(2);
  });

  it('keeps a product only for "Fed" and "Treated"', async () => {
    const { plantId } = await startGarden();
    const fed = await createEntry(plantId, { kind: 'fed', product: 'Tomato feed' });
    const watered = await createEntry(plantId, { kind: 'watered', product: 'Rainwater' });
    expect((await db.entries.get(fed)).product).toBe('Tomato feed');
    expect((await db.entries.get(watered)).product).toBeNull();
  });

  it('refuses a date in the future or a date that is not real', async () => {
    const { plantId } = await startGarden();
    await expect(createEntry(plantId, { note: 'x', occurredOn: '2999-01-01' })).rejects.toMatchObject({ reason: 'future' });
    await expect(createEntry(plantId, { note: 'x', occurredOn: '2026-02-30' })).rejects.toMatchObject({ reason: 'invalid' });
    await expect(createEntry(plantId, { note: 'x', kind: 'sang to it' })).rejects.toMatchObject({ field: 'kind' });
  });

  it('links only to an issue of the same plant', async () => {
    const { gardenId, plantId } = await startGarden();
    const own = await createIssue(plantId, { title: 'Aphids' });
    const rose = await createPlant(gardenId, { commonName: 'Rose' });
    const other = await createIssue(rose, { title: 'Black spot' });
    const id = await createEntry(plantId, { kind: 'treated', issueId: own });
    expect((await db.entries.get(id)).issueId).toBe(own);
    await expect(createEntry(plantId, { kind: 'treated', issueId: other })).rejects.toMatchObject({ field: 'issueId' });
  });

  it('saves photos with their entry, and the first photo becomes the plant’s cover', async () => {
    const { plantId } = await startGarden();
    const first = await createEntry(plantId, { photos: [makePhoto({ caption: 'Bud' }), makePhoto()] });
    const photos = await db.photos.where('entryId').equals(first).toArray();
    expect(photos).toHaveLength(2);
    expect(photos[0]).toMatchObject({ plantId, issueId: null, width: 1600, height: 1200, sha256: 'abc123' });
    expect(photos[0].blob).toBeInstanceOf(Blob);
    const plant = await getPlant(plantId);
    expect(photos.map((p) => p.id)).toContain(plant?.coverPhotoId);
    expect(plant?.cover?.thumb).toBeInstanceOf(Blob);

    const cover = plant?.coverPhotoId;
    await createEntry(plantId, { photos: [makePhoto()] });
    expect((await getPlant(plantId))?.coverPhotoId).toBe(cover);
  });

  it('allows up to ten photos and refuses anything that is not a processed photo', async () => {
    const { plantId } = await startGarden();
    const eleven = Array.from({ length: 11 }, () => makePhoto());
    await expect(createEntry(plantId, { photos: eleven })).rejects.toMatchObject({ reason: 'tooMany', limit: 10 });
    await expect(createEntry(plantId, { photos: eleven.slice(1) })).resolves.toBeTruthy();
    await expect(createEntry(plantId, { photos: [makePhoto({ blob: 'not a blob' })] })).rejects.toMatchObject({ field: 'blob' });
  });
});

describe('editing an entry', () => {
  it('keeps createdAt, sets editedAt and logs only what changed', async () => {
    const { plantId } = await startGarden();
    const id = await createEntry(plantId, { note: 'Flowering' });
    const before = await db.entries.get(id);
    await updateEntry(id, { note: 'Flowering well' });
    const after = await db.entries.get(id);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.editedAt).toBe(after.updatedAt);
    expect((await changesFor(id)).find((c) => c.action === 'update').changedFields.sort()).toEqual(['editedAt', 'note']);
  });

  it('does not mark an entry edited when nothing changed', async () => {
    const { plantId } = await startGarden();
    const id = await createEntry(plantId, { note: 'Flowering' });
    await updateEntry(id, { note: 'Flowering ' });
    expect((await db.entries.get(id)).editedAt).toBeNull();
  });

  it('clears the product when the kind changes away from "Fed" or "Treated"', async () => {
    const { plantId } = await startGarden();
    const id = await createEntry(plantId, { kind: 'fed', product: 'Seaweed' });
    await updateEntry(id, { kind: 'watered' });
    expect((await db.entries.get(id)).product).toBeNull();
  });

  it('keeps the product of an entry whose kind this version does not know', async () => {
    const { plantId } = await startGarden();
    const id = await createEntry(plantId, { kind: 'fed', product: 'Bark mulch' });
    await db.entries.update(id, { kind: 'mulched' });
    await updateEntry(id, { note: 'Spread round the base' });
    expect(await db.entries.get(id)).toMatchObject({ kind: 'mulched', product: 'Bark mulch' });
  });

  it('still needs a note, a photo or a kind other than "Observation"', async () => {
    const { plantId } = await startGarden();
    const plain = await createEntry(plantId, { note: 'Hello' });
    await expect(updateEntry(plain, { note: '' })).rejects.toMatchObject({ field: 'note' });
    const withPhoto = await createEntry(plantId, { note: 'Hello', photos: [makePhoto()] });
    await expect(updateEntry(withPhoto, { note: '' })).resolves.toBeUndefined();
  });

  it('cannot edit or delete an entry the app wrote itself', async () => {
    const { plantId } = await startGarden();
    const issueId = await createIssue(plantId, { title: 'Aphids' });
    const auto = await db.entries.where('issueId').equals(issueId).first();
    await expect(updateEntry(auto.id, { note: 'Changed' })).rejects.toBeInstanceOf(AutomaticEntryError);
    await expect(deleteEntry(auto.id)).rejects.toBeInstanceOf(AutomaticEntryError);
    expect(await db.entries.get(auto.id)).toEqual(auto);
  });
});

describe('deleting an entry', () => {
  it('deletes the entry and its photos, and undo brings them back', async () => {
    const { plantId } = await startGarden();
    const id = await createEntry(plantId, { note: 'Hello', photos: [makePhoto(), makePhoto()] });
    const deletedAt = await deleteEntry(id);
    expect((await listEntries(plantId)).entries).toHaveLength(0);
    expect(await db.photos.where('entryId').equals(id).filter((p) => p.deletedAt === deletedAt).count()).toBe(2);
    await restoreEntry(id, deletedAt);
    const [entry] = (await listEntries(plantId)).entries;
    expect(entry.id).toBe(id);
    expect(entry.photos).toHaveLength(2);
  });

  it('leaves the plant with no cover if the cover photo goes, and the next photo becomes the cover', async () => {
    const { plantId } = await startGarden();
    const id = await createEntry(plantId, { photos: [makePhoto()] });
    await deleteEntry(id);
    expect((await getPlant(plantId))?.cover).toBeNull();
    const next = await createEntry(plantId, { photos: [makePhoto()] });
    const [photo] = await db.photos.where('entryId').equals(next).toArray();
    expect((await getPlant(plantId))?.coverPhotoId).toBe(photo.id);
  });
});

describe('the timeline', () => {
  it('lists entries newest first, then by when they were written, with photos in the order taken', async () => {
    const { plantId } = await startGarden();
    const older = await createEntry(plantId, { note: 'Older', occurredOn: '2026-05-01' });
    const morning = await createEntry(plantId, { note: 'Morning', occurredOn: '2026-06-01' });
    const evening = await createEntry(plantId, {
      note: 'Evening',
      occurredOn: '2026-06-01',
      photos: [makePhoto({ takenAt: '2026-06-01T19:00:00Z' }), makePhoto({ takenAt: '2026-06-01T18:00:00Z' })]
    });
    const { entries, hasMore } = await listEntries(plantId);
    expect(entries.map((e) => e.id)).toEqual([evening, morning, older]);
    expect(entries[0].photos.map((/** @type {any} */ p) => p.takenAt)).toEqual([
      '2026-06-01T18:00:00.000Z',
      '2026-06-01T19:00:00.000Z'
    ]);
    expect(entries[1].photos).toEqual([]);
    expect(hasMore).toBe(false);
  });

  it('loads a page at a time and says when there are more', async () => {
    const { plantId } = await startGarden();
    for (let day = 1; day <= 5; day += 1) await createEntry(plantId, { note: `Day ${day}`, occurredOn: `2026-06-0${day}` });
    const firstPage = await listEntries(plantId, 3);
    expect(firstPage.entries.map((e) => e.note)).toEqual(['Day 5', 'Day 4', 'Day 3']);
    expect(firstPage.hasMore).toBe(true);
    expect((await listEntries(plantId, 6)).hasMore).toBe(false);
  });
});

describe('checked today', () => {
  it('adds a "Checked" entry dated today, once per person per plant per day', async () => {
    const { plantId, personId } = await startGarden();
    const id = await checkToday(plantId);
    expect(await db.entries.get(id)).toMatchObject({ kind: 'checked', occurredOn: today(), doneBy: personId });
    expect(await checkToday(plantId)).toBeNull();
    expect(await db.entries.count()).toBe(1);
  });

  it('records one check when tapped twice at once', async () => {
    const { plantId } = await startGarden();
    const results = await Promise.all([checkToday(plantId), checkToday(plantId)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await db.entries.count()).toBe(1);
  });

  it('lets another person check the same plant, and checks again after the first was deleted', async () => {
    const { plantId } = await startGarden();
    const first = await checkToday(plantId);
    await db.meta.put({ key: 'currentPersonId', value: 'someone-else' });
    expect(await checkToday(plantId)).toBeTruthy();
    await db.meta.put({ key: 'currentPersonId', value: (await db.entries.get(first)).doneBy });
    await db.entries.update(first, { deletedAt: new Date().toISOString() });
    expect(await checkToday(plantId)).toBeTruthy();
  });
});
