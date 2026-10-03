import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema.js';
import { MissingRecordError } from './write.js';
import {
  createArea,
  createTask,
  createVisit,
  deleteArea,
  getArea,
  getVisit,
  listAreas,
  listTasks,
  restoreArea,
  updateTask
} from './index.js';
import { resetDatabase, startGarden } from '../../test/helpers.js';

beforeEach(resetDatabase);

describe('areas, tasks and visits', () => {
  it('creates, lists, deletes and restores an area', async () => {
    const { gardenId } = await startGarden();
    const id = await createArea(gardenId, { name: 'Front border', sun: 'part' });
    expect(await listAreas(gardenId)).toEqual([expect.objectContaining({ id, name: 'Front border', sun: 'part', gardenId })]);
    const deletedAt = await deleteArea(id);
    expect(await getArea(id)).toBeUndefined();
    await restoreArea(id, deletedAt);
    expect(await getArea(id)).toMatchObject({ name: 'Front border' });
    expect((await db.changes.where('recordId').equals(id).toArray()).map((c) => c.action).sort()).toEqual([
      'create',
      'delete',
      'update'
    ]);
  });

  it('checks values and the garden', async () => {
    const { gardenId } = await startGarden();
    await expect(createArea(gardenId, { name: 'Bed', sun: 'dappled' })).rejects.toMatchObject({ field: 'sun' });
    await expect(createArea('no-such-garden', { name: 'Bed' })).rejects.toBeInstanceOf(MissingRecordError);
    await expect(createTask(gardenId, { title: '' })).rejects.toMatchObject({ field: 'title' });
  });

  it('marks a task done', async () => {
    const { gardenId, plantId } = await startGarden();
    const id = await createTask(gardenId, { title: 'Stake dahlias', plantId, dueOn: '2027-05-01' });
    await updateTask(id, { doneOn: '2026-09-30' });
    expect(await listTasks(gardenId)).toEqual([expect.objectContaining({ dueOn: '2027-05-01', doneOn: '2026-09-30' })]);
  });

  it('stores visit times as UTC timestamps', async () => {
    const { gardenId } = await startGarden();
    const id = await createVisit(gardenId, { startedAt: '2026-10-03T10:00:00+01:00' });
    expect((await getVisit(id))?.startedAt).toBe('2026-10-03T09:00:00.000Z');
    await expect(createVisit(gardenId, { startedAt: 'teatime' })).rejects.toMatchObject({ field: 'startedAt' });
  });
});
