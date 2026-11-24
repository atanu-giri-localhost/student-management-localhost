import { describe, expect, it } from 'vitest';
import {
  assertIntegerPaise,
  calculateOutstandingPaise,
  deriveInvoiceStatus,
  formatINR,
  nonNegativePaiseSchema,
  paiseToRupeesString,
  positivePaiseSchema,
  rupeesToPaise,
  sumPaise,
} from '@/lib/money/format';

describe('integer paise money helpers', () => {
  it('formats integer paise into Indian Rupee currency strings', () => {
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(50)).toBe('₹0.50');
    expect(formatINR(150000)).toBe('₹1,500.00');
    expect(formatINR(360000)).toBe('₹3,600.00');
    expect(formatINR(10000000)).toBe('₹1,00,000.00');
    expect(formatINR(-25050)).toBe('-₹250.50');
    expect(formatINR(null)).toBe('₹0.00');
    expect(formatINR(undefined)).toBe('₹0.00');
    expect(formatINR(Number.NaN)).toBe('₹0.00');
  });

  it('rejects non-integer numbers in formatINR and assertIntegerPaise', () => {
    expect(() => formatINR(12.5)).toThrow(RangeError);
    expect(() => assertIntegerPaise(19.99)).toThrow(RangeError);
    expect(() => assertIntegerPaise(-1)).toThrow(RangeError);
    expect(() => assertIntegerPaise(0, { allowZero: false })).toThrow(RangeError);
    expect(() => assertIntegerPaise('100')).toThrow(RangeError);
    expect(assertIntegerPaise(1500)).toBe(1500);
  });

  it('converts INR rupee strings/numbers to integer paise without float precision drift', () => {
    // Classic IEEE 754 float trap: 19.99 * 100 === 1998.9999999999998
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(rupeesToPaise('19.99')).toBe(1999);
    expect(rupeesToPaise('1,500.5')).toBe(150050);
    expect(rupeesToPaise('3600')).toBe(360000);
    expect(rupeesToPaise('0.05')).toBe(5);
    expect(paiseToRupeesString(1999)).toBe('19.99');
    expect(paiseToRupeesString(360000)).toBe('3600.00');

    expect(() => rupeesToPaise('12.345')).toThrow(RangeError);
    expect(() => rupeesToPaise('-10.00')).toThrow(RangeError);
    expect(() => rupeesToPaise('abc')).toThrow(RangeError);
  });

  it('validates Zod paise schemas strictly for integers', () => {
    expect(positivePaiseSchema.safeParse(360000).success).toBe(true);
    expect(positivePaiseSchema.safeParse(0).success).toBe(false);
    expect(positivePaiseSchema.safeParse(-100).success).toBe(false);
    expect(positivePaiseSchema.safeParse(12.5).success).toBe(false);

    expect(nonNegativePaiseSchema.safeParse(0).success).toBe(true);
    expect(nonNegativePaiseSchema.safeParse(-1).success).toBe(false);
    expect(nonNegativePaiseSchema.safeParse(1.1).success).toBe(false);
  });

  it('computes sums, outstanding balances, and invoice statuses in integer paise', () => {
    expect(sumPaise([250000, 110000])).toBe(360000);
    expect(calculateOutstandingPaise(360000, 0)).toBe(360000);
    expect(calculateOutstandingPaise(360000, 150000)).toBe(210000);
    expect(calculateOutstandingPaise(360000, 360000)).toBe(0);
    expect(() => calculateOutstandingPaise(360000, 360001)).toThrow(RangeError);

    expect(deriveInvoiceStatus(360000, 0)).toBe('UNPAID');
    expect(deriveInvoiceStatus(360000, 150000)).toBe('PARTIALLY_PAID');
    expect(deriveInvoiceStatus(360000, 360000)).toBe('PAID');
  });
});
