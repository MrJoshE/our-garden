import { beforeEach, describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { db, SCHEMA_VERSION } from './schema.js';
import { createEntry, exportJournal, saveDraft } from './index.js';
import { makePhoto, resetDatabase, startGarden } from '../../test/helpers.js';

beforeEach(resetDatabase);

/** @param {Blob} zip */
async function unzip(zip) {
  return unzipSync(new Uint8Array(await zip.arrayBuffer()));
}

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
