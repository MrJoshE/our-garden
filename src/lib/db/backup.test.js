import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { db, SCHEMA_VERSION } from './schema.js';
import {
  createEntry,
  createIssue,
  createPlant,
  exportJournal,
  getCurrentPerson,
  getMeta,
  importJournal,
  saveDraft,
  setMeta,
  shouldRemindBackup,
  updatePlant
} from './index.js';
import { makePhoto, resetDatabase, startGarden } from '../../test/helpers.js';

beforeEach(resetDatabase);

/** @param {Blob} zip */
async function unzip(zip) {
  return unzipSync(new Uint8Array(await zip.arrayBuffer()));
}

/** Every journal record by table, with photo files read out so they compare by content */
async function journal() {
  const names = db.tables.map((table) => table.name).filter((name) => !['drafts', 'changes', 'meta'].includes(name));
  /** @type {Record<string, any[]>} */
  const tables = {};
  for (const name of names) {
    const records = await db.table(name).toArray();
    tables[name] =
      name === 'photos'
        ? await Promise.all(
            records.map(async (photo) => ({ ...photo, blob: await photo.blob?.text(), thumb: await photo.thumb?.text() }))
          )
        : records;
  }
  return tables;
}

/** @param {unknown} data what garden-journal.json holds */
const backupOf = (data) => new Blob([zipSync({ 'garden-journal.json': strToU8(JSON.stringify(data)) })]);

describe('backup export', () => {
  it('holds every record except drafts, and each photo and thumbnail as a file named by its id', async () => {
    const { plantId } = await startGarden();
    await createEntry(plantId, { note: 'Flowering', photos: [makePhoto()] });
    await saveDraft('entry:new', { note: 'Half written' });
    const [{ blob, thumb, ...photo }] = await db.photos.toArray();

    const files = await unzip((await exportJournal()).zip);

    expect(Object.keys(files).sort()).toEqual(
      ['garden-journal.json', `photos/${photo.id}-thumb.jpg`, `photos/${photo.id}.jpg`].sort()
    );
    expect(strFromU8(files[`photos/${photo.id}.jpg`])).toBe('full');
    expect(strFromU8(files[`photos/${photo.id}-thumb.jpg`])).toBe('thumb');

    const backup = JSON.parse(strFromU8(files['garden-journal.json']));
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(backup.appVersion).toEqual(expect.any(String));
    expect(Date.parse(backup.exportedAt)).not.toBeNaN();
    const names = db.tables.map((table) => table.name).filter((name) => name !== 'drafts');
    expect(Object.keys(backup.tables).sort()).toEqual(names.sort());
    for (const name of names.filter((name) => name !== 'photos')) {
      expect(backup.tables[name]).toEqual(await db.table(name).toArray());
    }
    expect(backup.tables.photos).toEqual([photo]);
  });

  it('keeps the record of a photo whose files were purged, without any files for it', async () => {
    const { plantId } = await startGarden();
    await createEntry(plantId, { photos: [makePhoto()] });
    const [photo] = await db.photos.toArray();
    await db.photos.update(photo.id, { blob: null, thumb: null });

    const files = await unzip((await exportJournal()).zip);

    expect(Object.keys(files)).toEqual(['garden-journal.json']);
    expect(JSON.parse(strFromU8(files['garden-journal.json'])).tables.photos.map((p) => p.id)).toEqual([photo.id]);
  });

  it('reports progress after each photo', async () => {
    const { plantId } = await startGarden();
    await createEntry(plantId, { photos: [makePhoto(), makePhoto()] });
    /** @type {number[][]} */
    const progress = [];

    await exportJournal((done, total) => progress.push([done, total]));

    expect(progress).toEqual([
      [1, 2],
      [2, 2]
    ]);
  });
});

