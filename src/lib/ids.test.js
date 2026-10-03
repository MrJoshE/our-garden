import { describe, expect, it, vi } from 'vitest';
import { uuid } from './ids.js';
import { UUID } from '../test/helpers.js';

describe('uuid', () => {
  it('makes version 4 UUIDs', () => {
    expect(uuid()).toMatch(UUID);
    expect(uuid()).not.toBe(uuid());
  });

  it('builds one from random bytes where randomUUID is missing, as on plain http', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (/** @type {Uint8Array} */ bytes) => real.getRandomValues(bytes) });
    expect(globalThis.crypto.randomUUID).toBeUndefined();
    const ids = new Set(Array.from({ length: 100 }, uuid));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(UUID);
  });
});
