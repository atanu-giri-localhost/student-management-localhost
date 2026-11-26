import { z } from 'zod';
import {
  isoDateSchema,
  nonEmptyTrimmedString,
  paginationSchema,
  uuidSchema,
} from '@/lib/validation/common';

export const TEACHER_EMPLOYMENT_STATUSES = ['ACTIVE', 'INACTIVE', 'LEFT'];
export const TEACHER_RESPONSIBILITY_CATEGORIES = ['REGULAR_TEACHER', 'CLASS_TEACHER'];

export const teacherIdSchema = uuidSchema;
export const teacherAssignmentIdSchema = uuidSchema;
export const classIdSchema = uuidSchema;

export const listTeachersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  employmentStatus: z.enum(TEACHER_EMPLOYMENT_STATUSES).optional(),
});

export const createTeacherSchema = z
  .object({
    userId: uuidSchema,
    employeeCode: nonEmptyTrimmedString(50, 'Employee code'),
    fullName: nonEmptyTrimmedString(150, 'Full name'),
    qualification: z.string().trim().max(200).nullable().optional(),
    specialization: z.string().trim().max(200).nullable().optional(),
    joiningDate: isoDateSchema,
    employmentStatus: z.enum(TEACHER_EMPLOYMENT_STATUSES).default('ACTIVE'),
    photoFileId: uuidSchema.nullable().optional(),
  })
  .strict();

export const updateTeacherSchema = z
  .object({
    employeeCode: nonEmptyTrimmedString(50, 'Employee code').optional(),
    fullName: nonEmptyTrimmedString(150, 'Full name').optional(),
    qualification: z.string().trim().max(200).nullable().optional(),
    specialization: z.string().trim().max(200).nullable().optional(),
    joiningDate: isoDateSchema.optional(),
    employmentStatus: z.enum(TEACHER_EMPLOYMENT_STATUSES).optional(),
    photoFileId: uuidSchema.nullable().optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const listTeacherAssignmentsQuerySchema = paginationSchema.extend({
  teacherProfileId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  subjectId: uuidSchema.optional(),
  responsibilityCategory: z.enum(TEACHER_RESPONSIBILITY_CATEGORIES).optional(),
});

export const createTeacherAssignmentSchema = z
  .object({
    teacherProfileId: uuidSchema,
    academicSessionId: uuidSchema,
    classId: uuidSchema,
    subjectId: uuidSchema,
    responsibilityCategory: z.enum(TEACHER_RESPONSIBILITY_CATEGORIES),
  })
  .strict();

export const teacherRosterQuerySchema = paginationSchema.extend({
  academicSessionId: uuidSchema.optional(),
});
