import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema.js';
import { ValidationError } from './fields.js';
import {
  createEntry,
  createFirstGarden,
  createGarden,
  createIssue,
  createPlant,
  deleteGarden,
  findStartGardenId,
  getCurrentPerson,
  getGarden,
  getMeta,
  listGardens,
  listPeople,
  listPlants,
  setLastGarden,
  updateGarden,
  updatePerson
} from './index.js';
import { changesFor, makePhoto, resetDatabase, startGarden } from '../../test/helpers.js';

beforeEach(resetDatabase);

describe('first run', () => {
  it('creates the person and the garden together and makes both current', async () => {
    const gardenId = await createFirstGarden({ personName: ' Sam ', gardenName: 'Back garden' });
    const person = await getCurrentPerson();
    expect(person).toMatchObject({ name: 'Sam', role: null });
    expect(await getGarden(gardenId)).toMatchObject({ name: 'Back garden', status: 'active' });
    expect(await getMeta('lastGardenId')).toBe(gardenId);
    const [gardenChange] = await changesFor(gardenId);
    expect(gardenChange.by).toBe(person.id);
  });

  it('names the field that is missing and saves nothing', async () => {
    await expect(createFirstGarden({ personName: '', gardenName: 'Back garden' })).rejects.toMatchObject({
      field: 'personName',
      reason: 'required'
    });
    await expect(createFirstGarden({ personName: 'Sam', gardenName: '   ' })).rejects.toMatchObject({
      field: 'gardenName',
      reason: 'required'
    });
    expect(await db.people.count()).toBe(0);
    expect(await db.gardens.count()).toBe(0);
  });
});

describe('gardens', () => {
  it('keeps the name exactly as entered, apart from surrounding spaces', async () => {
    const id = await createGarden({ name: '  Mrs Óg’s plot  ' });
    expect((await getGarden(id))?.name).toBe('Mrs Óg’s plot');
  });

  it('lists gardens by name with archived ones last, leaving out deleted ones', async () => {
    await createGarden({ name: 'allotment' });
    await createGarden({ name: 'Old house', status: 'archived' });
    await createGarden({ name: 'Back garden' });
    const gone = await createGarden({ name: 'Aardvark Lane' });
    await deleteGarden(gone);
    expect((await listGardens()).map((g) => g.name)).toEqual(['allotment', 'Back garden', 'Old house']);
  });

  it('renames a garden', async () => {
    const { gardenId } = await startGarden();
    await updateGarden(gardenId, { name: 'Front garden' });
    expect((await getGarden(gardenId))?.name).toBe('Front garden');
  });

  it('refuses a name over 120 characters and says what the limit is', async () => {
    const { gardenId } = await startGarden();
    const error = await updateGarden(gardenId, { name: 'x'.repeat(121) }).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error).toMatchObject({ field: 'name', reason: 'tooLong', limit: 120 });
    await expect(updateGarden(gardenId, { name: 'x'.repeat(120) })).resolves.toBeUndefined();
  });

  it('refuses an unknown status and out of range coordinates', async () => {
    const { gardenId } = await startGarden();
    await expect(updateGarden(gardenId, { status: 'sold' })).rejects.toMatchObject({ field: 'status', reason: 'invalid' });
    await expect(updateGarden(gardenId, { latitude: 91 })).rejects.toMatchObject({ field: 'latitude' });
    await updateGarden(gardenId, { latitude: '51.5', longitude: -0.12 });
    expect(await getGarden(gardenId)).toMatchObject({ latitude: 51.5, longitude: -0.12 });
    await updateGarden(gardenId, { latitude: '  ' });
    expect((await getGarden(gardenId))?.latitude).toBeNull();
  });

  it('deletes a garden with everything in it, and forgets it as the last garden', async () => {
    const { gardenId, plantId } = await startGarden();
    await createEntry(plantId, { note: 'Looking well', photos: [makePhoto()] });
    await createIssue(plantId, { title: 'Rust' });
    const otherGarden = await createGarden({ name: 'Allotment' });
    const otherPlant = await createPlant(otherGarden, { commonName: 'Leek' });

    await deleteGarden(gardenId);

    expect(await getGarden(gardenId)).toBeUndefined();
    for (const table of ['plants', 'entries', 'issues', 'photos']) {
      const left = await db.table(table).where('gardenId').equals(gardenId).filter((r) => r.deletedAt == null).count();
      expect(left, table).toBe(0);
    }
    expect(await getMeta('lastGardenId')).toBeUndefined();
    expect((await listPlants(otherGarden)).map((p) => p.id)).toEqual([otherPlant]);
  });
});

describe('which garden opens on start', () => {
  it('is the last garden used', async () => {
    await createGarden({ name: 'Allotment' });
    const back = await createGarden({ name: 'Back garden' });
    await setLastGarden(back);
    expect(await findStartGardenId()).toBe(back);
  });

  it('falls back to the first active garden by name when the last one has gone', async () => {
    const zinnias = await createGarden({ name: 'Zinnia beds' });
    const allotment = await createGarden({ name: 'Allotment' });
    await createGarden({ name: 'Aardvark Lane', status: 'archived' });
    await setLastGarden(zinnias);
    await deleteGarden(zinnias);
    expect(await findStartGardenId()).toBe(allotment);
  });

  it('is none before first run', async () => {
    expect(await findStartGardenId()).toBeNull();
  });
});

describe('people', () => {
  it('lists people and renames the current person', async () => {
    const { personId } = await startGarden();
    await updatePerson(personId, { name: 'Sam Smith' });
    expect((await getCurrentPerson())?.name).toBe('Sam Smith');
    expect((await listPeople()).map((p) => p.name)).toEqual(['Sam Smith']);
  });
});
