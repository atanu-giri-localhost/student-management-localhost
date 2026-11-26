import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as voidAdjustmentRoute } from '@/app/api/v1/finance/adjustments/[id]/void/route';
import {
  GET as listAdjustmentsRoute,
  POST as createAdjustmentRoute,
} from '@/app/api/v1/finance/adjustments/route';
import {
  GET as listAllocationsRoute,
  POST as createAllocationRoute,
} from '@/app/api/v1/finance/allocations/route';
import {
  GET as getFeeComponentRoute,
  PATCH as updateFeeComponentRoute,
} from '@/app/api/v1/finance/fee-components/[id]/route';
import {
  GET as listFeeComponentsRoute,
  POST as createFeeComponentRoute,
} from '@/app/api/v1/finance/fee-components/route';
import {
  GET as listFeeStructuresRoute,
  POST as createFeeStructureRoute,
} from '@/app/api/v1/finance/fee-structures/route';
import { GET as getInvoiceRoute } from '@/app/api/v1/finance/invoices/[id]/route';
import {
  GET as listInvoicesRoute,
  POST as generateInvoiceRoute,
} from '@/app/api/v1/finance/invoices/route';
import { GET as getPaymentRoute } from '@/app/api/v1/finance/payments/[id]/route';
import {
  GET as listPaymentsRoute,
  POST as createPaymentRoute,
} from '@/app/api/v1/finance/payments/route';
import { GET as getReceiptRoute } from '@/app/api/v1/finance/receipts/[id]/route';
import {
  GET as listReversalsRoute,
  POST as createReversalRoute,
} from '@/app/api/v1/finance/reversals/route';
import {
  GET as listAssignmentsRoute,
  POST as createAssignmentRoute,
} from '@/app/api/v1/finance/student-fee-assignments/route';
import { GET as getStudentBalanceRoute } from '@/app/api/v1/finance/students/[studentId]/balance/route';
import { hashSessionToken } from '@/lib/auth/crypto';
import * as bindings from '@/lib/cloudflare/bindings';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import { createMultiD1Proxy } from '../helpers/multi-d1-proxy';

let ctx;
let testEnv;
let dbIdentity;
let dbFinance;
let workerEnvSpy;

const SUPER_ADMIN_TOKEN = 'b8_superadmin_token_123456';
const ADMIN_TOKEN = 'b8_admin_token_123456';
const TEACHER_TOKEN = 'b8_teacher_token_123456';
const STUDENT_TOKEN = 'b8_student_token_123456';
const PARENT_TOKEN = 'b8_parent_token_123456';

const SEED_SESSION_2026 = '16000000-0000-4000-8000-000000000002';
const SEED_CLASS_10 = '17000000-0000-4000-8000-000000000002';
const SEED_CLASS_11 = '17000000-0000-4000-8000-000000000003';

const SEED_STUDENT_AARAV = '14000000-0000-4000-8000-000000000001';
const SEED_STUDENT_DIYA = '14000000-0000-4000-8000-000000000002';
const SEED_STUDENT_KABIR = '14000000-0000-4000-8000-000000000003';

const SEED_ENROLLMENT_AARAV_10 = '1a000000-0000-4000-8000-000000000002';
const SEED_ENROLLMENT_DIYA_09 = '1a000000-0000-4000-8000-000000000003';

const SEED_COMP_COACHING = '28000000-0000-4000-8000-000000000001';
const SEED_COMP_MESS = '28000000-0000-4000-8000-000000000002';
const SEED_INVOICE_AARAV = '2b000000-0000-4000-8000-000000000001';
const SEED_INVOICE_DIYA = '2b000000-0000-4000-8000-000000000003';

