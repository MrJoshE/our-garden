// Normalising and checking values before they are written. Forms validate
// too, so they can show messages, but these checks keep bad data out of the
// database whatever calls it.

import { LIMITS } from '../constants.js';
import { isDate, isFuture } from '../dates.js';

/** @typedef {'required' | 'tooLong' | 'tooMany' | 'invalid' | 'future'} Reason */

export class ValidationError extends Error {
  /**
   * @param {string} field
   * @param {Reason} reason
   * @param {number | null} [limit] the limit broken, for tooLong and tooMany
   */
  constructor(field, reason, limit = null) {
    super(`${field} is ${reason}`);
    this.name = 'ValidationError';
    this.field = field;
    this.reason = reason;
    this.limit = limit;
  }
}

/** @typedef {(value: any, field: string) => any} Rule */

/**
 * Applies a rule to each field it covers. Fields without a rule are dropped.
 * With `partial`, only fields present in `input` are returned, for updates.
 * @param {Record<string, any>} input
 * @param {Record<string, Rule>} rules
 * @param {{ partial?: boolean }} [options]
 * @returns {Record<string, any>}
 */
export function clean(input, rules, { partial = false } = {}) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [field, rule] of Object.entries(rules)) {
    if (partial && !Object.hasOwn(input, field)) continue;
    out[field] = rule(input[field], field);
  }
  return out;
}

/**
 * @param {number} max
 * @returns {Rule} trimmed text, or null when empty
 */
const text = (max) => (value, field) => {
  if (value == null) return null;
  if (typeof value !== 'string') throw new ValidationError(field, 'invalid');
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ValidationError(field, 'tooLong', max);
  return trimmed || null;
};

/** @type {Rule} */
export const shortText = text(LIMITS.name);
/** @type {Rule} */
export const longText = text(LIMITS.note);

/**
 * @param {Rule} rule
 * @returns {Rule} the rule, but null is refused
 */
export const required = (rule) => (value, field) => {
  const result = rule(value, field);
  if (result == null) throw new ValidationError(field, 'required');
  return result;
};

/**
 * @param {{ has: (value: any) => boolean }} list
 * @param {string | null} fallback used when the value is missing
 * @returns {Rule}
 */
export const oneOf = (list, fallback) => (value, field) => {
  if (value == null || value === '') {
    if (fallback == null) return null;
    value = fallback;
  }
  if (!list.has(value)) throw new ValidationError(field, 'invalid');
  return value;
};

/** @type {Rule} an id of another record, or null */
export function ref(value, field) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new ValidationError(field, 'invalid');
  return value;
}

/**
 * @param {{ fallback?: () => string, notFuture?: boolean }} [options]
 * @returns {Rule} a YYYY-MM-DD date, or null
 */
export const date = ({ fallback, notFuture = false } = {}) => (value, field) => {
  if (value == null || value === '') {
    if (!fallback) return null;
    value = fallback();
  }
  if (!isDate(value)) throw new ValidationError(field, 'invalid');
  if (notFuture && isFuture(value)) throw new ValidationError(field, 'future');
  return value;
};

/** @type {Rule} a moment as a UTC ISO string, or null */
export function timestamp(value, field) {
  if (value == null || value === '') return null;
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) throw new ValidationError(field, 'invalid');
  return new Date(time).toISOString();
}

/**
 * @param {{ min?: number, max?: number, integer?: boolean }} [options]
 * @returns {Rule} a number, or null
 */
export const number = ({ min = -Infinity, max = Infinity, integer = false } = {}) => (value, field) => {
  // Checked before Number(), which turns a blank string into 0
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new ValidationError(field, 'invalid');
  }
  return n;
};

/** @type {Rule} trimmed tags without blanks or repeats */
export function tags(value, field) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new ValidationError(field, 'invalid');
  /** @type {string[]} */
  const out = [];
  for (const tag of value) {
    const cleaned = shortText(tag, field);
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
  }
  return out;
}
