import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { SCHEMA_VERSION, createDatabase } from './schema.js';

/** Databases made by these tests, deleted afterwards */
/** @type {Dexie[]} */
const opened = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.delete()));
});

/** @param {string} name */
function open(name) {
  const db = createDatabase(name);
  opened.push(db);
  return db;
}

// The stores exactly as version 1 shipped them. Never edit this: it stands
// for a phone that still has a version 1 database when a newer app opens it.
const VERSION_1_STORES = {
  gardens: 'id',
  areas: 'id, gardenId',
  plants: 'id, gardenId, areaId, coverPhotoId, status, *tags',
  issues: 'id, gardenId, plantId, areaId, status, *tags',
  entries: 'id, gardenId, plantId, areaId, issueId, visitId, taskId, doneBy, [plantId+occurredOn], *tags',
  photos: 'id, gardenId, entryId, plantId, issueId, sha256, deletedAt',
  tasks: 'id, gardenId, plantId, areaId, issueId, dueOn',
  visits: 'id, gardenId, personId',
  people: 'id',
  changes: 'id, gardenId, recordId, by',
  drafts: 'key',
  meta: 'key'
};

describe('schema versions', () => {
  it('declares SCHEMA_VERSION as its newest version', async () => {
    const db = open('schema-version');
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
  });

  it('records schemaVersion in meta when a new database is created', async () => {
    const db = open('fresh');
    await db.open();
    expect((await db.table('meta').get('schemaVersion'))?.value).toBe(SCHEMA_VERSION);
  });

  it('opens a version 1 database, keeping its records and bringing schemaVersion up to date', async () => {
    const legacy = new Dexie('legacy');
    opened.push(legacy);
    legacy.version(1).stores(VERSION_1_STORES);
    await legacy.open();
    await legacy.table('meta').put({ key: 'schemaVersion', value: 1 });
    await legacy.table('plants').put({ id: 'p1', gardenId: 'g1', commonName: 'Rose', tags: ['old'], deletedAt: null, extra: {} });
    legacy.close();

    const db = open('legacy');
    await db.open();
    expect(await db.table('plants').get('p1')).toMatchObject({ commonName: 'Rose', tags: ['old'] });
    expect(await db.table('plants').where('tags').equals('old').count()).toBe(1);
    expect((await db.table('meta').get('schemaVersion'))?.value).toBe(SCHEMA_VERSION);
  });
});
