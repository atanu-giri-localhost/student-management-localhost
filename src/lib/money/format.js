import { z } from 'zod';

/**
 * Integer paise validation, arithmetic, and INR formatting helpers.
 * All monetary amounts are represented strictly as integer paise (1 INR = 100 paise).
 * Floating-point money arithmetic is forbidden.
 */

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const RUPEE_INPUT_REGEX = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

/** Zod schema for non-negative integer paise amounts (allows 0). */
export const nonNegativePaiseSchema = z
  .number({ message: 'Amount must be an integer in paise.' })
  .int('Amount must be an integer in paise.')
  .min(0, 'Amount cannot be negative.')
  .max(Number.MAX_SAFE_INTEGER, 'Amount exceeds safe integer range.');

/** Zod schema for strictly positive integer paise amounts (> 0). */
export const positivePaiseSchema = z
  .number({ message: 'Amount must be a positive integer in paise.' })
  .int('Amount must be a positive integer in paise.')
  .min(1, 'Amount must be greater than zero.')
  .max(Number.MAX_SAFE_INTEGER, 'Amount exceeds safe integer range.');

/**
 * Validate that a value is a safe integer in paise.
 *
 * @param {unknown} value
 * @param {{ allowNegative?: boolean, allowZero?: boolean, label?: string }} [options]
 * @returns {number}
 */
export function assertIntegerPaise(value, options = {}) {
  const { allowNegative = false, allowZero = true, label = 'amountPaise' } = options;

  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer in paise.`);
  }
  if (!allowNegative && value < 0) {
    throw new RangeError(`${label} cannot be negative.`);
  }
  if (!allowZero && value === 0) {
    throw new RangeError(`${label} must be non-zero.`);
  }
  return value;
}

/**
 * Format an integer paise amount as Indian Rupees (e.g. 150000 -> "₹1,500.00").
 * Returns "₹0.00" when given null, undefined, or NaN; throws RangeError on non-integer numbers.
 *
 * @param {number | null | undefined} amountPaise
 * @returns {string}
 */
export function formatINR(amountPaise) {
  if (amountPaise === null || amountPaise === undefined) {
    return '₹0.00';
  }
  if (typeof amountPaise !== 'number' || Number.isNaN(amountPaise)) {
    return '₹0.00';
  }
  assertIntegerPaise(amountPaise, { allowNegative: true, allowZero: true, label: 'amountPaise' });

  const isNegative = amountPaise < 0;
  const absPaise = Math.abs(amountPaise);
  const wholeRupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;
  // Format the integer rupee part via Intl, then attach the exact two-digit paise suffix
  // without floating-point division.
  const formattedWhole = INR_FORMATTER.format(wholeRupees).replace(/\.00$/, '');
  const paiseSuffix = String(remainderPaise).padStart(2, '0');
  return `${isNegative ? '-' : ''}${formattedWhole}.${paiseSuffix}`;
}

/**
 * Convert an INR rupee string or exact number (up to 2 decimal places) into integer paise
 * using exact decimal-string parsing (never floating-point multiplication).
 *
 * @param {string | number} rupeeInput
 * @param {{ allowNegative?: boolean, allowZero?: boolean }} [options]
 * @returns {number}
 */
export function rupeesToPaise(rupeeInput, options = {}) {
  const { allowNegative = false, allowZero = true } = options;

  if (typeof rupeeInput !== 'string' && typeof rupeeInput !== 'number') {
    throw new TypeError('Rupee amount must be a string or finite number.');
  }
  if (typeof rupeeInput === 'number' && !Number.isFinite(rupeeInput)) {
    throw new RangeError('Rupee amount must be finite.');
  }

  const normalized = String(rupeeInput).trim().replaceAll(',', '');
  const match = RUPEE_INPUT_REGEX.exec(normalized);
  if (!match) {
    throw new RangeError(
      'Invalid INR rupee amount. Expected up to 2 decimal places (e.g. "1500.50").'
    );
  }

  const sign = match[1] ? -1 : 1;
  const rupeesPart = Number.parseInt(match[2], 10);
  const paisePart = Number.parseInt((match[3] ?? '').padEnd(2, '0'), 10);
  const total = sign * (rupeesPart * 100 + paisePart);

  return assertIntegerPaise(total, {
    allowNegative,
    allowZero,
    label: 'rupeeInput',
  });
}

/**
 * Convert integer paise into a canonical decimal rupee string (e.g. 150050 -> "1500.50").
 *
 * @param {number} amountPaise
 * @returns {string}
 */
export function paiseToRupeesString(amountPaise) {
  assertIntegerPaise(amountPaise, { allowNegative: true, allowZero: true, label: 'amountPaise' });
  const sign = amountPaise < 0 ? '-' : '';
  const abs = Math.abs(amountPaise);
  const rupees = Math.floor(abs / 100);
  const paise = String(abs % 100).padStart(2, '0');
  return `${sign}${rupees}.${paise}`;
}

/**
 * Sum an array of integer paise amounts safely.
 *
 * @param {number[]} amounts
 * @param {{ allowNegative?: boolean }} [options]
 * @returns {number}
 */
export function sumPaise(amounts, options = {}) {
  const { allowNegative = false } = options;
  if (!Array.isArray(amounts)) {
    throw new TypeError('amounts must be an array of integer paise values.');
  }
  let total = 0;
  for (let index = 0; index < amounts.length; index++) {
    const value = assertIntegerPaise(amounts[index], {
      allowNegative,
      allowZero: true,
      label: `amounts[${index}]`,
    });
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('Sum exceeds safe integer paise range.');
    }
  }
  return total;
}

/**
 * Calculate remaining outstanding paise for an invoice and validate allocation bounds.
 *
 * @param {number} totalAmountPaise
 * @param {number} allocatedAmountPaise
 * @returns {number}
 */
export function calculateOutstandingPaise(totalAmountPaise, allocatedAmountPaise) {
  const total = assertIntegerPaise(totalAmountPaise, {
    allowNegative: false,
    allowZero: true,
    label: 'totalAmountPaise',
  });
  const allocated = assertIntegerPaise(allocatedAmountPaise, {
    allowNegative: false,
    allowZero: true,
    label: 'allocatedAmountPaise',
  });
  if (allocated > total) {
    throw new RangeError('allocatedAmountPaise cannot exceed totalAmountPaise.');
  }
  return total - allocated;
}

/**
 * Derive persisted invoice payment status from integer paise totals.
 * Note: OVERDUE is derived at query/display time when outstanding > 0 and today > due_date.
 *
 * @param {number} totalAmountPaise
 * @param {number} allocatedAmountPaise
 * @returns {'PAID' | 'PARTIALLY_PAID' | 'UNPAID'}
 */
export function deriveInvoiceStatus(totalAmountPaise, allocatedAmountPaise) {
  const outstanding = calculateOutstandingPaise(totalAmountPaise, allocatedAmountPaise);
  if (outstanding === 0 && totalAmountPaise > 0) {
    return 'PAID';
  }
  if (allocatedAmountPaise > 0) {
    return 'PARTIALLY_PAID';
  }
  return 'UNPAID';
}
