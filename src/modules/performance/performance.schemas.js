import { z } from 'zod';
import {
  isoDateSchema,
  nonEmptyTrimmedString,
  paginationSchema,
  uuidSchema,
} from '@/lib/validation/common';

export const EXAM_TYPES = Object.freeze(['UNIT_TEST', 'MONTHLY_TEST', 'HALF_YEARLY', 'FINAL']);

export const PERFORMANCE_CATEGORIES = Object.freeze([
  'CLASS_TEST',
  'HOMEWORK',
  'CLASSWORK',
  'GENERAL',
]);

export const examinationIdSchema = uuidSchema;
export const examSubjectIdSchema = uuidSchema;
export const examMarkIdSchema = uuidSchema;
export const performanceRecordIdSchema = uuidSchema;
export const gradingScaleIdSchema = uuidSchema;

const optionalBooleanQuerySchema = z
  .enum(['true', 'false', '1', '0'])
  .transform((val) => val === 'true' || val === '1')
  .optional();

// ---------------------------------------------------------------------------
// Examinations
// ---------------------------------------------------------------------------

export const listExaminationsQuerySchema = paginationSchema.extend({
  academicSessionId: uuidSchema.optional(),
  examType: z.enum(EXAM_TYPES).optional(),
  isPublished: optionalBooleanQuerySchema,
});

export const createExaminationSchema = z
  .object({
    academicSessionId: uuidSchema,
    name: nonEmptyTrimmedString(150, 'Examination name'),
    examType: z.enum(EXAM_TYPES),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    isPublished: z.boolean().optional().default(false),
  })
  .strict()
  .refine((val) => val.endDate >= val.startDate, {
    message: 'End date must be on or after start date.',
    path: ['endDate'],
  });

export const updateExaminationSchema = z
  .object({
    name: nonEmptyTrimmedString(150, 'Examination name').optional(),
    examType: z.enum(EXAM_TYPES).optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  })
  .refine((val) => !val.startDate || !val.endDate || val.endDate >= val.startDate, {
    message: 'End date must be on or after start date.',
    path: ['endDate'],
  });

// ---------------------------------------------------------------------------
// Exam Subjects
// ---------------------------------------------------------------------------

export const listExamSubjectsQuerySchema = paginationSchema.extend({
  examinationId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
});

export const createExamSubjectSchema = z
  .object({
    examinationId: uuidSchema,
    classId: uuidSchema,
    subjectId: uuidSchema,
    examDate: isoDateSchema,
    maxMarks: z.coerce.number().finite().positive('Max marks must be greater than 0.'),
    passingMarks: z.coerce.number().finite().min(0, 'Passing marks cannot be negative.'),
  })
  .strict()
  .refine((val) => val.passingMarks <= val.maxMarks, {
    message: 'Passing marks cannot exceed max marks.',
    path: ['passingMarks'],
  });

export const updateExamSubjectSchema = z
  .object({
    examDate: isoDateSchema.optional(),
    maxMarks: z.coerce.number().finite().positive('Max marks must be greater than 0.').optional(),
    passingMarks: z.coerce
      .number()
      .finite()
      .min(0, 'Passing marks cannot be negative.')
      .optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  })
  .refine(
    (val) =>
      val.maxMarks === undefined ||
      val.passingMarks === undefined ||
      val.passingMarks <= val.maxMarks,
    {
      message: 'Passing marks cannot exceed max marks.',
      path: ['passingMarks'],
    }
  );

// ---------------------------------------------------------------------------
// Exam Marks
// ---------------------------------------------------------------------------

export const listExamMarksQuerySchema = paginationSchema.extend({
  examSubjectId: uuidSchema.optional(),
  enrollmentId: uuidSchema.optional(),
});

function validateAbsentAndMarks(val, ctx) {
  if (val.isAbsent === true && val.marksObtained !== null && val.marksObtained !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'Marks obtained must be null when the student is marked absent.',
      path: ['marksObtained'],
    });
  }
  if (val.isAbsent === false && (val.marksObtained === null || val.marksObtained === undefined)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Marks obtained is required when the student is present.',
      path: ['marksObtained'],
    });
  }
}

export const recordExamMarkSchema = z
  .object({
    examSubjectId: uuidSchema,
    enrollmentId: uuidSchema,
    isAbsent: z.boolean().optional().default(false),
    marksObtained: z.coerce
      .number()
      .finite()
      .min(0, 'Marks obtained cannot be negative.')
      .nullable()
      .optional(),
    remarks: z.string().trim().max(500, 'Remarks must be at most 500 characters.').nullable().optional(),
  })
  .strict()
  .superRefine(validateAbsentAndMarks);

export const upsertExamMarkSchema = recordExamMarkSchema;

