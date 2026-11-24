import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  addMinutesIso,
  formatDisplayDate,
  isExpiredIso,
  isValidCalendarDate,
  todayIsoDate,
} from '@/lib/dates/format';
import {
  e164PhoneSchema,
  isoDateSchema,
  normalizePhoneToE164,
  paginationSchema,
  parseJsonBody,
  uuidSchema,
} from '@/lib/validation/common';
import { getNavItemsForRole } from '@/components/layout/nav-config';
import { z } from 'zod';

describe('Date and timestamp utilities', () => {
  it('validates real calendar dates including leap years', () => {
    expect(isValidCalendarDate('2026-11-24')).toBe(true);
    expect(isValidCalendarDate('2024-02-29')).toBe(true);
    expect(isValidCalendarDate('2026-02-29')).toBe(false);
    expect(isValidCalendarDate('2026-04-31')).toBe(false);
    expect(isValidCalendarDate('24-11-2026')).toBe(false);
  });

  it('computes ISO expirations and formats calendar dates cleanly', () => {
    const base = new Date('2026-11-24T12:00:00.000Z');
    const fiveMinLater = addMinutesIso(5, base);
    const sevenDaysLater = addDaysIso(7, base);

    expect(fiveMinLater).toBe('2026-11-24T12:05:00.000Z');
    expect(sevenDaysLater).toBe('2026-12-01T12:00:00.000Z');
    expect(isExpiredIso(fiveMinLater, new Date('2026-11-24T12:04:59.000Z'))).toBe(false);
    expect(isExpiredIso(fiveMinLater, new Date('2026-11-24T12:05:00.000Z'))).toBe(true);
    expect(isExpiredIso('not-a-date', base)).toBe(true);
    expect(todayIsoDate({ nowDate: new Date('2026-11-24T20:00:00.000Z') })).toBe('2026-11-25');
    expect(formatDisplayDate('2026-11-24')).toBe('24 Nov 2026');
    expect(formatDisplayDate('invalid')).toBe('—');
  });
});

describe('Common Zod validation and phone normalization', () => {
  it('normalizes 10-digit Indian mobile numbers and E.164 values', () => {
    expect(normalizePhoneToE164('98765 43210')).toBe('+919876543210');
    expect(normalizePhoneToE164('919876543210')).toBe('+919876543210');
    expect(normalizePhoneToE164('+91-98765-43210')).toBe('+919876543210');
    expect(e164PhoneSchema.parse('9876543210')).toBe('+919876543210');
    expect(() => normalizePhoneToE164('12345')).toThrow(RangeError);
    expect(e164PhoneSchema.safeParse('12345').success).toBe(false);
  });

  it('validates UUID, calendar date, and pagination schemas', () => {
    expect(uuidSchema.safeParse('10000000-0000-4000-8000-000000000001').success).toBe(true);
    expect(uuidSchema.safeParse('bad-uuid').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-02-29').success).toBe(false);
    expect(isoDateSchema.safeParse('2026-11-24').success).toBe(true);
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(paginationSchema.safeParse({ page: 0, pageSize: 200 }).success).toBe(false);
  });

  it('parses and formats invalid JSON or Zod errors cleanly via parseJsonBody', async () => {
    const schema = z.object({ name: z.string().min(2) });

    const badJsonReq = new Request('http://localhost/api/v1/test', {
      method: 'POST',
      body: '{invalid',
    });
    const badJsonResult = await parseJsonBody(badJsonReq, schema, 'req_bad_json');
    expect(badJsonResult.ok).toBe(false);
    expect(badJsonResult.response.status).toBe(400);

    const invalidFieldReq = new Request('http://localhost/api/v1/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'A' }),
    });
    const invalidFieldResult = await parseJsonBody(invalidFieldReq, schema, 'req_bad_field');
    expect(invalidFieldResult.ok).toBe(false);
    const body = await invalidFieldResult.response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details[0].field).toBe('name');
  });

  it('excludes all fee/finance links from Student portal navigation config', () => {
    const studentNav = getNavItemsForRole('STUDENT');
    expect(studentNav.length).toBeGreaterThan(0);
    expect(studentNav.some((item) => /fee|finance|invoice|payment/i.test(item.href + item.label))).toBe(false);
  });
});
