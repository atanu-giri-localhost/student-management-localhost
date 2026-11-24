import { z } from 'zod';
import { e164PhoneSchema, paginationSchema, uuidSchema } from '@/lib/validation/common';

export const ALLOWED_ROLE_NAMES = ['SUPER_ADMIN', 'COACHING_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];

export const roleEnum = z.enum(ALLOWED_ROLE_NAMES);

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  role: roleEnum.optional(),
  isActive: z.enum(['0', '1', 'true', 'false']).optional(),
});

export const createUserSchema = z.object({
  phone: e164PhoneSchema,
  email: z.string().trim().email('Invalid email address.').max(255).optional().nullable(),
  roles: z.array(roleEnum).min(1, 'At least one role is required.').max(5),
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z
  .object({
    phone: e164PhoneSchema.optional(),
    email: z.string().trim().email('Invalid email address.').max(255).optional().nullable(),
    roles: z.array(roleEnum).min(1, 'At least one role is required.').max(5).optional(),
  })
  .refine((data) => data.phone !== undefined || data.email !== undefined || data.roles !== undefined, {
    message: 'Provide at least one field to update (phone, email, or roles).',
  });

export const userIdSchema = uuidSchema;
