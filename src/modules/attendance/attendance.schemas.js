import { z } from 'zod';
import {
  isoDateSchema,
  nonEmptyTrimmedString,
  paginationSchema,
  uuidSchema,
} from '@/lib/validation/common';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
export const REGISTER_TYPES = ['DAILY', 'PERIOD'];

export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);
export const registerTypeSchema = z.enum(REGISTER_TYPES);
export const registerIdSchema = uuidSchema;
export const recordIdSchema = uuidSchema;

const optionalBooleanQuerySchema = z
  .enum(['true', 'false', '1', '0'])
  .transform((val) => val === 'true' || val === '1')
  .optional();

const nullableRemarksSchema = z
  .string()
  .trim()
  .max(500, 'Remarks must be at most 500 characters.')
  .nullable()
  .optional()
  .transform((val) => (val === '' || val === undefined ? null : val));

function hasValidDateRange(val) {
  return !val.fromDate || !val.toDate || val.toDate >= val.fromDate;
}

const DATE_RANGE_ERROR = {
  message: 'toDate must be on or after fromDate.',
  path: ['toDate'],
};

/**
 * Single student attendance record entry in a mark/update payload.
 */
export const attendanceRecordInputSchema = z
  .object({
    enrollmentId: uuidSchema,
    status: attendanceStatusSchema,
    remarks: nullableRemarksSchema,
  })
  .strict();

function validateUniqueEnrollments(records, ctx) {
  const seen = new Set();
  for (let i = 0; i < records.length; i += 1) {
    const id = records[i].enrollmentId;
    if (seen.has(id)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate enrollmentId in attendance records payload.',
        path: ['records', i, 'enrollmentId'],
      });
    }
    seen.add(id);
  }
}

export const createDailyRegisterSchema = z
  .object({
    academicSessionId: uuidSchema,
    classId: uuidSchema,
    attendanceDate: isoDateSchema,
    markedByTeacherId: uuidSchema.nullable().optional(),
    isLocked: z.boolean().optional().default(false),
  })
  .strict();

export const getDailyRegisterByScopeQuerySchema = z.object({
  academicSessionId: uuidSchema,
  classId: uuidSchema,
  attendanceDate: isoDateSchema,
});

export const listDailyRegistersQuerySchema = paginationSchema
  .extend({
    academicSessionId: uuidSchema.optional(),
    classId: uuidSchema.optional(),
    attendanceDate: isoDateSchema.optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
    isLocked: optionalBooleanQuerySchema,
  })
  .refine(hasValidDateRange, DATE_RANGE_ERROR);

export const markDailyAttendanceRecordsSchema = z
  .object({
    records: z
      .array(attendanceRecordInputSchema)
      .min(1, 'At least one attendance record is required.')
      .max(100, 'Cannot submit more than 100 attendance records per request.'),
  })
  .strict()
  .superRefine((val, ctx) => {
    validateUniqueEnrollments(val.records, ctx);
  });

export const createPeriodRegisterSchema = z
  .object({
    academicSessionId: uuidSchema,
    classId: uuidSchema,
    subjectId: uuidSchema,
    attendanceDate: isoDateSchema,
    periodNumber: z.coerce
      .number()
      .int()
      .min(1, 'Period number must be at least 1.')
      .max(24, 'Period number must be at most 24.'),
    markedByTeacherId: uuidSchema.nullable().optional(),
    isLocked: z.boolean().optional().default(false),
  })
  .strict();

export const listPeriodRegistersQuerySchema = paginationSchema
  .extend({
    academicSessionId: uuidSchema.optional(),
    classId: uuidSchema.optional(),
    subjectId: uuidSchema.optional(),
    attendanceDate: isoDateSchema.optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
    periodNumber: z.coerce.number().int().min(1).max(24).optional(),
    isLocked: optionalBooleanQuerySchema,
  })
  .refine(hasValidDateRange, DATE_RANGE_ERROR);

export const markPeriodAttendanceRecordsSchema = z
  .object({
    records: z
      .array(attendanceRecordInputSchema)
      .min(1, 'At least one attendance record is required.')
      .max(100, 'Cannot submit more than 100 attendance records per request.'),
  })
  .strict()
  .superRefine((val, ctx) => {
    validateUniqueEnrollments(val.records, ctx);
  });

export const createAttendanceCorrectionSchema = z
  .object({
    registerType: registerTypeSchema,
    registerId: uuidSchema,
    recordId: uuidSchema,
    newStatus: attendanceStatusSchema,
    reason: nonEmptyTrimmedString(500, 'Correction reason'),
  })
  .strict();

export const listAttendanceCorrectionsQuerySchema = paginationSchema.extend({
  registerType: registerTypeSchema.optional(),
  registerId: uuidSchema.optional(),
  recordId: uuidSchema.optional(),
  enrollmentId: uuidSchema.optional(),
});

export const studentAttendanceQuerySchema = paginationSchema
  .extend({
    academicSessionId: uuidSchema.optional(),
    registerType: registerTypeSchema.default('DAILY'),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
  })
  .refine(hasValidDateRange, DATE_RANGE_ERROR);

export const attendanceSummaryQuerySchema = paginationSchema
  .extend({
    academicSessionId: uuidSchema,
    classId: uuidSchema.optional(),
    subjectId: uuidSchema.optional(),
    registerType: registerTypeSchema.default('DAILY'),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
  })
  .refine(hasValidDateRange, DATE_RANGE_ERROR);