function makeRequest(url, { method = 'GET', token = ADMIN_TOKEN, body } = {}) {
  const headers = new Headers();
  if (token) {
    headers.set('cookie', `sms_session=${token}`);
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('origin', 'http://localhost:3000');
  }
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('Phase B8 Finance Multi-D1 Integration', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
    testEnv = {
      ...ctx.env,
      SESSION_SECRET: 'integration_test_session_secret_32chars',
      ENVIRONMENT: 'test',
    };
    dbIdentity = ctx.dbs[D1_BINDINGS.IDENTITY];
    dbFinance = ctx.dbs[D1_BINDINGS.FINANCE];

    workerEnvSpy = vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(testEnv);

    const futureExpiry = new Date(Date.now() + 86_400_000).toISOString();
    const now = new Date().toISOString();
    const sessionSpecs = [
      { userId: '11000000-0000-4000-8000-000000000001', token: SUPER_ADMIN_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000002', token: ADMIN_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000003', token: TEACHER_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000005', token: STUDENT_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000006', token: PARENT_TOKEN },
    ];

    await dbIdentity.batch(
      await Promise.all(
        sessionSpecs.map(async (s) =>
          dbIdentity
            .prepare(
              `INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at)
               VALUES (?, ?, ?, '127.0.0.1', 'vitest', ?, ?)`
            )
            .bind(
              crypto.randomUUID(),
              s.userId,
              await hashSessionToken(s.token, testEnv.SESSION_SECRET),
              futureExpiry,
              now
            )
        )
      )
    );
  }, 60_000);

  afterAll(async () => {
    workerEnvSpy?.mockRestore();
    if (ctx) {
      await ctx.cleanup();
    }
  }, 30_000);

  it('supports fee components, fee structures (with DB_ACADEMICS validation), and student fee assignments', async () => {
    const listCompRes = await listFeeComponentsRoute(
      makeRequest('http://localhost:3000/api/v1/finance/fee-components')
    );
    expect(listCompRes.status).toBe(200);
    const listCompBody = await listCompRes.json();
    expect(listCompBody.data.length).toBeGreaterThanOrEqual(3);

    const SEED_COMP_OTHER = '28000000-0000-4000-8000-000000000003';

    // Duplicate component code ('OTHER' is already seeded) returns 409
    const dupCompRes = await createFeeComponentRoute(
      makeRequest('http://localhost:3000/api/v1/finance/fee-components', {
        method: 'POST',
        body: { code: 'OTHER', name: 'Lab Kit Fee', description: 'Science lab materials' },
      })
    );
    expect(dupCompRes.status).toBe(409);

    const getCompRes = await getFeeComponentRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/fee-components/${SEED_COMP_OTHER}`),
      { params: Promise.resolve({ id: SEED_COMP_OTHER }) }
    );
    expect(getCompRes.status).toBe(200);

    const patchCompRes = await updateFeeComponentRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/fee-components/${SEED_COMP_OTHER}`, {
        method: 'PATCH',
        body: { name: 'Updated Other Fee' },
      }),
      { params: Promise.resolve({ id: SEED_COMP_OTHER }) }
    );
    expect(patchCompRes.status).toBe(200);
    expect((await patchCompRes.json()).data.name).toBe('Updated Other Fee');

    // Reject nonexistent academicSessionId
    const badStructRes = await createFeeStructureRoute(
      makeRequest('http://localhost:3000/api/v1/finance/fee-structures', {
        method: 'POST',
        body: {
          academicSessionId: '99999999-0000-4000-8000-000000000001',
          classId: SEED_CLASS_10,
          feeComponentId: SEED_COMP_OTHER,
          defaultAmountPaise: 150000,
        },
      })
    );
    expect(badStructRes.status).toBe(400);

    const goodStructRes = await createFeeStructureRoute(
      makeRequest('http://localhost:3000/api/v1/finance/fee-structures', {
        method: 'POST',
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_11,
          feeComponentId: SEED_COMP_OTHER,
          defaultAmountPaise: 150000,
          effectiveFrom: '2026-04-01',
        },
      })
    );
    expect(goodStructRes.status).toBe(201);

    const listStructRes = await listFeeStructuresRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/fee-structures?academicSessionId=${SEED_SESSION_2026}`)
    );
    expect(listStructRes.status).toBe(200);

    // Student fee assignment with DB_STUDENTS enrollment validation
    const assignRes = await createAssignmentRoute(
      makeRequest('http://localhost:3000/api/v1/finance/student-fee-assignments', {
        method: 'POST',
        body: {
          enrollmentId: SEED_ENROLLMENT_AARAV_10,
          feeComponentId: SEED_COMP_OTHER,
          customAmountPaise: 100000,
          reason: 'Sibling discount',
          effectiveFrom: '2026-04-01',
        },
      })
    );
    expect(assignRes.status).toBe(201);

    const listAssignRes = await listAssignmentsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/finance/student-fee-assignments?enrollmentId=${SEED_ENROLLMENT_AARAV_10}`
      )
    );
    expect(listAssignRes.status).toBe(200);
  });

  it('generates invoices atomically, processes payments with idempotency replay, allocations, and over-allocation rejection', async () => {
    // Generate new invoice for Diya (month 6, year 2026)
    const invRes = await generateInvoiceRoute(
      makeRequest('http://localhost:3000/api/v1/finance/invoices', {
        method: 'POST',
        body: {
          studentId: SEED_STUDENT_DIYA,
          enrollmentId: SEED_ENROLLMENT_DIYA_09,
          billingMonth: 6,
          billingYear: 2026,
          invoiceType: 'COMBINED',
          dueDate: '2026-06-10',
          items: [
            { feeComponentId: SEED_COMP_COACHING, description: 'Coaching June', amountPaise: 400000 },
            { feeComponentId: SEED_COMP_MESS, description: 'Mess June', amountPaise: 200000 },
          ],
        },
      })
    );
    expect(invRes.status).toBe(201);
    const invoice = (await invRes.json()).data;
    expect(invoice.totalAmountPaise).toBe(600000);
    expect(invoice.items).toHaveLength(2);
    expect(invoice.status).toBe('UNPAID');

    // Duplicate billing period + type rejected with 409
    const dupInvRes = await generateInvoiceRoute(
      makeRequest('http://localhost:3000/api/v1/finance/invoices', {
        method: 'POST',
        body: {
          studentId: SEED_STUDENT_DIYA,
          enrollmentId: SEED_ENROLLMENT_DIYA_09,
          billingMonth: 6,
          billingYear: 2026,
          invoiceType: 'COMBINED',
          dueDate: '2026-06-10',
        },
      })
    );
    expect(dupInvRes.status).toBe(409);

    // Partial payment with idempotency key
    const idemKey = `pay-diya-${crypto.randomUUID()}`;
    const payRes = await createPaymentRoute(
      makeRequest('http://localhost:3000/api/v1/finance/payments', {
        method: 'POST',
        body: {
          studentId: SEED_STUDENT_DIYA,
          amountPaidPaise: 250000,
          paymentMethod: 'UPI',
          transactionReference: 'UPI-998877',
          idempotencyKey: idemKey,
          paymentDate: '2026-06-05',
          allocations: [{ invoiceId: invoice.id, allocatedAmountPaise: 250000 }],
        },
      })
    );
    expect(payRes.status).toBe(201);
    const payBody = await payRes.json();
    expect(payBody.data.idempotentReplay).toBe(false);
    expect(payBody.data.payment.receipt.status).toBe('ISSUED');

    // Idempotent replay returns 200 with same payment without duplicating
    const replayRes = await createPaymentRoute(
      makeRequest('http://localhost:3000/api/v1/finance/payments', {
        method: 'POST',
        body: {
          studentId: SEED_STUDENT_DIYA,
          amountPaidPaise: 250000,
          paymentMethod: 'UPI',
          idempotencyKey: idemKey,
          paymentDate: '2026-06-05',
        },
      })
    );
    expect(replayRes.status).toBe(200);
    const replayBody = await replayRes.json();
    expect(replayBody.data.idempotentReplay).toBe(true);
    expect(replayBody.data.payment.id).toBe(payBody.data.payment.id);

    // Invoice is now PARTIALLY_PAID
    const invCheck = await getInvoiceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/invoices/${invoice.id}`),
      { params: Promise.resolve({ id: invoice.id }) }
    );
    expect(invCheck.status).toBe(200);
    const invCheckData = (await invCheck.json()).data;
    expect(invCheckData.status).toBe('PARTIALLY_PAID');
    expect(invCheckData.paidPaise).toBe(250000);
    expect(invCheckData.outstandingPaise).toBe(350000);

    // Over-allocation on a standalone payment should fail with 409
    const unallocatedPayRes = await createPaymentRoute(
      makeRequest('http://localhost:3000/api/v1/finance/payments', {
        method: 'POST',
        body: {
          studentId: SEED_STUDENT_DIYA,
          amountPaidPaise: 500000,
          paymentMethod: 'CASH',
          paymentDate: '2026-06-06',
        },
      })
    );
    expect(unallocatedPayRes.status).toBe(201);
    const unallocatedPayId = (await unallocatedPayRes.json()).data.payment.id;

    const overAllocRes = await createAllocationRoute(
      makeRequest('http://localhost:3000/api/v1/finance/allocations', {
        method: 'POST',
        body: {
          paymentId: unallocatedPayId,
          invoiceId: invoice.id,
          allocatedAmountPaise: 400000,
        },
      })
    );
    expect(overAllocRes.status).toBe(409);

    // Exact remaining allocation completes invoice -> PAID
    const exactAllocRes = await createAllocationRoute(
      makeRequest('http://localhost:3000/api/v1/finance/allocations', {
        method: 'POST',
        body: {
          paymentId: unallocatedPayId,
          invoiceId: invoice.id,
          allocatedAmountPaise: 350000,
        },
      })
    );
    expect(exactAllocRes.status).toBe(201);

    const paidInvCheck = await getInvoiceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/invoices/${invoice.id}`),
      { params: Promise.resolve({ id: invoice.id }) }
    );
    expect((await paidInvCheck.json()).data.status).toBe('PAID');

    const listAllocRes = await listAllocationsRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/allocations?invoiceId=${invoice.id}`)
    );
    expect(listAllocRes.status).toBe(200);
    expect((await listAllocRes.json()).data).toHaveLength(2);
  });

  it('supports signed fee adjustments, voiding, and SUPER_ADMIN-only full payment reversals with receipt voiding', async () => {
    // Apply a waiver (-100000 paise) on Diya's seeded UNPAID invoice (500000 paise)
    const adjRes = await createAdjustmentRoute(
      makeRequest('http://localhost:3000/api/v1/finance/adjustments', {
        method: 'POST',
        body: {
          studentId: SEED_STUDENT_DIYA,
          enrollmentId: SEED_ENROLLMENT_DIYA_09,
          invoiceId: SEED_INVOICE_DIYA,
          adjustmentType: 'WAIVER',
          amountPaise: -100000,
          reason: 'Financial aid waiver',
        },
      })
    );
    expect(adjRes.status).toBe(201);
    const adjData = (await adjRes.json()).data;
    expect(adjData.amountPaise).toBe(-100000);

    // Invoice adjusted total should be 210000 paise (310000 - 100000)
    const invAfterAdj = await getInvoiceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/invoices/${SEED_INVOICE_DIYA}`),
      { params: Promise.resolve({ id: SEED_INVOICE_DIYA }) }
    );
    const invAfterAdjData = (await invAfterAdj.json()).data;
    expect(invAfterAdjData.netPayablePaise).toBe(210000);

    // Void the adjustment -> restores adjusted total to 500000
    const voidRes = await voidAdjustmentRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/adjustments/${adjData.id}/void`, {
        method: 'POST',
        body: { voidReason: 'Entered on wrong month' },
      }),
      { params: Promise.resolve({ id: adjData.id }) }
    );
    expect(voidRes.status).toBe(200);
    expect((await voidRes.json()).data.status).toBe('VOIDED');

    const listAdjRes = await listAdjustmentsRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/adjustments?invoiceId=${SEED_INVOICE_DIYA}`)
    );
    expect(listAdjRes.status).toBe(200);

    // Pay Kabir's remaining balance on a fresh payment and test SUPER_ADMIN-only reversal
    const kabirInvRes = await getInvoiceRoute(
      makeRequest('http://localhost:3000/api/v1/finance/invoices/2b000000-0000-4000-8000-000000000002'),
      { params: Promise.resolve({ id: '2b000000-0000-4000-8000-000000000002' }) }
    );
    const kabirOutstanding = (await kabirInvRes.json()).data.outstandingPaise;
    expect(kabirOutstanding).toBeGreaterThan(0);

    const kabirPayRes = await createPaymentRoute(
      makeRequest('http://localhost:3000/api/v1/finance/payments', {
        method: 'POST',
        body: {
          studentId: SEED_STUDENT_KABIR,
          amountPaidPaise: kabirOutstanding,
          paymentMethod: 'BANK_TRANSFER',
          paymentDate: '2026-06-07',
          allocations: [
            {
              invoiceId: '2b000000-0000-4000-8000-000000000002',
              allocatedAmountPaise: kabirOutstanding,
            },
          ],
        },
      })
    );
    expect(kabirPayRes.status).toBe(201);
    const kabirPayment = (await kabirPayRes.json()).data.payment;

    // COACHING_ADMIN cannot reverse payments
    const adminRevRes = await createReversalRoute(
      makeRequest('http://localhost:3000/api/v1/finance/reversals', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          paymentId: kabirPayment.id,
          reason: 'Chargeback',
        },
      })
    );
    expect(adminRevRes.status).toBe(403);

    // Partial reversal amount rejected with 400
    const partialRevRes = await createReversalRoute(
      makeRequest('http://localhost:3000/api/v1/finance/reversals', {
        method: 'POST',
        token: SUPER_ADMIN_TOKEN,
        body: {
          paymentId: kabirPayment.id,
          reversedAmountPaise: 100000,
          reason: 'Partial not allowed',
        },
      })
    );
    expect(partialRevRes.status).toBe(400);

    // SUPER_ADMIN full reversal succeeds, voids receipt, and restores invoice status
    const revRes = await createReversalRoute(
      makeRequest('http://localhost:3000/api/v1/finance/reversals', {
        method: 'POST',
        token: SUPER_ADMIN_TOKEN,
        body: {
          paymentId: kabirPayment.id,
          reason: 'NEFT returned by bank',
        },
      })
    );
    expect(revRes.status).toBe(201);

    // Duplicate reversal blocked with 409
    const dupRevRes = await createReversalRoute(
      makeRequest('http://localhost:3000/api/v1/finance/reversals', {
        method: 'POST',
        token: SUPER_ADMIN_TOKEN,
        body: {
          paymentId: kabirPayment.id,
          reason: 'Duplicate',
        },
      })
    );
    expect(dupRevRes.status).toBe(409);

    // Receipt is VOIDED
    const receiptRes = await getReceiptRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/receipts/${kabirPayment.receipt.id}`),
      { params: Promise.resolve({ id: kabirPayment.receipt.id }) }
    );
    expect(receiptRes.status).toBe(200);
    expect((await receiptRes.json()).data.status).toBe('VOIDED');

    // Payment status is REVERSED
    const payCheckRes = await getPaymentRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/payments/${kabirPayment.id}`),
      { params: Promise.resolve({ id: kabirPayment.id }) }
    );
    expect(payCheckRes.status).toBe(200);
    expect((await payCheckRes.json()).data.status).toBe('REVERSED');

    const listRevRes = await listReversalsRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/reversals?paymentId=${kabirPayment.id}`)
    );
    expect(listRevRes.status).toBe(200);
    expect((await listRevRes.json()).data).toHaveLength(1);

    // Outbox events recorded in DB_FINANCE.audit_outbox
    const outboxCount = await dbFinance
      .prepare('SELECT COUNT(*) AS cnt FROM audit_outbox')
      .first();
    expect(Number(outboxCount?.cnt || 0)).toBeGreaterThan(0);
  });

  it('enforces Student Fee Wall (403), Teacher isolation (403), and Parent VERIFIED read-only access', async () => {
    // STUDENT blocked on all finance endpoints (Student Fee Wall)
    const studentBalRes = await getStudentBalanceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/students/${SEED_STUDENT_AARAV}/balance`, {
        token: STUDENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(studentBalRes.status).toBe(403);

    const studentInvRes = await listInvoicesRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/invoices?studentId=${SEED_STUDENT_AARAV}`, {
        token: STUDENT_TOKEN,
      })
    );
    expect(studentInvRes.status).toBe(403);

    // TEACHER blocked on finance endpoints
    const teacherBalRes = await getStudentBalanceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/students/${SEED_STUDENT_AARAV}/balance`, {
        token: TEACHER_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(teacherBalRes.status).toBe(403);

    // PARENT allowed read-only access for VERIFIED linked child (Aarav)
    const parentBalRes = await getStudentBalanceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/students/${SEED_STUDENT_AARAV}/balance`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(parentBalRes.status).toBe(200);
    const parentBal = (await parentBalRes.json()).data;
    expect(parentBal.studentId).toBe(SEED_STUDENT_AARAV);

    const parentInvRes = await getInvoiceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/invoices/${SEED_INVOICE_AARAV}`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ id: SEED_INVOICE_AARAV }) }
    );
    expect(parentInvRes.status).toBe(200);

    // PARENT blocked on unlinked child (Kabir)
    const parentUnlinkedBal = await getStudentBalanceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/students/${SEED_STUDENT_KABIR}/balance`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_KABIR }) }
    );
    expect(parentUnlinkedBal.status).toBe(403);

    const parentUnlinkedInv = await getInvoiceRoute(
      makeRequest('http://localhost:3000/api/v1/finance/invoices/2b000000-0000-4000-8000-000000000002', {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ id: '2b000000-0000-4000-8000-000000000002' }) }
    );
    expect(parentUnlinkedInv.status).toBe(403);

    // PARENT cannot mutate finance
    const parentPayRes = await listPaymentsRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/payments?studentId=${SEED_STUDENT_AARAV}`, {
        token: PARENT_TOKEN,
      })
    );
    expect(parentPayRes.status).toBe(200);

    const parentMutateRes = await createPaymentRoute(
      makeRequest('http://localhost:3000/api/v1/finance/payments', {
        method: 'POST',
        token: PARENT_TOKEN,
        body: {
          studentId: SEED_STUDENT_AARAV,
          amountPaidPaise: 10000,
          paymentMethod: 'UPI',
          paymentDate: '2026-06-08',
        },
      })
    );
    expect(parentMutateRes.status).toBe(403);
  });

  it('fails closed when DB_FINANCE or DB_STUDENTS binding is unavailable', async () => {
    const partialEnv = { ...testEnv, DB_FINANCE: undefined };
    workerEnvSpy.mockResolvedValueOnce(partialEnv);

    const noFinanceRes = await listFeeComponentsRoute(
      makeRequest('http://localhost:3000/api/v1/finance/fee-components')
    );
    expect(noFinanceRes.status).toBe(503);

    const partialStudentsEnv = { ...testEnv, DB_STUDENTS: undefined };
    workerEnvSpy.mockResolvedValueOnce(partialStudentsEnv);

    const noStudentsRes = await getStudentBalanceRoute(
      makeRequest(`http://localhost:3000/api/v1/finance/students/${SEED_STUDENT_AARAV}/balance`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(noStudentsRes.status).toBe(503);
  });
});
