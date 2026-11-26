import { describe, expect, it, vi } from 'vitest';
import {
  assertCanManageFinance,
  assertCanReadStudentFinance,
  assertCanReversePayment,
} from '@/modules/finance/finance.permissions';
import {
  createAdjustmentSchema,
  createFeeComponentSchema,
  createPaymentSchema,
  createReversalSchema,
  generateInvoiceSchema,
} from '@/modules/finance/finance.schemas';

const UUID_1 = '14000000-0000-4000-8000-000000000001';
const UUID_2 = '1a000000-0000-4000-8000-000000000002';
const UUID_3 = '2b000000-0000-4000-8000-000000000001';
const UUID_4 = '28000000-0000-4000-8000-000000000001';

describe('Finance Zod Schemas', () => {
  it('validates fee component creation', () => {
    const ok = createFeeComponentSchema.safeParse({
      code: 'MESS',
      name: 'Monthly Mess Fee',
      description: 'Meals',
    });
    expect(ok.success).toBe(true);

    const bad = createFeeComponentSchema.safeParse({
      code: 'HOSTEL',
      name: 'Hostel',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects non-integer paise and invalid invoice fields', () => {
    const floatAmount = generateInvoiceSchema.safeParse({
      studentId: UUID_1,
      enrollmentId: UUID_2,
      billingMonth: 5,
      billingYear: 2026,
      dueDate: '2026-05-10',
      items: [
        {
          feeComponentId: UUID_4,
          description: 'Tuition',
          amountPaise: 1250.5,
        },
      ],
    });
    expect(floatAmount.success).toBe(false);
  });

  it('validates payment and optional allocations with integer paise', () => {
    const ok = createPaymentSchema.safeParse({
      studentId: UUID_1,
      amountPaidPaise: 500000,
      paymentMethod: 'UPI',
      paymentDate: '2026-05-05',
      allocations: [{ invoiceId: UUID_3, allocatedAmountPaise: 500000 }],
    });
    expect(ok.success).toBe(true);

    const zero = createPaymentSchema.safeParse({
      studentId: UUID_1,
      amountPaidPaise: 0,
      paymentMethod: 'CASH',
      paymentDate: '2026-05-05',
    });
    expect(zero.success).toBe(false);
  });

  it('enforces signed amount_paise rules on fee_adjustments', () => {
    const validWaiver = createAdjustmentSchema.safeParse({
      studentId: UUID_1,
      enrollmentId: UUID_2,
      invoiceId: UUID_3,
      adjustmentType: 'WAIVER',
      amountPaise: -100000,
      reason: 'Merit scholarship waiver',
    });
    expect(validWaiver.success).toBe(true);

    const positiveWaiver = createAdjustmentSchema.safeParse({
      studentId: UUID_1,
      enrollmentId: UUID_2,
      invoiceId: UUID_3,
      adjustmentType: 'WAIVER',
      amountPaise: 100000,
      reason: 'Invalid positive waiver',
    });
    expect(positiveWaiver.success).toBe(false);

    const negativeFine = createAdjustmentSchema.safeParse({
      studentId: UUID_1,
      enrollmentId: UUID_2,
      invoiceId: UUID_3,
      adjustmentType: 'LATE_FINE',
      amountPaise: -5000,
      reason: 'Invalid negative fine',
    });
    expect(negativeFine.success).toBe(false);

    const validFine = createAdjustmentSchema.safeParse({
      studentId: UUID_1,
      enrollmentId: UUID_2,
      invoiceId: UUID_3,
      adjustmentType: 'LATE_FINE',
      amountPaise: 5000,
      reason: 'Late payment fine',
    });
    expect(validFine.success).toBe(true);

    const zeroCorrection = createAdjustmentSchema.safeParse({
      studentId: UUID_1,
      enrollmentId: UUID_2,
      invoiceId: UUID_3,
      adjustmentType: 'CORRECTION',
      amountPaise: 0,
      reason: 'Zero not allowed',
    });
    expect(zeroCorrection.success).toBe(false);
  });

  it('validates reversal schema', () => {
    const ok = createReversalSchema.safeParse({
      paymentId: UUID_3,
      reason: 'UPI transaction bounced',
    });
    expect(ok.success).toBe(true);
  });
});

describe('Finance RBAC & Permissions', () => {
  it('allows only SUPER_ADMIN and COACHING_ADMIN to manage finance', () => {
    expect(assertCanManageFinance({ roles: ['SUPER_ADMIN'] }, 'req_1')).toBeNull();
    expect(assertCanManageFinance({ roles: ['COACHING_ADMIN'] }, 'req_2')).toBeNull();

    const teacherRes = assertCanManageFinance({ roles: ['TEACHER'] }, 'req_3');
    expect(teacherRes?.status).toBe(403);

    const studentRes = assertCanManageFinance({ roles: ['STUDENT'] }, 'req_4');
    expect(studentRes?.status).toBe(403);

    const parentRes = assertCanManageFinance({ roles: ['PARENT'] }, 'req_5');
    expect(parentRes?.status).toBe(403);
  });

  it('allows only SUPER_ADMIN to reverse payments', () => {
    expect(assertCanReversePayment({ roles: ['SUPER_ADMIN'] }, 'req_1')).toBeNull();
    expect(assertCanReversePayment({ roles: ['COACHING_ADMIN'] }, 'req_2')?.status).toBe(403);
    expect(assertCanReversePayment({ roles: ['TEACHER'] }, 'req_3')?.status).toBe(403);
    expect(assertCanReversePayment({ roles: ['PARENT'] }, 'req_4')?.status).toBe(403);
  });

  it('enforces Student Fee Wall (403) and verifies parent-student link fail-closed', async () => {
    const studentRes = await assertCanReadStudentFinance(
      null,
      { roles: ['STUDENT'], userId: 'u1' },
      UUID_1,
      'req_1'
    );
    expect(studentRes?.status).toBe(403);

    const teacherRes = await assertCanReadStudentFinance(
      null,
      { roles: ['TEACHER'], userId: 'u2' },
      UUID_1,
      'req_2'
    );
    expect(teacherRes?.status).toBe(403);

    // Fail-closed if dbStudents is missing for PARENT
    const noDbRes = await assertCanReadStudentFinance(
      null,
      { roles: ['PARENT'], userId: 'u3', profiles: { parentProfileId: 'p1' } },
      UUID_1,
      'req_3'
    );
    expect(noDbRes?.status).toBe(403);

    // Verified parent link
    const mockDbVerified = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ ok: 1 }),
        }),
      }),
    };
    const verifiedRes = await assertCanReadStudentFinance(
      mockDbVerified,
      { roles: ['PARENT'], userId: 'u3', profiles: { parentProfileId: 'p1' } },
      UUID_1,
      'req_4'
    );
    expect(verifiedRes).toBeNull();

    // Unlinked parent
    const mockDbUnlinked = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    };
    const unlinkedRes = await assertCanReadStudentFinance(
      mockDbUnlinked,
      { roles: ['PARENT'], userId: 'u3', profiles: { parentProfileId: 'p1' } },
      UUID_1,
      'req_5'
    );
    expect(unlinkedRes?.status).toBe(403);
  });
});
