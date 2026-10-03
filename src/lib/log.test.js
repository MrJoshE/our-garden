import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { db } from './db/schema.js';
import { addErrorSink, getErrorLog, logError } from './log.js';
import { createEntry, createIssue, createPlant } from './db/index.js';
import { resetDatabase, startGarden } from '../test/helpers.js';

beforeEach(resetDatabase);

describe('the error log', () => {
  it('records the error’s name, message, stack, details, causes and context', async () => {
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    const error = new Dexie.AbortError('Transaction aborted', quota);
    const record = logError(error, { operation: 'createEntry', tables: ['entries'] });
    expect(record).toMatchObject({
      name: 'AbortError',
      message: expect.stringContaining('Transaction aborted'),
      causes: [{ name: 'QuotaExceededError', message: 'The quota has been exceeded.', stack: expect.any(String) }],
      context: { operation: 'createEntry', tables: ['entries'] }
    });
    expect(record.at).toMatch(/Z$/);
    expect(await getErrorLog()).toEqual([record]);
  });

  it('keeps the stack where the error has one', () => {
    // Dexie only gives its own errors a stack in debug mode, so for those the
    // stack is on the wrapped browser error in causes.
    expect(logError(new Error('plain')).stack).toEqual(expect.any(String));
  });

  it('copies simple details off the error, such as the field that failed', () => {
    const record = logError(Object.assign(new Error('bad'), { field: 'note', reason: 'tooLong', limit: 5000, blob: new Blob([]) }));
    expect(record.details).toEqual({ field: 'note', reason: 'tooLong', limit: 5000 });
  });

  it('keeps the last 50 records on the device', async () => {
    for (let i = 0; i < 55; i += 1) logError(new Error(`error ${i}`));
    const log = await getErrorLog();
    expect(log).toHaveLength(50);
    expect(log[0].message).toBe('error 5');
    expect(log.at(-1)?.message).toBe('error 54');
  });

  it('records an error once, however many handlers pass it on', async () => {
    const error = new Error('once');
    const first = logError(error, { operation: 'inner' });
    expect(logError(error, { operation: 'outer' })).toBe(first);
    expect(await getErrorLog()).toHaveLength(1);
  });

  it('records things thrown that are not errors', () => {
    expect(logError('just a string')).toMatchObject({ name: 'string', message: 'just a string', stack: null });
  });

  it('passes each record to sinks, and carries on if a sink fails', async () => {
    const sink = vi.fn();
    const removeBroken = addErrorSink(() => {
      throw new Error('sink down');
    });
    const remove = addErrorSink(sink);
    const record = logError(new Error('to send'));
    expect(sink).toHaveBeenCalledWith(record);
    expect(await getErrorLog()).toEqual([record]);
    remove();
    removeBroken();
    logError(new Error('not sent'));
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('never throws, even when it cannot save', async () => {
    db.close();
    try {
      expect(logError(new Error('no database')).message).toBe('no database');
      await getErrorLog().catch(() => {});
    } finally {
      await db.open();
    }
  });

  it('keeps journal content out of the log', async () => {
    const { gardenId, plantId } = await startGarden();
    const rose = await createPlant(gardenId, { commonName: 'Rose' });
    const otherIssue = await createIssue(rose, { title: 'Black spot' });
    const secret = 'Private note about the neighbours';
    await createEntry(plantId, { note: secret, issueId: otherIssue }).catch(() => {});
    await createEntry(plantId, { note: `${secret} ${'x'.repeat(5000)}` }).catch(() => {});
    const log = await getErrorLog();
    expect(log.map((r) => r.context.operation)).toEqual(['createEntry', 'createEntry']);
    expect(log.map((r) => r.details.field)).toEqual(['issueId', 'note']);
    expect(JSON.stringify(log)).not.toContain('neighbours');
  });
});
