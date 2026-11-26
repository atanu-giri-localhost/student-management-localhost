import { z } from 'zod';
import {
  e164PhoneSchema,
  isoDateSchema,
  nonEmptyTrimmedString,
  paginationSchema,
  uuidSchema,
} from '@/lib/validation/common';

export const STUDENT_LIFECYCLE_STATUSES = ['ACTIVE', 'INACTIVE', 'ALUMNI', 'LEFT'];
export const STUDENT_GENDERS = ['Male', 'Female', 'Other'];

export const studentIdSchema = uuidSchema;

export const listStudentsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  lifecycleStatus: z.enum(STUDENT_LIFECYCLE_STATUSES).optional(),
});

export const createStudentSchema = z
  .object({
    userId: uuidSchema.nullable().optional(),
    admissionNumber: nonEmptyTrimmedString(50, 'Admission number'),
    fullName: nonEmptyTrimmedString(150, 'Full name'),
    dateOfBirth: isoDateSchema,
    gender: z.enum(STUDENT_GENDERS),
    bloodGroup: z.string().trim().max(10).nullable().optional(),
    photoFileId: uuidSchema.nullable().optional(),
    contactPhone: e164PhoneSchema.nullable().optional(),
    residentialAddress: z.string().trim().max(500).nullable().optional(),
    emergencyContactName: nonEmptyTrimmedString(150, 'Emergency contact name'),
    emergencyContactPhone: e164PhoneSchema,
    lifecycleStatus: z.enum(STUDENT_LIFECYCLE_STATUSES).default('ACTIVE'),
    admissionDate: isoDateSchema,
  })
  .strict();

export const updateStudentSchema = z
  .object({
    fullName: nonEmptyTrimmedString(150, 'Full name').optional(),
    dateOfBirth: isoDateSchema.optional(),
    gender: z.enum(STUDENT_GENDERS).optional(),
    bloodGroup: z.string().trim().max(10).nullable().optional(),
    photoFileId: uuidSchema.nullable().optional(),
    contactPhone: e164PhoneSchema.nullable().optional(),
    residentialAddress: z.string().trim().max(500).nullable().optional(),
    emergencyContactName: nonEmptyTrimmedString(150, 'Emergency contact name').optional(),
    emergencyContactPhone: e164PhoneSchema.optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const studentLifecycleSchema = z
  .object({
    lifecycleStatus: z.enum(STUDENT_LIFECYCLE_STATUSES),
  })
  .strict();
