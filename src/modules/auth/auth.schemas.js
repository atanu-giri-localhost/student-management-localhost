import { z } from 'zod';
import { e164PhoneSchema, uuidSchema } from '@/lib/validation/common';

export const otpRequestSchema = z.object({
  phone: e164PhoneSchema,
});

export const otpVerifySchema = z.object({
  phone: e164PhoneSchema,
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'OTP must be a 6-digit numeric code.'),
});

export const sessionRevokeSchema = z.object({
  userId: uuidSchema,
});
