import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema.js';
import { MissingRecordError } from './write.js';
import {
  checkToday,
  createEntry,
  createGarden,
  createIssue,
  createPlant,
  deleteEntry,
  deletePlant,
  getPlant,
  listPlants,
  restorePlant,
  setIssueStatus,
  updatePlant
} from './index.js';
import { today } from '../dates.js';
import { makePhoto, resetDatabase, startGarden } from '../../test/helpers.js';

beforeEach(resetDatabase);

describe('plants', () => {
  it('fills in defaults and trims text, storing blanks as null', async () => {
    const { gardenId } = await startGarden();
    const id = await createPlant(gardenId, { commonName: ' Rose ', variety: '  ', tags: [' scented ', 'scented', ''] });
    expect(await getPlant(id)).toMatchObject({
      commonName: 'Rose',
      variety: null,
      status: 'growing',
      tags: ['scented'],
      coverPhotoId: null,
      cover: null
    });
  });

  it('needs a name and a garden that exists', async () => {
    const { gardenId } = await startGarden();
    await expect(createPlant(gardenId, { commonName: '' })).rejects.toMatchObject({ field: 'commonName', reason: 'required' });
    await expect(createPlant('no-such-garden', { commonName: 'Rose' })).rejects.toBeInstanceOf(MissingRecordError);
  });

  it('refuses bad values', async () => {
    const { plantId } = await startGarden();
    await expect(updatePlant(plantId, { status: 'thriving' })).rejects.toMatchObject({ field: 'status' });
    await expect(updatePlant(plantId, { quantity: 0 })).rejects.toMatchObject({ field: 'quantity' });
    await expect(updatePlant(plantId, { quantity: 1.5 })).rejects.toMatchObject({ field: 'quantity' });
    await expect(updatePlant(plantId, { plantedOn: '2999-01-01' })).rejects.toMatchObject({ reason: 'future' });
    await expect(updatePlant(plantId, { careNotes: 'x'.repeat(5001) })).rejects.toMatchObject({ limit: 5000 });
  });

  it('lists a garden’s plants by name, ignoring case, with removed and dead plants last', async () => {
    const { gardenId, plantId } = await startGarden();
    await createPlant(gardenId, { commonName: 'apple' });
    await createPlant(gardenId, { commonName: 'Clematis', status: 'dead' });
    await createPlant(gardenId, { commonName: 'Box', status: 'removed' });
    await createPlant(gardenId, { commonName: 'Dahlia', status: 'dormant' });
    const gone = await createPlant(gardenId, { commonName: 'Agapanthus' });
    await deletePlant(gone);
    const elsewhere = await createGarden({ name: 'Allotment' });
    await createPlant(elsewhere, { commonName: 'Leek' });
    expect((await listPlants(gardenId)).map((p) => p.commonName)).toEqual(['apple', 'Dahlia', 'Foxglove', 'Box', 'Clematis']);
    expect((await listPlants(gardenId)).find((p) => p.id === plantId)).toMatchObject({ needsAttention: false, cover: null });
  });
});

describe('needs attention', () => {
  it('is true while the plant has an open or watching issue, and false once it is resolved', async () => {
    const { gardenId, plantId } = await startGarden();
    const needsAttention = async () => [
      (await getPlant(plantId))?.needsAttention,
      (await listPlants(gardenId)).find((p) => p.id === plantId)?.needsAttention
    ];
    expect(await needsAttention()).toEqual([false, false]);
    const issueId = await createIssue(plantId, { title: 'Aphids' });
    expect(await needsAttention()).toEqual([true, true]);
    await setIssueStatus(issueId, 'watching');
    expect(await needsAttention()).toEqual([true, true]);
    await setIssueStatus(issueId, 'resolved');
    expect(await needsAttention()).toEqual([false, false]);
  });

  it('only counts the plant’s own issues, and not deleted ones', async () => {
    const { gardenId, plantId } = await startGarden();
    const other = await createPlant(gardenId, { commonName: 'Rose' });
    const issueId = await createIssue(other, { title: 'Black spot' });
    expect((await getPlant(plantId))?.needsAttention).toBe(false);
    await db.issues.update(issueId, { deletedAt: new Date().toISOString() });
    expect((await getPlant(other))?.needsAttention).toBe(false);
  });

  it('is not stored on the plant', async () => {
    const { plantId } = await startGarden();
    await createIssue(plantId, { title: 'Aphids' });
    const stored = await db.plants.get(plantId);
    expect(stored).not.toHaveProperty('needsAttention');
    expect(stored).not.toHaveProperty('lastCheckedOn');
  });
});

