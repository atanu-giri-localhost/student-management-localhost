import { z } from 'zod';
import {
  isoDateSchema,
  nonEmptyTrimmedString,
  paginationSchema,
  uuidSchema,
} from '@/lib/validation/common';

export const academicSessionIdSchema = uuidSchema;
export const classIdSchema = uuidSchema;
export const subjectIdSchema = uuidSchema;

const optionalBooleanQuerySchema = z
  .enum(['true', 'false', '1', '0'])
  .transform((val) => val === 'true' || val === '1')
  .optional();

export const listAcademicSessionsQuerySchema = paginationSchema.extend({
  isActive: optionalBooleanQuerySchema,
});

export const createAcademicSessionSchema = z
  .object({
    name: nonEmptyTrimmedString(100, 'Session name'),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    isActive: z.boolean().optional().default(false),
  })
  .strict()
  .refine((val) => val.endDate >= val.startDate, {
    message: 'End date must be on or after start date.',
    path: ['endDate'],
  });

export const updateAcademicSessionSchema = z
  .object({
    name: nonEmptyTrimmedString(100, 'Session name').optional(),
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  })
  .refine((val) => !val.startDate || !val.endDate || val.endDate >= val.startDate, {
    message: 'End date must be on or after start date.',
    path: ['endDate'],
  });

export const listClassesQuerySchema = paginationSchema.extend({
  gradeLevel: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
});

const nullableSectionSchema = z
  .string()
  .trim()
  .max(50, 'Section must be at most 50 characters.')
  .nullable()
  .optional()
  .transform((val) => (val === '' || val === undefined ? null : val));

export const createClassSchema = z
  .object({
    name: nonEmptyTrimmedString(100, 'Class name'),
    gradeLevel: z.coerce.number().int().min(1, 'Grade level must be at least 1.').max(100),
    section: nullableSectionSchema,
  })
  .strict();

export const updateClassSchema = z
  .object({
    name: nonEmptyTrimmedString(100, 'Class name').optional(),
    gradeLevel: z.coerce.number().int().min(1, 'Grade level must be at least 1.').max(100).optional(),
    section: z
      .string()
      .trim()
      .max(50, 'Section must be at most 50 characters.')
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val)),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const listClassSubjectsQuerySchema = z.object({
  academicSessionId: uuidSchema.optional(),
});

export const assignClassSubjectSchema = z
  .object({
    academicSessionId: uuidSchema,
    subjectId: uuidSchema,
  })
  .strict();

export const deleteClassSubjectQuerySchema = z.object({
  academicSessionId: uuidSchema,
});

export const listSubjectsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
});

export const createSubjectSchema = z
  .object({
    name: nonEmptyTrimmedString(120, 'Subject name'),
    code: nonEmptyTrimmedString(40, 'Subject code').transform((val) => val.toUpperCase()),
  })
  .strict();

export const updateSubjectSchema = z
  .object({
    name: nonEmptyTrimmedString(120, 'Subject name').optional(),
    code: nonEmptyTrimmedString(40, 'Subject code')
      .transform((val) => val.toUpperCase())
      .optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  });
