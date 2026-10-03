import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, getDraft, saveDraft } from './index.js';
import { resetDatabase } from '../../test/helpers.js';

beforeEach(resetDatabase);

describe('drafts', () => {
  it('keeps what was typed under its key until it is cleared', async () => {
    expect(await getDraft('plant:g1')).toBeUndefined();
    await saveDraft('plant:g1', { commonName: 'Rosem' });
    await saveDraft('plant:g1', { commonName: 'Rosemary', location: 'Herb bed' });
    await saveDraft('plant:g2', { commonName: 'Leek' });
    expect(await getDraft('plant:g1')).toEqual({ commonName: 'Rosemary', location: 'Herb bed' });
    await clearDraft('plant:g1');
    expect(await getDraft('plant:g1')).toBeUndefined();
    expect(await getDraft('plant:g2')).toEqual({ commonName: 'Leek' });
  });
});