describe('backup import', () => {
  it('restores an exported journal into an empty database', async () => {
    const { plantId } = await startGarden();
    await createEntry(plantId, { note: 'Flowering', photos: [makePhoto()] });
    await createIssue(plantId, { title: 'Aphids', photos: [makePhoto()] });
    const before = await journal();
    const history = await db.changes.toArray();
    const { zip } = await exportJournal();
    await resetDatabase();

    const summary = await importJournal(zip);

    expect(await journal()).toEqual(before);
    expect(await db.changes.toArray()).toEqual(expect.arrayContaining(history));
    expect((await getCurrentPerson())?.id).toBe(before.people[0].id);
    expect(summary).toEqual({
      added: { gardens: 1, people: 1, plants: 1, issues: 1, entries: 2, photos: 2 },
      updated: {},
      skipped: 0
    });
  });

  it('restores a backup that was unzipped and zipped again inside a folder', async () => {
    const { plantId } = await startGarden();
    await createEntry(plantId, { photos: [makePhoto()] });
    const before = await journal();
    const files = await unzip((await exportJournal()).zip);
    const rezipped = Object.fromEntries(Object.entries(files).map(([name, data]) => [`garden-journal-2026-10-03/${name}`, data]));
    rezipped['__MACOSX/garden-journal-2026-10-03/._garden-journal.json'] = strToU8('mac metadata');
    await resetDatabase();

    await importJournal(new Blob([zipSync(rezipped)]));

    expect(await journal()).toEqual(before);
  });

  it('keeps whichever copy of a record was changed more recently', async () => {
    const { gardenId, plantId: foxglove } = await startGarden();
    const rose = await createPlant(gardenId, { commonName: 'Rose' });
    const { zip: older } = await exportJournal();
    await updatePlant(foxglove, { commonName: 'Foxglove, white' });
    const { zip: newer } = await exportJournal();

    await resetDatabase();
    await importJournal(older);
    await updatePlant(rose, { commonName: 'Rose, climbing' });
    const summary = await importJournal(newer);

    expect((await db.plants.get(foxglove))?.commonName).toBe('Foxglove, white');
    expect((await db.plants.get(rose))?.commonName).toBe('Rose, climbing');
    expect(summary).toEqual({ added: {}, updated: { plants: 1 }, skipped: 0 });
  });

  it('keeps this device’s photo file when a newer copy of the photo arrives without one', async () => {
    const { plantId } = await startGarden();
    await createEntry(plantId, { photos: [makePhoto()] });
    const [photo] = await db.photos.toArray();
    const { zip: withFiles } = await exportJournal();
    const later = new Date(Date.parse(photo.updatedAt) + 1000).toISOString();
    await db.photos.update(photo.id, { caption: 'Seedlings', updatedAt: later, blob: null, thumb: null });
    const { zip: withoutFiles } = await exportJournal();

    await resetDatabase();
    await importJournal(withFiles);
    await importJournal(withoutFiles);

    const restored = await db.photos.get(photo.id);
    expect(restored?.caption).toBe('Seedlings');
    expect(await restored?.blob?.text()).toBe('full');
  });

  it('refuses a backup from a newer version of the app, changing nothing', async () => {
    await startGarden();
    const before = await journal();

    await expect(importJournal(backupOf({ schemaVersion: SCHEMA_VERSION + 1, tables: {} }))).rejects.toMatchObject({
      reason: 'newerBackup'
    });
    expect(await journal()).toEqual(before);
  });

  it('refuses a file that is not a backup, changing nothing', async () => {
    await startGarden();
    const before = await journal();

    for (const file of [
      new Blob(['not a zip']),
      new Blob([zipSync({ 'notes.txt': strToU8('hello') })]),
      new Blob([zipSync({ 'garden-journal.json': strToU8('{ broken') })]),
      backupOf({ hello: 'world' })
    ]) {
      await expect(importJournal(file)).rejects.toMatchObject({ reason: 'notBackup' });
    }
    expect(await journal()).toEqual(before);
  });

  it('leaves out records too damaged to use, and counts them', async () => {
    const summary = await importJournal(
      backupOf({ schemaVersion: SCHEMA_VERSION, tables: { plants: [{ commonName: 'No id' }, null, 'plant'] } })
    );

    expect(summary).toEqual({ added: {}, updated: {}, skipped: 3 });
    expect(await db.plants.count()).toBe(0);
  });
});

describe('backup reminder', () => {
  const DAY = 86_400_000;
  /** @param {number} days from now, negative for the past */
  const daysFromNow = (days) => new Date(Date.now() + days * DAY);

  it('reminds when the last backup was over 30 days ago and she has written since', async () => {
    const { plantId } = await startGarden();
    await setMeta('lastBackupAt', daysFromNow(-31).toISOString());
    await createEntry(plantId, { note: 'Flowering' });

    expect(await shouldRemindBackup()).toBe(true);
  });

  it('does not remind when the last backup was recent', async () => {
    const { plantId } = await startGarden();
    await setMeta('lastBackupAt', daysFromNow(-10).toISOString());
    await createEntry(plantId, { note: 'Flowering' });

    expect(await shouldRemindBackup()).toBe(false);
  });

  it('does not remind when nothing has been written since the last backup', async () => {
    const { plantId } = await startGarden();
    const entry = await db.entries.get(await createEntry(plantId, { note: 'Flowering' }));
    await setMeta('lastBackupAt', new Date(Date.parse(entry?.createdAt) + 1).toISOString());

    expect(await shouldRemindBackup(daysFromNow(31))).toBe(false);
  });

  it('counts from when the journal began if she has never backed up', async () => {
    const { plantId } = await startGarden();
    await createEntry(plantId, { note: 'Flowering' });

    expect(await shouldRemindBackup(daysFromNow(10))).toBe(false);
    expect(await shouldRemindBackup(daysFromNow(31))).toBe(true);
  });

  it('reminds once, and again only after a later backup goes stale', async () => {
    const { plantId } = await startGarden();
    await setMeta('lastBackupAt', daysFromNow(-31).toISOString());
    await createEntry(plantId, { note: 'Flowering' });
    await setMeta('backupReminderShownAt', new Date().toISOString());

    expect(await shouldRemindBackup()).toBe(false);

    await setMeta('lastBackupAt', daysFromNow(1).toISOString());
    await db.entries.toCollection().modify({ createdAt: daysFromNow(2).toISOString() });
    expect(await shouldRemindBackup(daysFromNow(32))).toBe(true);
  });

  it('counts a restore as the last backup on a device that has never backed up', async () => {
    await startGarden();
    const { zip } = await exportJournal();
    const { exportedAt } = JSON.parse(strFromU8((await unzip(zip))['garden-journal.json']));
    await resetDatabase();

    await importJournal(zip);

    expect(await getMeta('lastBackupAt')).toBe(exportedAt);
  });
});
