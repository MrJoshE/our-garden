import { db, isCurrent } from './schema.js';
import { write } from './write.js';
import { clean, date, longText, oneOf, required, shortText, tags } from './fields.js';
import { addEntryRecord } from './entries.js';
import { addPhotoRecords, cleanPhotos } from './photos.js';
import { ACTIVE_ISSUE_STATUSES, ISSUE_KINDS, ISSUE_STATUSES, SEVERITIES } from '../constants.js';
import { today } from '../dates.js';
import { strings } from '../strings.js';

const FIELDS = {
  title: required(shortText),
  kind: oneOf(ISSUE_KINDS, 'other'),
  severity: oneOf(SEVERITIES, 'medium'),
  firstSeenOn: date({ fallback: today, notFuture: true }),
  notes: longText,
  tags
};

/**
 * An issue that makes its plant need attention.
 * @param {Record<string, any> | undefined} issue
 */
export function isActiveIssue(issue) {
  return isCurrent(issue) && ACTIVE_ISSUE_STATUSES.includes(issue.status);
}

/**
 * A plant's issues, most recently seen first.
 * @param {string} plantId
 */
export async function listIssues(plantId) {
  const issues = await db.issues.where('plantId').equals(plantId).filter(isCurrent).toArray();
  return issues.sort(
    (a, b) => (b.firstSeenOn ?? '').localeCompare(a.firstSeenOn ?? '') || b.createdAt.localeCompare(a.createdAt)
  );
}

/**
 * Flags a problem. Also writes the issue's first entry, so it shows in the
 * plant's timeline, and attaches any photos to that entry.
 * @param {string} plantId
 * @param {Record<string, any> & { photos?: unknown[] }} input
 * @returns {Promise<string>} the new issue's id
 */
export function createIssue(plantId, { photos = [], ...input }) {
  return write('createIssue', ['plants', 'issues', 'entries', 'photos'], async (w) => {
    const fields = clean(input, FIELDS);
    const cleanedPhotos = cleanPhotos(photos);
    const plant = await w.get('plants', plantId);
    const issue = await w.create('issues', {
      gardenId: plant.gardenId,
      plantId,
      areaId: plant.areaId ?? null,
      ...fields,
      status: 'open',
      resolvedOn: null
    });
    const entry = await addEntryRecord(w, plant, {
      occurredOn: fields.firstSeenOn,
      note: strings.autoEntry.issueFlagged(fields.title),
      issueId: issue.id,
      auto: true
    });
    await addPhotoRecords(w, plant, cleanedPhotos, { entryId: entry.id, issueId: issue.id });
    return issue.id;
  });
}

/**
 * Edits an issue's details, and keeps its first timeline entry in step with
 * the title and first seen date. Status changes go through setIssueStatus.
 * @param {string} id
 * @param {Record<string, any>} input
 */
export async function updateIssue(id, input) {
  await write('updateIssue', ['issues', 'entries'], async (w) => {
    const issue = await w.update('issues', id, clean(input, FIELDS, { partial: true }));
    // createIssue writes the first entry in the same write, so it shares the issue's createdAt
    const first = await db.entries
      .where('issueId')
      .equals(id)
      .filter((entry) => isCurrent(entry) && entry.auto && entry.createdAt === issue.createdAt)
      .first();
    if (first) {
      await w.update('entries', first.id, {
        occurredOn: issue.firstSeenOn,
        note: strings.autoEntry.issueFlagged(issue.title)
      });
    }
  });
}

/**
 * Moves an issue to open, watching or resolved, and notes the change in the
 * timeline. Resolving sets resolvedOn to today; any other status clears it.
 * @param {string} id
 * @param {'open' | 'watching' | 'resolved'} status
 * @returns {Promise<boolean>} false if the issue already had that status
 */
export function setIssueStatus(id, status) {
  return write('setIssueStatus', ['plants', 'issues', 'entries'], async (w) => {
    required(oneOf(ISSUE_STATUSES, null))(status, 'status');
    const issue = await w.get('issues', id);
    if (issue.status === status) return false;
    await w.update('issues', id, { status, resolvedOn: status === 'resolved' ? today() : null });
    const plant = await w.get('plants', issue.plantId);
    await addEntryRecord(w, plant, {
      note: strings.autoEntry.issueStatus[status],
      issueId: id,
      auto: true
    });
    return true;
  });
}

/**
 * Deletes an issue with the entries the app wrote for it and the photos
 * added with it. Her own entries linked to it are hers, so they stay.
 * @param {string} id
 * @returns {Promise<string>} the deletedAt to pass to restoreIssue
 */
export function deleteIssue(id) {
  return write('deleteIssue', ['issues', 'entries', 'photos'], async (w) => {
    await w.remove('issues', id);
    const automatic = await db.entries.where('issueId').equals(id).filter((e) => isCurrent(e) && e.auto).toArray();
    for (const entry of automatic) await w.remove('entries', entry.id);
    await w.removeWhere('photos', 'issueId', id);
    return w.at;
  });
}

/**
 * Undoes deleteIssue.
 * @param {string} id
 * @param {string} deletedAt
 */
export async function restoreIssue(id, deletedAt) {
  await write('restoreIssue', ['issues', 'entries', 'photos'], async (w) => {
    await w.restoreWhere('issues', 'id', id, deletedAt);
    await w.restoreWhere('entries', 'issueId', id, deletedAt);
    await w.restoreWhere('photos', 'issueId', id, deletedAt);
  });
}
