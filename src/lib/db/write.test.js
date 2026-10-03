import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './schema.js';
import { MissingRecordError, write } from './write.js';
import { createEntry, deleteEntry, getPlant, updatePlant } from './index.js';
import { getErrorLog } from '../log.js';
import { UUID, changesFor, resetDatabase, startGarden } from '../../test/helpers.js';

beforeEach(resetDatabase);
afterEach(() => {
  vi.useRealTimers();
});

describe('the write path', () => {
  it('stamps a new record with an id, timestamps, deletedAt and extra', async () => {
    const { gardenId, plantId } = await startGarden();
    const plant = await db.plants.get(plantId);
    expect(plant.id).toMatch(UUID);
    expect(plant.gardenId).toBe(gardenId);
    expect(plant.createdAt).toBe(plant.updatedAt);
    expect(Date.parse(plant.createdAt)).not.toBeNaN();
    expect(plant.deletedAt).toBeNull();
    expect(plant.extra).toEqual({});
  });

  it('gives a garden its own id as its gardenId', async () => {
    const { gardenId } = await startGarden();
    expect((await db.gardens.get(gardenId)).gardenId).toBe(gardenId);
  });

  it('logs a create with the table, record, action, fields, time, person and device', async () => {
    const { gardenId, personId, plantId } = await startGarden();
    const plant = await db.plants.get(plantId);
    const [change] = await changesFor(plantId);
    expect(change).toMatchObject({
      gardenId,
      table: 'plants',
      recordId: plantId,
      action: 'create',
      at: plant.createdAt,
      by: personId,
      deviceId: (await db.meta.get('deviceId')).value
    });
    expect(change.changedFields).toContain('commonName');
  });

  it('logs only the fields an update changed, and moves updatedAt on', async () => {
    const { plantId } = await startGarden();
    await updatePlant(plantId, { commonName: 'Foxglove', variety: 'Pam’s Choice' });
    const plant = await db.plants.get(plantId);
    const update = (await changesFor(plantId)).find((c) => c.action === 'update');
    expect(update.changedFields).toEqual(['variety']);
    expect(plant.updatedAt > plant.createdAt).toBe(true);
    expect(plant.createdAt).toBe((await changesFor(plantId)).find((c) => c.action === 'create').at);
  });

  it('writes nothing when an update changes nothing', async () => {
    const { plantId } = await startGarden();
    const before = await db.plants.get(plantId);
    await updatePlant(plantId, { commonName: '  Foxglove  ', tags: [] });
    expect(await db.plants.get(plantId)).toEqual(before);
    expect(await changesFor(plantId)).toHaveLength(1);
  });

  it('creates one device id and keeps it', async () => {
    const { plantId } = await startGarden();
    await updatePlant(plantId, { variety: 'Dalmatian' });
    const deviceIds = new Set((await db.changes.toArray()).map((c) => c.deviceId));
    expect(deviceIds.size).toBe(1);
    expect([...deviceIds][0]).toMatch(UUID);
  });

  it('saves nothing, not even the change log, if any part of a write fails', async () => {
    const { gardenId } = await startGarden();
    const plants = await db.plants.count();
    const changes = await db.changes.count();
    const boom = new Error('boom');
    await expect(
      write('test', ['plants'], async (w) => {
        await w.create('plants', { gardenId, commonName: 'Rose' });
        throw boom;
      })
    ).rejects.toBe(boom);
    expect(await db.plants.count()).toBe(plants);
    expect(await db.changes.count()).toBe(changes);
  });

  it('logs a failed write with its operation and passes the same error on', async () => {
    await startGarden();
    const error = await updatePlant('no-such-plant', { variety: 'x' }).catch((e) => e);
    expect(error).toBeInstanceOf(MissingRecordError);
    const log = await getErrorLog();
    expect(log.at(-1)).toMatchObject({
      name: 'MissingRecordError',
      details: { table: 'plants', id: 'no-such-plant' },
      context: { operation: 'updatePlant' }
    });
  });

  it('treats a deleted record as missing', async () => {
    const { plantId } = await startGarden();
    await db.plants.update(plantId, { deletedAt: new Date().toISOString() });
    await expect(updatePlant(plantId, { variety: 'x' })).rejects.toBeInstanceOf(MissingRecordError);
    expect(await getPlant(plantId)).toBeUndefined();
  });

  it('never gives two deletes the same deletedAt, even in the same millisecond', async () => {
    const { plantId } = await startGarden();
    const first = await createEntry(plantId, { note: 'one' });
    const second = await createEntry(plantId, { note: 'two' });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-01-01T09:00:00.000Z'));
    const a = await deleteEntry(first);
    const b = await deleteEntry(second);
    expect(a).toBe('2030-01-01T09:00:00.000Z');
    expect(b > a).toBe(true);
  });
});
