import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { explainError } from './errors.js';
import { ValidationError } from './db/fields.js';
import { MissingRecordError, AutomaticEntryError } from './db/write.js';

describe('explaining errors to the user', () => {
  it('points at the field and says what is wrong with it, including the limit', () => {
    expect(explainError(new ValidationError('note', 'tooLong', 5000))).toMatchObject({
      kind: 'invalid',
      field: 'note',
      fieldMessage: expect.stringContaining('5,000'),
      actions: []
    });
    expect(explainError(new ValidationError('photos', 'tooMany', 10)).fieldMessage).toContain('10');
    const reasons = /** @type {const} */ (['required', 'invalid', 'future']);
    const messages = reasons.map((reason) => explainError(new ValidationError('field', reason)).fieldMessage);
    expect(new Set(messages).size).toBe(reasons.length);
  });

  it('offers to go back when something has been deleted', () => {
    expect(explainError(new MissingRecordError('plants', 'p1'))).toMatchObject({ kind: 'notFound', actions: ['back'] });
  });

  it('explains why an automatic entry cannot change', () => {
    expect(explainError(new AutomaticEntryError('e1'))).toMatchObject({ kind: 'readOnly', actions: [] });
  });

  it('says the device is out of space and offers a backup, even when the cause is wrapped', () => {
    const quota = new DOMException('Quota exceeded', 'QuotaExceededError');
    expect(explainError(quota)).toMatchObject({ kind: 'quota', actions: ['backup', 'retry'] });
    expect(explainError(new Dexie.AbortError('Aborted', quota)).kind).toBe('quota');
  });

  it('says when the browser will not let the app save, as in private browsing', () => {
    expect(explainError(new Dexie.MissingAPIError('IndexedDB API missing')).kind).toBe('unavailable');
    const invalidState = new DOMException('Cannot open', 'InvalidStateError');
    expect(explainError(new Dexie.OpenFailedError(invalidState)).kind).toBe('unavailable');
  });

  it('offers a reload after an update in another tab', () => {
    expect(explainError(new Dexie.DatabaseClosedError('Closed'))).toMatchObject({ kind: 'closed', actions: ['reload'] });
  });

  it('falls back to a plain message with try again and reload for anything else', () => {
    expect(explainError(new TypeError('x is undefined'))).toMatchObject({ kind: 'unknown', actions: ['retry', 'reload'] });
    expect(explainError('thrown string').kind).toBe('unknown');
    expect(explainError(undefined).kind).toBe('unknown');
  });

  it('never repeats the raw error message to the user', () => {
    const errors = [new TypeError('cannot read properties of undefined'), new Dexie.DatabaseClosedError('internal detail')];
    for (const error of errors) {
      const { title, message } = explainError(error);
      expect(title).toBeTruthy();
      expect(message).toBeTruthy();
      expect(`${title} ${message}`).not.toContain(error.message);
    }
  });
});
