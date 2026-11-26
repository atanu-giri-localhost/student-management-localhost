import { z } from 'zod';
import { e164PhoneSchema, nonEmptyTrimmedString, uuidSchema } from '@/lib/validation/common';

export const RELATIONSHIP_TYPES = ['Father', 'Mother', 'Guardian'];
export const VERIFICATION_STATUSES = ['VERIFIED', 'PENDING'];

export const parentIdSchema = uuidSchema;

export const createParentProfileSchema = z
  .object({
    userId: uuidSchema,
    fullName: nonEmptyTrimmedString(150, 'Full name'),
    phoneNormalized: e164PhoneSchema,
    email: z.string().trim().email('Invalid email address.').max(255).nullable().optional(),
    relationshipType: z.enum(RELATIONSHIP_TYPES),
  })
  .strict();

export const updateParentProfileSchema = z
  .object({
    fullName: nonEmptyTrimmedString(150, 'Full name').optional(),
    phoneNormalized: e164PhoneSchema.optional(),
    email: z.string().trim().email('Invalid email address.').max(255).nullable().optional(),
    relationshipType: z.enum(RELATIONSHIP_TYPES).optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update.',
  });

export const linkParentStudentSchema = z
  .object({
    studentId: uuidSchema,
    isPrimary: z.boolean().default(true),
    verificationStatus: z.enum(VERIFICATION_STATUSES).default('VERIFIED'),
  })
  .strict();
