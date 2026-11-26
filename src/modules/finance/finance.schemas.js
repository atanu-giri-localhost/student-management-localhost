import { z } from 'zod';
import { nonNegativePaiseSchema, positivePaiseSchema } from '@/lib/money/format';
import {
  isoDateSchema,
  nonEmptyTrimmedString,
  paginationSchema,
  uuidSchema,
} from '@/lib/validation/common';

export const FEE_COMPONENT_CODES = ['COACHING', 'MESS', 'OTHER'];
export const INVOICE_TYPES = ['COMBINED', 'SEPARATE_COACHING', 'SEPARATE_MESS'];
export const INVOICE_STATUSES = ['PAID', 'PARTIALLY_PAID', 'UNPAID'];
export const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER'];
export const ADJUSTMENT_TYPES = ['WAIVER', 'DISCOUNT', 'LATE_FINE', 'CORRECTION'];

export const financeIdSchema = uuidSchema;

// Fee Components
export const listFeeComponentsQuerySchema = paginationSchema;

export const createFeeComponentSchema = z
  .object({
    code: z.enum(FEE_COMPONENT_CODES),
    name: nonEmptyTrimmedString(100, 'Name'),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updateFeeComponentSchema = z
  .object({
    name: nonEmptyTrimmedString(100, 'Name').optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided.' });

// Fee Structures
export const listFeeStructuresQuerySchema = paginationSchema.extend({
  academicSessionId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
});

export const createFeeStructureSchema = z
  .object({
    academicSessionId: uuidSchema,
    classId: uuidSchema,
    feeComponentId: uuidSchema,
    defaultAmountPaise: nonNegativePaiseSchema,
    effectiveFrom: isoDateSchema.optional(),
  })
  .strict();

export const updateFeeStructureSchema = z
  .object({
    defaultAmountPaise: nonNegativePaiseSchema.optional(),
    effectiveFrom: isoDateSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided.' });

// Student Fee Assignments
export const listStudentFeeAssignmentsQuerySchema = paginationSchema.extend({
  enrollmentId: uuidSchema.optional(),
});

export const createStudentFeeAssignmentSchema = z
  .object({
    enrollmentId: uuidSchema,
    feeComponentId: uuidSchema,
    customAmountPaise: nonNegativePaiseSchema,
    reason: z.string().trim().max(500).nullable().optional(),
    effectiveFrom: isoDateSchema,
  })
  .strict();

export const updateStudentFeeAssignmentSchema = z
  .object({
    customAmountPaise: nonNegativePaiseSchema.optional(),
    reason: z.string().trim().max(500).nullable().optional(),
    effectiveFrom: isoDateSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided.' });

// Invoices
export const listInvoicesQuerySchema = paginationSchema.extend({
  studentId: uuidSchema.optional(),
  enrollmentId: uuidSchema.optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  billingYear: z.coerce.number().int().min(2000).max(2100).optional(),
  billingMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export const generateInvoiceSchema = z
  .object({
    studentId: uuidSchema,
    enrollmentId: uuidSchema,
    billingMonth: z.coerce.number().int().min(1).max(12),
    billingYear: z.coerce.number().int().min(2000).max(2100),
    invoiceType: z.enum(INVOICE_TYPES).default('COMBINED'),
    dueDate: isoDateSchema,
    items: z
      .array(
        z
          .object({
            feeComponentId: uuidSchema,
            description: nonEmptyTrimmedString(255, 'Item description'),
            amountPaise: nonNegativePaiseSchema,
          })
          .strict()
      )
      .min(1)
      .max(20)
      .optional(),
  })
  .strict();

// Payments & Allocations
export const listPaymentsQuerySchema = paginationSchema.extend({
  studentId: uuidSchema.optional(),
  status: z.enum(['POSTED', 'REVERSED']).optional(),
});

export const allocationItemSchema = z
  .object({
    invoiceId: uuidSchema,
    allocatedAmountPaise: positivePaiseSchema,
  })
  .strict();

export const createPaymentSchema = z
  .object({
    studentId: uuidSchema,
    amountPaidPaise: positivePaiseSchema,
    paymentMethod: z.enum(PAYMENT_METHODS),
    transactionReference: z.string().trim().max(150).nullable().optional(),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
    paymentDate: isoDateSchema,
    notes: z.string().trim().max(500).nullable().optional(),
    issueReceipt: z.boolean().default(true),
    allocations: z.array(allocationItemSchema).max(25).optional(),
  })
  .strict();

export const createAllocationSchema = z
  .object({
    paymentId: uuidSchema,
    invoiceId: uuidSchema,
    allocatedAmountPaise: positivePaiseSchema,
  })
  .strict();

export const listAllocationsQuerySchema = paginationSchema.extend({
  paymentId: uuidSchema.optional(),
  invoiceId: uuidSchema.optional(),
});

// Fee Adjustments (signed amount_paise)
export const listAdjustmentsQuerySchema = paginationSchema.extend({
  studentId: uuidSchema.optional(),
  invoiceId: uuidSchema.optional(),
  status: z.enum(['POSTED', 'VOIDED']).optional(),
});

export const createAdjustmentSchema = z
  .object({
    studentId: uuidSchema,
    enrollmentId: uuidSchema,
    invoiceId: uuidSchema,
    feeComponentId: uuidSchema.nullable().optional(),
    adjustmentType: z.enum(ADJUSTMENT_TYPES),
    amountPaise: z
      .number({ message: 'Amount must be an integer in paise.' })
      .int('Amount must be an integer in paise.')
      .refine((v) => v !== 0, 'Adjustment amount cannot be zero.'),
    reason: nonEmptyTrimmedString(500, 'Reason'),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if ((val.adjustmentType === 'WAIVER' || val.adjustmentType === 'DISCOUNT') && val.amountPaise >= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountPaise'],
        message: `${val.adjustmentType} amountPaise must be strictly negative.`,
      });
    }
    if (val.adjustmentType === 'LATE_FINE' && val.amountPaise <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['amountPaise'],
        message: 'LATE_FINE amountPaise must be strictly positive.',
      });
    }
  });

export const voidAdjustmentSchema = z
  .object({
    voidReason: nonEmptyTrimmedString(500, 'Void reason'),
  })
  .strict();

// Payment Reversals (1:1 full reversal)
export const listReversalsQuerySchema = paginationSchema.extend({
  paymentId: uuidSchema.optional(),
});

export const createReversalSchema = z
  .object({
    paymentId: uuidSchema,
    reversedAmountPaise: positivePaiseSchema.optional(),
    reason: nonEmptyTrimmedString(500, 'Reason'),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

// Receipts
export const listReceiptsQuerySchema = paginationSchema.extend({
  paymentId: uuidSchema.optional(),
  status: z.enum(['ISSUED', 'VOIDED']).optional(),
});
