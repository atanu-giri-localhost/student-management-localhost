import { z } from 'zod';
import { isValidCalendarDate } from '@/lib/dates/format';
import { jsonError } from '@/lib/http/response';

/**
 * Shared Zod validation schemas and request parsing helpers for `/api/v1/*`.
 */

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const INDIAN_LOCAL_10_PATTERN = /^[6-9]\d{9}$/;
const INDIAN_91_12_PATTERN = /^91[6-9]\d{9}$/;

/** RFC 4122 UUID v4 schema. */
export const uuidSchema = z.string().uuid('Must be a valid UUID.');

/** ISO-8601 calendar date schema (`YYYY-MM-DD`) with real calendar bounds check. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format.')
  .refine((value) => isValidCalendarDate(value), {
    message: 'Date is not a valid calendar date.',
  });

/** UTC ISO-8601 timestamp schema. */
export const isoTimestampSchema = z.string().datetime({
  offset: true,
  message: 'Timestamp must be a valid ISO-8601 datetime string.',
});

/**
 * Normalize phone input into E.164 format (defaulting 10-digit Indian mobile numbers to `+91`).
 *
 * @param {string} rawPhone
 * @returns {string}
 */
export function normalizePhoneToE164(rawPhone) {
  if (typeof rawPhone !== 'string') {
    throw new TypeError('Phone number must be a string.');
  }
  const stripped = rawPhone.trim().replace(/[\s\-()]/g, '');

  if (INDIAN_LOCAL_10_PATTERN.test(stripped)) {
    return `+91${stripped}`;
  }
  if (INDIAN_91_12_PATTERN.test(stripped)) {
    return `+${stripped}`;
  }
  if (E164_PATTERN.test(stripped)) {
    return stripped;
  }

  throw new RangeError('Invalid phone number. Expected E.164 (+91...) or 10-digit mobile number.');
}

/** Zod schema validating and normalizing phone numbers to E.164 (`+91...`). */
export const e164PhoneSchema = z
  .string()
  .trim()
  .min(10, 'Phone number is too short.')
  .max(20, 'Phone number is too long.')
  .transform((value, ctx) => {
    try {
      return normalizePhoneToE164(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'Invalid phone number.',
      });
      return z.NEVER;
    }
  });

/** Standard pagination query parameters (`page`, `pageSize`). */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Create a trimmed non-empty string schema bounded by `maxLength`.
 *
 * @param {number} [maxLength=255]
 * @param {string} [fieldName='Field']
 */
export function nonEmptyTrimmedString(maxLength = 255, fieldName = 'Field') {
  return z
    .string()
    .trim()
    .min(1, `${fieldName} is required.`)
    .max(maxLength, `${fieldName} must be at most ${maxLength} characters.`);
}

/**
 * Format Zod validation issues into client-safe `{ field, message }[]` details.
 *
 * @param {import('zod').ZodError} zodError
 * @returns {{ field: string, message: string }[]}
 */
export function formatZodIssues(zodError) {
  return zodError.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'body',
    message: issue.message,
  }));
}

/**
 * Parse and validate a JSON request body using a Zod schema.
 *
 * @template T
 * @param {Request} request
 * @param {import('zod').ZodType<T>} schema
 * @param {string} [requestId]
 * @returns {Promise<{ ok: true, data: T } | { ok: false, response: Response }>}
 */
export async function parseJsonBody(request, schema, requestId) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError('VALIDATION_ERROR', 'Request body must be valid JSON.', {
        status: 400,
        requestId,
      }),
    };
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError('VALIDATION_ERROR', 'The request contains invalid or missing fields.', {
        status: 400,
        details: formatZodIssues(parsed.error),
        requestId,
      }),
    };
  }

  return { ok: true, data: parsed.data };
}
