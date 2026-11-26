import { z } from 'zod';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';

export const AUDIT_OUTBOX_DOMAINS = Object.freeze([
  D1_BINDINGS.IDENTITY,
  D1_BINDINGS.STUDENTS,
  D1_BINDINGS.ATTENDANCE,
  D1_BINDINGS.FINANCE,
]);

export const reconcileAuditSchema = z
  .object({
    domains: z
      .array(
        z.enum([
          D1_BINDINGS.IDENTITY,
          D1_BINDINGS.STUDENTS,
          D1_BINDINGS.ATTENDANCE,
          D1_BINDINGS.FINANCE,
        ])
      )
      .min(1)
      .max(4)
      .optional(),
    batchSize: z.coerce.number().int().min(1).max(50).default(25),
    maxAttempts: z.coerce.number().int().min(1).max(20).default(5),
  })
  .strict();
