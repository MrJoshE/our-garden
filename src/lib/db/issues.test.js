import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema.js';
import { MissingRecordError } from './write.js';
import {
  createEntry,
  createIssue,
  deleteIssue,
  getPlant,
  listEntries,
  listIssues,
  restoreIssue,
  setIssueStatus,
  updateIssue
} from './index.js';
import { today } from '../dates.js';
import { strings } from '../strings.js';
import { makePhoto, resetDatabase, startGarden } from '../../test/helpers.js';

const auto = strings.autoEntry;

beforeEach(resetDatabase);

describe('flagging a problem', () => {
  it('opens the issue with defaults and writes its first entry into the timeline', async () => {
    const { personId, plantId } = await startGarden();
    const id = await createIssue(plantId, { title: ' Aphids on buds ', kind: 'pest', firstSeenOn: '2026-09-20' });
    expect(await db.issues.get(id)).toMatchObject({
      title: 'Aphids on buds',
      kind: 'pest',
      severity: 'medium',
      status: 'open',
      firstSeenOn: '2026-09-20',
      resolvedOn: null
    });
    const { entries } = await listEntries(plantId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      issueId: id,
      auto: true,
      kind: 'observation',
      occurredOn: '2026-09-20',
      note: auto.issueFlagged('Aphids on buds'),
      doneBy: personId
    });
  });

  it('attaches its photos to both the issue and its first entry', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Leaf spot', photos: [makePhoto()] });
    const [entry] = (await listEntries(plantId)).entries;
    expect(entry.photos).toHaveLength(1);
    expect(entry.photos[0].issueId).toBe(id);
  });

  it('needs a title and refuses unknown kinds and severities', async () => {
    const { plantId } = await startGarden();
    await expect(createIssue(plantId, { title: '' })).rejects.toMatchObject({ field: 'title', reason: 'required' });
    await expect(createIssue(plantId, { title: 'x', kind: 'gremlins' })).rejects.toMatchObject({ field: 'kind' });
    await expect(createIssue(plantId, { title: 'x', severity: 'dire' })).rejects.toMatchObject({ field: 'severity' });
    expect(await db.issues.count()).toBe(0);
    expect(await db.entries.count()).toBe(0);
  });
});

describe('changing an issue’s status', () => {
  it('resolving sets resolvedOn to today and notes it in the timeline', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids' });
    expect(await setIssueStatus(id, 'resolved')).toBe(true);
    expect(await db.issues.get(id)).toMatchObject({ status: 'resolved', resolvedOn: today() });
    const [latest] = (await listEntries(plantId)).entries;
    expect(latest).toMatchObject({ issueId: id, auto: true, note: auto.issueStatus.resolved, occurredOn: today() });
  });

  it('reopening clears resolvedOn', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids' });
    await setIssueStatus(id, 'resolved');
    await setIssueStatus(id, 'open');
    expect(await db.issues.get(id)).toMatchObject({ status: 'open', resolvedOn: null });
    const notes = (await listEntries(plantId)).entries.map((e) => e.note);
    expect(notes).toEqual(expect.arrayContaining([auto.issueStatus.resolved, auto.issueStatus.open, auto.issueFlagged('Aphids')]));
  });

  it('does nothing when the status is already that', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids' });
    expect(await setIssueStatus(id, 'open')).toBe(false);
    expect(await db.entries.count()).toBe(1);
  });

  it('refuses an unknown status', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids' });
    await expect(setIssueStatus(id, /** @type {any} */ ('gone'))).rejects.toMatchObject({ field: 'status' });
    // @ts-expect-error checking a missing status is refused
    await expect(setIssueStatus(id)).rejects.toMatchObject({ field: 'status', reason: 'required' });
  });

  it('keeps the first timeline entry in step when the title or first seen date is corrected', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids', firstSeenOn: '2026-09-20' });
    await setIssueStatus(id, 'watching');
    await updateIssue(id, { title: 'Greenfly', firstSeenOn: '2026-09-13' });
    const entries = (await listEntries(plantId)).entries.map((e) => [e.occurredOn, e.note]);
    expect(entries).toEqual([
      [today(), auto.issueStatus.watching],
      ['2026-09-13', auto.issueFlagged('Greenfly')]
    ]);
  });

  it('is not changed by editing the issue’s details', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids' });
    await updateIssue(id, { title: 'Greenfly', severity: 'high', status: 'resolved' });
    expect(await db.issues.get(id)).toMatchObject({ title: 'Greenfly', severity: 'high', status: 'open' });
  });
});

describe('deleting an issue', () => {
  it('deletes the issue with the entries the app wrote for it and its photos, keeping her own linked entries', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids', photos: [makePhoto()] });
    await setIssueStatus(id, 'watching');
    const treated = await createEntry(plantId, { kind: 'treated', product: 'Soapy water', issueId: id });

    await deleteIssue(id);

    expect(await listIssues(plantId)).toEqual([]);
    expect((await getPlant(plantId))?.needsAttention).toBe(false);
    const { entries } = await listEntries(plantId);
    expect(entries.map((e) => e.id)).toEqual([treated]);
    expect(await db.photos.where('issueId').equals(id).filter((p) => p.deletedAt == null).count()).toBe(0);
  });

  it('undo brings back exactly what the delete removed', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids', photos: [makePhoto()] });
    await setIssueStatus(id, 'watching');
    const timeline = async () =>
      (await listEntries(plantId)).entries.map((e) => [e.id, e.photos.map((/** @type {any} */ p) => p.id)]);
    const before = await timeline();

    const deletedAt = await deleteIssue(id);
    await restoreIssue(id, deletedAt);

    expect((await listIssues(plantId)).map((i) => i.id)).toEqual([id]);
    expect((await getPlant(plantId))?.needsAttention).toBe(true);
    expect(await timeline()).toEqual(before);
  });

  it('cannot delete an issue that is missing or already deleted', async () => {
    const { plantId } = await startGarden();
    const id = await createIssue(plantId, { title: 'Aphids' });
    await deleteIssue(id);
    await expect(deleteIssue(id)).rejects.toBeInstanceOf(MissingRecordError);
    await expect(deleteIssue('no-such-issue')).rejects.toBeInstanceOf(MissingRecordError);
  });
});

describe('listing issues', () => {
  it('lists a plant’s issues, most recently seen first', async () => {
    const { plantId } = await startGarden();
    await createIssue(plantId, { title: 'Old', firstSeenOn: '2026-04-01' });
    await createIssue(plantId, { title: 'New', firstSeenOn: '2026-09-01' });
    expect((await listIssues(plantId)).map((i) => i.title)).toEqual(['New', 'Old']);
  });
});
