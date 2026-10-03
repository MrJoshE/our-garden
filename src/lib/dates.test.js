import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDate, isFuture, localDate, today } from './dates.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('dates', () => {
  it('runs these tests in UK time', () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-60);
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0);
  });

  it('gives the local date just after midnight in British Summer Time, where toISOString gives the day before', () => {
    const justAfterMidnight = new Date(2026, 6, 2, 0, 30);
    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(localDate(justAfterMidnight)).toBe('2026-07-02');
  });

  it('gives the local date late in the evening in British Summer Time', () => {
    expect(localDate(new Date(2026, 6, 1, 23, 59, 59))).toBe('2026-07-01');
  });

  it('gives the local date in winter', () => {
    expect(localDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(localDate(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });

  it('works out today when asked, so it moves on at midnight while the app is open', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 1, 23, 59, 59));
    expect(today()).toBe('2026-07-01');
    vi.setSystemTime(new Date(2026, 6, 2, 0, 0, 1));
    expect(today()).toBe('2026-07-02');
  });

  it('accepts only real calendar dates in YYYY-MM-DD form', () => {
    expect(isDate('2026-07-01')).toBe(true);
    expect(isDate('2028-02-29')).toBe(true);
    expect(isDate('2026-02-29')).toBe(false);
    expect(isDate('2026-13-01')).toBe(false);
    expect(isDate('2026-7-1')).toBe(false);
    expect(isDate('2026-07-01T00:00:00Z')).toBe(false);
    expect(isDate(20260701)).toBe(false);
    expect(isDate(null)).toBe(false);
  });

  it('judges the future against the local date, not the UTC one', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 2, 0, 30));
    expect(isFuture('2026-07-02')).toBe(false);
    expect(isFuture('2026-07-03')).toBe(true);
    expect(isFuture('2026-07-01')).toBe(false);
  });
});
