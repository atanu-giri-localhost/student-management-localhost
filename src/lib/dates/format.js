/**
 * UTC ISO-8601 timestamp and YYYY-MM-DD calendar date utilities.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const IST_TIMEZONE = 'Asia/Kolkata';

const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Return current UTC timestamp as an ISO-8601 string.
 *
 * @param {Date} [nowDate]
 * @returns {string}
 */
export function nowIso(nowDate = new Date()) {
  return nowDate.toISOString();
}

/**
 * Return a UTC ISO-8601 timestamp offset by `minutes` from `fromDate`.
 *
 * @param {number} minutes
 * @param {Date} [fromDate]
 * @returns {string}
 */
export function addMinutesIso(minutes, fromDate = new Date()) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    throw new RangeError('minutes must be a finite number.');
  }
  return new Date(fromDate.getTime() + minutes * 60_000).toISOString();
}

/**
 * Return a UTC ISO-8601 timestamp offset by `days` from `fromDate`.
 *
 * @param {number} days
 * @param {Date} [fromDate]
 * @returns {string}
 */
export function addDaysIso(days, fromDate = new Date()) {
  if (typeof days !== 'number' || !Number.isFinite(days)) {
    throw new RangeError('days must be a finite number.');
  }
  return new Date(fromDate.getTime() + days * 86_400_000).toISOString();
}

/**
 * Determine whether an ISO-8601 expiry timestamp has elapsed at `nowDate`.
 *
 * @param {string} expiresAtIso
 * @param {Date} [nowDate]
 * @returns {boolean}
 */
export function isExpiredIso(expiresAtIso, nowDate = new Date()) {
  const expiryMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiryMs)) {
    return true;
  }
  return expiryMs <= nowDate.getTime();
}

/**
 * Validate that a `YYYY-MM-DD` string represents a real calendar date (including leap years).
 *
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== 'string') {
    return false;
  }
  const match = ISO_DATE_PATTERN.exec(dateStr.trim());
  if (!match) {
    return false;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

/**
 * Return today's `YYYY-MM-DD` calendar date in IST (`Asia/Kolkata`) or UTC.
 *
 * @param {{ nowDate?: Date, timeZone?: string }} [options]
 * @returns {string}
 */
export function todayIsoDate(options = {}) {
  const { nowDate = new Date(), timeZone = IST_TIMEZONE } = options;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(nowDate);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Format an ISO `YYYY-MM-DD` date into a readable Indian date label (e.g., `"24 Nov 2026"`).
 *
 * @param {string | null | undefined} dateStr
 * @returns {string}
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr || !isValidCalendarDate(dateStr)) {
    return '—';
  }
  const [year, month, day] = dateStr.split('-').map((part) => Number.parseInt(part, 10));
  return DISPLAY_DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
}
