// Dates the user chooses are calendar dates, stored as YYYY-MM-DD built from
// the device's local date. Never use toISOString().slice(0, 10) for these:
// it gives the UTC date, which is the previous day between midnight and 1am
// during British Summer Time.

import { strings } from './strings.js';

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (/** @type {number} */ n, width = 2) => String(n).padStart(width, '0');

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function localDate(date = new Date()) {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Today's local date. Work it out each time it is needed, because the app
 * can stay open across midnight.
 * @returns {string}
 */
export function today() {
  return localDate(new Date());
}

/**
 * @param {unknown} value
 * @returns {value is string} true for a real calendar date in YYYY-MM-DD form
 */
export function isDate(value) {
  if (typeof value !== 'string') return false;
  const match = PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

/**
 * @param {string} ymd
 * @returns {boolean} true if the date is after today
 */
export function isFuture(ymd) {
  return ymd > today();
}

/** @param {string} ymd */
function parts(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
}

/** @param {string} ymd the date at local midnight, for formatting */
function toLocal(ymd) {
  const { year, month, day } = parts(ymd);
  return new Date(year, month - 1, day);
}

/**
 * Counted on the calendar, so a clock change in between makes no difference.
 * @param {string} ymd
 * @param {string} [now] today's date, passed in by a page that redraws at midnight
 * @returns {number} whole days from that date to today: 0 for today, 1 for yesterday
 */
export function daysSince(ymd, now = today()) {
  const utc = (/** @type {string} */ value) => {
    const { year, month, day } = parts(value);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(now) - utc(ymd)) / 86_400_000);
}

const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const dayAndMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' });
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

/**
 * @param {string} ymd
 * @returns {string} such as "14 March 2024"
 */
export function formatDate(ymd) {
  return longDate.format(toLocal(ymd));
}

/**
 * The name of a day in the journal: "Today", "Yesterday", then the day,
 * such as "Saturday 26 September", with the year when it is not this year.
 * @param {string} ymd
 * @param {string} [now] today's date, passed in by a page that redraws at midnight
 */
export function dayName(ymd, now = today()) {
  const days = daysSince(ymd, now);
  if (days === 0) return strings.dates.today;
  if (days === 1) return strings.dates.yesterday;
  // Put together by hand: the locale adds a comma after the weekday only when the year is shown
  const date = toLocal(ymd);
  const rest = parts(ymd).year === parts(now).year ? dayAndMonth : longDate;
  return `${weekday.format(date)} ${rest.format(date)}`;
}
