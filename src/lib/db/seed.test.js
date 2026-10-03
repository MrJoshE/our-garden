import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema.js';
import { listPlants } from './index.js';
import { loadSampleGarden } from './seed.js';
import { ENTRY_KINDS } from '../constants.js';
import { today } from '../dates.js';
import { resetDatabase, startGarden } from '../../test/helpers.js';

/** @param {string[]} values */
const tally = (values) => values.reduce((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {});

beforeEach(resetDatabase);

describe('sample garden', () => {
  it('writes plants, issues and entries in every status and kind', async () => {
    await startGarden();
    const gardenId = await loadSampleGarden();

    const plants = await listPlants(gardenId);
    expect(plants).toHaveLength(25);
    expect(tally(plants.map((plant) => plant.status))).toEqual({ growing: 20, dormant: 2, removed: 2, dead: 1 });
    expect(plants.filter((plant) => plant.needsAttention)).toHaveLength(5);

    const issues = await db.issues.where('gardenId').equals(gardenId).toArray();
    expect(tally(issues.map((issue) => issue.status))).toEqual({ open: 3, watching: 2, resolved: 3 });

    const entries = await db.entries.toArray();
    // 47 written for the sample, 8 for flagging its issues and 5 for their status changes
    expect(entries).toHaveLength(60);
    // Every issue named in the sample's entries was found, as were the automatic ones
    expect(entries.filter((entry) => entry.issueId)).toHaveLength(24);
    expect(new Set(entries.map((entry) => entry.kind))).toEqual(new Set(ENTRY_KINDS.values));
    expect(entries.every((entry) => entry.occurredOn <= today())).toBe(true);
  });
});