export const updateExamMarkSchema = z
  .object({
    isAbsent: z.boolean().optional(),
    marksObtained: z.coerce
      .number()
      .finite()
      .min(0, 'Marks obtained cannot be negative.')
      .nullable()
      .optional(),
    remarks: z.string().trim().max(500, 'Remarks must be at most 500 characters.').nullable().optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  })
  .superRefine((val, ctx) => {
    if (val.isAbsent !== undefined) {
      validateAbsentAndMarks(val, ctx);
    }
  });

// ---------------------------------------------------------------------------
// Performance Records (Daily class tests / homework / classwork / remarks)
// ---------------------------------------------------------------------------

export const listPerformanceRecordsQuerySchema = paginationSchema
  .extend({
    enrollmentId: uuidSchema.optional(),
    studentId: uuidSchema.optional(),
    teacherProfileId: uuidSchema.optional(),
    subjectId: uuidSchema.optional(),
    category: z.enum(PERFORMANCE_CATEGORIES).optional(),
    fromDate: isoDateSchema.optional(),
    toDate: isoDateSchema.optional(),
  })
  .refine((val) => !val.fromDate || !val.toDate || val.toDate >= val.fromDate, {
    message: 'toDate must be on or after fromDate.',
    path: ['toDate'],
  });

export const createPerformanceRecordSchema = z
  .object({
    enrollmentId: uuidSchema,
    subjectId: uuidSchema.nullable().optional(),
    evaluationDate: isoDateSchema,
    category: z.enum(PERFORMANCE_CATEGORIES),
    marksObtained: z.coerce
      .number()
      .finite()
      .min(0, 'Marks obtained cannot be negative.')
      .nullable()
      .optional(),
    maxMarks: z.coerce
      .number()
      .finite()
      .positive('Max marks must be greater than 0.')
      .nullable()
      .optional(),
    remarks: nonEmptyTrimmedString(1000, 'Remarks'),
  })
  .strict()
  .refine(
    (val) =>
      val.marksObtained === null ||
      val.marksObtained === undefined ||
      val.maxMarks === null ||
      val.maxMarks === undefined ||
      val.marksObtained <= val.maxMarks,
    {
      message: 'Marks obtained cannot exceed max marks.',
      path: ['marksObtained'],
    }
  );

// ---------------------------------------------------------------------------
// Grading Scales
// ---------------------------------------------------------------------------

export const listGradingScalesQuerySchema = paginationSchema.extend({
  academicSessionId: uuidSchema.optional(),
  name: z.string().trim().max(100).optional(),
  isActive: optionalBooleanQuerySchema,
});

export const createGradingScaleSchema = z
  .object({
    academicSessionId: uuidSchema.nullable().optional(),
    name: nonEmptyTrimmedString(100, 'Grading scale name'),
    gradeLabel: nonEmptyTrimmedString(20, 'Grade label'),
    minPercentage: z.coerce.number().finite().min(0).max(100),
    maxPercentage: z.coerce.number().finite().min(0).max(100),
    gradePoint: z.coerce.number().finite().min(0).nullable().optional(),
    isPassing: z.boolean().optional().default(true),
    effectiveFrom: isoDateSchema,
    isActive: z.boolean().optional().default(true),
  })
  .strict()
  .refine((val) => val.minPercentage <= val.maxPercentage, {
    message: 'Minimum percentage must be less than or equal to maximum percentage.',
    path: ['maxPercentage'],
  });

export const updateGradingScaleSchema = z
  .object({
    academicSessionId: uuidSchema.nullable().optional(),
    name: nonEmptyTrimmedString(100, 'Grading scale name').optional(),
    gradeLabel: nonEmptyTrimmedString(20, 'Grade label').optional(),
    minPercentage: z.coerce.number().finite().min(0).max(100).optional(),
    maxPercentage: z.coerce.number().finite().min(0).max(100).optional(),
    gradePoint: z.coerce.number().finite().min(0).nullable().optional(),
    isPassing: z.boolean().optional(),
    effectiveFrom: isoDateSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  })
  .refine(
    (val) =>
      val.minPercentage === undefined ||
      val.maxPercentage === undefined ||
      val.minPercentage <= val.maxPercentage,
    {
      message: 'Minimum percentage must be less than or equal to maximum percentage.',
      path: ['maxPercentage'],
    }
  );

// ---------------------------------------------------------------------------
// Results Queries
// ---------------------------------------------------------------------------

export const studentResultsQuerySchema = z.object({
  academicSessionId: uuidSchema.optional(),
  examinationId: uuidSchema.optional(),
});

export const classResultsQuerySchema = paginationSchema.extend({
  examinationId: uuidSchema,
  classId: uuidSchema,
});
