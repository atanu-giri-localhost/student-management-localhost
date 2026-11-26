import { z } from 'zod';
import {
  isoDateSchema,
  nonEmptyTrimmedString,
  paginationSchema,
  uuidSchema,
} from '@/lib/validation/common';

export const CALENDAR_DAY_TYPES = Object.freeze([
  'WORKING',
  'HOLIDAY',
  'EXAM_DAY',
  'SPECIAL_EVENT',
]);

const TIME_HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const roomIdSchema = uuidSchema;
export const timetableSlotIdSchema = uuidSchema;
export const academicCalendarIdSchema = uuidSchema;

const optionalBooleanQuerySchema = z
  .enum(['true', 'false', '1', '0'])
  .transform((val) => val === 'true' || val === '1')
  .optional();

export const timeStringSchema = z
  .string()
  .regex(TIME_HHMM_REGEX, 'Time must use 24-hour HH:MM format.');

export const dayOfWeekSchema = z.coerce
  .number()
  .int()
  .min(1, 'Day of week must be between 1 (Monday) and 7 (Sunday).')
  .max(7, 'Day of week must be between 1 (Monday) and 7 (Sunday).');

export const periodNumberSchema = z.coerce
  .number()
  .int()
  .min(1, 'Period number must be at least 1.');

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const listRoomsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100, 'Search query must be at most 100 characters.').optional(),
  isActive: optionalBooleanQuerySchema,
});

export const createRoomSchema = z
  .object({
    name: nonEmptyTrimmedString(100, 'Room name'),
    code: nonEmptyTrimmedString(30, 'Room code'),
    capacity: z.coerce
      .number()
      .int('Capacity must be a whole number.')
      .positive('Capacity must be greater than 0.')
      .nullable()
      .optional(),
    floorOrBuilding: z
      .string()
      .trim()
      .max(100, 'Floor or building must be at most 100 characters.')
      .nullable()
      .optional(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateRoomSchema = z
  .object({
    name: nonEmptyTrimmedString(100, 'Room name').optional(),
    code: nonEmptyTrimmedString(30, 'Room code').optional(),
    capacity: z.coerce
      .number()
      .int('Capacity must be a whole number.')
      .positive('Capacity must be greater than 0.')
      .nullable()
      .optional(),
    floorOrBuilding: z
      .string()
      .trim()
      .max(100, 'Floor or building must be at most 100 characters.')
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  });

// ---------------------------------------------------------------------------
// Timetable Slots
// ---------------------------------------------------------------------------

export const listTimetableSlotsQuerySchema = paginationSchema.extend({
  academicSessionId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
  teacherProfileId: uuidSchema.optional(),
  roomId: uuidSchema.optional(),
  dayOfWeek: dayOfWeekSchema.optional(),
});

export const createTimetableSlotSchema = z
  .object({
    academicSessionId: uuidSchema,
    classId: uuidSchema,
    subjectId: uuidSchema,
    teacherProfileId: uuidSchema,
    roomId: uuidSchema.nullable().optional(),
    roomName: z
      .string()
      .trim()
      .max(100, 'Room name must be at most 100 characters.')
      .nullable()
      .optional(),
    dayOfWeek: dayOfWeekSchema,
    periodNumber: periodNumberSchema,
    startTime: timeStringSchema,
    endTime: timeStringSchema,
  })
  .strict()
  .refine((val) => val.endTime > val.startTime, {
    message: 'End time must be after start time.',
    path: ['endTime'],
  });

export const updateTimetableSlotSchema = z
  .object({
    subjectId: uuidSchema.optional(),
    teacherProfileId: uuidSchema.optional(),
    roomId: uuidSchema.nullable().optional(),
    roomName: z
      .string()
      .trim()
      .max(100, 'Room name must be at most 100 characters.')
      .nullable()
      .optional(),
    dayOfWeek: dayOfWeekSchema.optional(),
    periodNumber: periodNumberSchema.optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  })
  .refine((val) => !val.startTime || !val.endTime || val.endTime > val.startTime, {
    message: 'End time must be after start time.',
    path: ['endTime'],
  });

export const classTimetableQuerySchema = z.object({
  academicSessionId: uuidSchema.optional(),
  dayOfWeek: dayOfWeekSchema.optional(),
});

export const teacherTimetableQuerySchema = z.object({
  academicSessionId: uuidSchema.optional(),
  dayOfWeek: dayOfWeekSchema.optional(),
});

export const studentTimetableQuerySchema = z.object({
  academicSessionId: uuidSchema.optional(),
  dayOfWeek: dayOfWeekSchema.optional(),
});

export const dailyTimetableQuerySchema = z.object({
  academicSessionId: uuidSchema.optional(),
  date: isoDateSchema.optional(),
  dayOfWeek: dayOfWeekSchema.optional(),
  classId: uuidSchema.optional(),
  teacherProfileId: uuidSchema.optional(),
});

// ---------------------------------------------------------------------------
// Academic Calendar
// ---------------------------------------------------------------------------

export const listAcademicCalendarQuerySchema = paginationSchema
  .extend({
    academicSessionId: uuidSchema.optional(),
    dayType: z.enum(CALENDAR_DAY_TYPES).optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
  })
  .refine((val) => !val.fromDate || !val.toDate || val.toDate >= val.fromDate, {
    message: 'toDate must be on or after fromDate.',
    path: ['toDate'],
  });

export const createAcademicCalendarEntrySchema = z
  .object({
    academicSessionId: uuidSchema,
    calendarDate: isoDateSchema,
    dayType: z.enum(CALENDAR_DAY_TYPES),
    title: nonEmptyTrimmedString(150, 'Title'),
    notes: z
      .string()
      .trim()
      .max(500, 'Notes must be at most 500 characters.')
      .nullable()
      .optional(),
  })
  .strict();

export const updateAcademicCalendarEntrySchema = z
  .object({
    calendarDate: isoDateSchema.optional(),
    dayType: z.enum(CALENDAR_DAY_TYPES).optional(),
    title: nonEmptyTrimmedString(150, 'Title').optional(),
    notes: z
      .string()
      .trim()
      .max(500, 'Notes must be at most 500 characters.')
      .nullable()
      .optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  });
