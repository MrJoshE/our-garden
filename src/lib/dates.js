// Dates the user chooses are calendar dates, stored as YYYY-MM-DD built from
// the device's local date. Never use toISOString().slice(0, 10) for these:
// it gives the UTC date, which is the previous day between midnight and 1am
// during British Summer Time.

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n, width = 2) => String(n).padStart(width, '0');

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
