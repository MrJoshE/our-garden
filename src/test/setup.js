// Tests run against an in-memory IndexedDB, in UK time so that the British
// Summer Time cases in dates.test.js mean something.
import 'fake-indexeddb/auto';
import { beforeEach, vi } from 'vitest';

process.env.TZ = 'Europe/London';

// Failed writes are logged to the console on purpose. Keep test output readable.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