describe('last checked', () => {
  it('is the date of the most recent entry of any kind, leaving out deleted ones', async () => {
    const { plantId } = await startGarden();
    expect((await getPlant(plantId))?.lastCheckedOn).toBeNull();
    await createEntry(plantId, { kind: 'watered', occurredOn: '2026-05-01' });
    const latest = await createEntry(plantId, { note: 'Flowering', occurredOn: '2026-06-10' });
    await createEntry(plantId, { kind: 'fed', occurredOn: '2026-06-02' });
    expect((await getPlant(plantId))?.lastCheckedOn).toBe('2026-06-10');
    await deleteEntry(latest);
    expect((await getPlant(plantId))?.lastCheckedOn).toBe('2026-06-02');
  });

  it('counts the entries the app writes itself', async () => {
    const { plantId } = await startGarden();
    await createEntry(plantId, { kind: 'watered', occurredOn: '2026-05-01' });
    await createIssue(plantId, { title: 'Slugs' });
    expect((await getPlant(plantId))?.lastCheckedOn).toBe(today());
  });
});

describe('checked today', () => {
  it('gives the date this person last marked the plant checked, ignoring other kinds and other people', async () => {
    const { plantId } = await startGarden();
    expect((await getPlant(plantId))?.lastOwnCheckOn).toBeNull();
    await createEntry(plantId, { kind: 'watered' });
    expect((await getPlant(plantId))?.lastOwnCheckOn).toBeNull();
    await createEntry(plantId, { kind: 'checked', occurredOn: '2026-06-01' });
    await createEntry(plantId, { kind: 'checked', occurredOn: '2026-06-05', doneBy: 'someone-else' });
    expect((await getPlant(plantId))?.lastOwnCheckOn).toBe('2026-06-01');
    await checkToday(plantId);
    expect((await getPlant(plantId))?.lastOwnCheckOn).toBe(today());
  });
});

describe('deleting a plant', () => {
  it('deletes its entries, issues and photos in one go, and undo brings back exactly those', async () => {
    const { plantId } = await startGarden();
    const keptEntry = await createEntry(plantId, { note: 'Kept', photos: [makePhoto()] });
    const earlierDeleted = await createEntry(plantId, { note: 'Deleted first' });
    await createIssue(plantId, { title: 'Mildew' });
    await deleteEntry(earlierDeleted);
    const earlierDeletedAt = (await db.entries.get(earlierDeleted)).deletedAt;

    const deletedAt = await deletePlant(plantId);
    expect(await getPlant(plantId)).toBeUndefined();
    for (const table of ['entries', 'issues', 'photos']) {
      const records = await db.table(table).where('plantId').equals(plantId).toArray();
      expect(records.every((r) => r.deletedAt != null), table).toBe(true);
    }

    await restorePlant(plantId, deletedAt);
    const plant = await getPlant(plantId);
    expect(plant?.cover).not.toBeNull();
    expect((await db.entries.get(keptEntry)).deletedAt).toBeNull();
    expect((await db.entries.get(earlierDeleted)).deletedAt).toBe(earlierDeletedAt);
    expect(await db.issues.where('plantId').equals(plantId).filter((r) => r.deletedAt == null).count()).toBe(1);
    expect(await db.photos.where('plantId').equals(plantId).filter((r) => r.deletedAt == null).count()).toBe(1);
  });

  it('logs each record the delete changed', async () => {
    const { plantId } = await startGarden();
    const entryId = await createEntry(plantId, { note: 'Hello' });
    await deletePlant(plantId);
    const deletes = await db.changes.filter((c) => c.action === 'delete').toArray();
    expect(deletes.map((c) => c.recordId).sort()).toEqual([entryId, plantId].sort());
    expect(deletes.every((c) => c.changedFields.join() === 'deletedAt')).toBe(true);
  });
});
