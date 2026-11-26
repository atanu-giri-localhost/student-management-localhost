import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { nowIso } from '@/lib/dates/format';
import { assertIntegerPaise, deriveInvoiceStatus, sumPaise } from '@/lib/money/format';
import { createAuditOutboxStatement } from '@/modules/audit/audit.service';
import {
  createAdjustmentBatch,
  createAllocationBatch,
  createFeeComponentBatch,
  createFeeStructureBatch,
  createInvoiceBatch,
  createPaymentBatch,
  createStudentFeeAssignmentBatch,
  findAdjustmentById,
  findFeeComponentById,
  findFeeStructureById,
  findInvoiceById,
  findPaymentById,
  findPaymentByIdempotencyKey,
  findReceiptById,
  findResolvedFeeItemsForEnrollment,
  findReversalById,
  findStudentFeeAssignmentById,
  getInvoiceLedgerTotals,
  getStudentBalanceAggregate,
  listAdjustmentsPaginated,
  listAllocationsPaginated,
  listFeeComponentsPaginated,
  listFeeStructuresPaginated,
  listInvoicesPaginated,
  listPaymentsPaginated,
  listReceiptsPaginated,
  listReversalsPaginated,
  listStudentFeeAssignmentsPaginated,
  reversePaymentBatch,
  updateFeeComponentBatch,
  updateFeeStructureBatch,
  updateStudentFeeAssignmentBatch,
  voidAdjustmentBatch,
} from '@/modules/finance/finance.repository';

export class FinanceServiceError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'FinanceServiceError';
    this.code = code;
    this.status = status;
  }
}

async function validateAcademicSessionAndClass(workerEnv, academicSessionId, classId) {
  let dbAcademics;
  try {
    dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
  } catch {
    throw new FinanceServiceError('DB_UNAVAILABLE', 'Academics validation database is unavailable.', 503);
  }
  const [sessionRow, classRow] = await dbAcademics.batch([
    dbAcademics.prepare('SELECT id FROM academic_sessions WHERE id = ? LIMIT 1').bind(academicSessionId),
    dbAcademics.prepare('SELECT id FROM classes WHERE id = ? LIMIT 1').bind(classId),
  ]);
  if (!sessionRow.results?.[0]) {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Academic session does not exist.', 400);
  }
  if (!classRow.results?.[0]) {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Class does not exist.', 400);
  }
}

async function validateStudentAndEnrollment(workerEnv, studentId, enrollmentId) {
  let dbStudents;
  try {
    dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
  } catch {
    throw new FinanceServiceError('DB_UNAVAILABLE', 'Students validation database is unavailable.', 503);
  }
  const row = await dbStudents
    .prepare(
      `SELECT id, student_id, academic_session_id, class_id, enrollment_status
       FROM enrollments WHERE id = ? LIMIT 1`
    )
    .bind(enrollmentId)
    .first();
  if (!row) {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Enrollment does not exist.', 400);
  }
  if (studentId && row.student_id !== studentId) {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Enrollment does not belong to the specified student.', 400);
  }
  return {
    id: row.id,
    studentId: row.student_id,
    academicSessionId: row.academic_session_id,
    classId: row.class_id,
    enrollmentStatus: row.enrollment_status,
  };
}

async function validateStudentExists(workerEnv, studentId) {
  let dbStudents;
  try {
    dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
  } catch {
    throw new FinanceServiceError('DB_UNAVAILABLE', 'Students validation database is unavailable.', 503);
  }
  const row = await dbStudents.prepare('SELECT id FROM students WHERE id = ? LIMIT 1').bind(studentId).first();
  if (!row) {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Student does not exist.', 400);
  }
}

function deriveEffectiveInvoiceStatus(totalAmountPaise, adjustmentPaise, paidPaise) {
  const netPayable = Math.max(0, totalAmountPaise + adjustmentPaise);
  if (netPayable === 0) return 'PAID';
  const clampedPaid = Math.min(netPayable, Math.max(0, paidPaise));
  return deriveInvoiceStatus(netPayable, clampedPaid);
}

function generateDocumentNumber(prefix, dateStr) {
  const yyyymm = dateStr.slice(0, 7).replace('-', '');
  const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `${prefix}-${yyyymm}-${suffix}`;
}

// Fee Components
export async function listFeeComponentsService(dbFinance, query) {
  return await listFeeComponentsPaginated(dbFinance, {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function getFeeComponentByIdService(dbFinance, id) {
  const item = await findFeeComponentById(dbFinance, id);
  if (!item) throw new FinanceServiceError('NOT_FOUND', 'Fee component not found.', 404);
  return item;
}

export async function createFeeComponentService(dbFinance, actorSession, input, meta) {
  const id = crypto.randomUUID();
  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'FEE_COMPONENT',
    entityId: id,
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: nowIso(),
  });
  try {
    await createFeeComponentBatch(dbFinance, { component: { id, ...input }, auditStatement });
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw new FinanceServiceError('CONFLICT', 'A fee component with this code already exists.', 409);
    }
    throw err;
  }
  return await findFeeComponentById(dbFinance, id);
}

export async function updateFeeComponentService(dbFinance, actorSession, id, input, meta) {
  const existing = await getFeeComponentByIdService(dbFinance, id);
  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'FEE_COMPONENT',
    entityId: id,
    oldValues: existing,
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: nowIso(),
  });
  await updateFeeComponentBatch(dbFinance, { id, fields: input, auditStatement });
  return await findFeeComponentById(dbFinance, id);
}

// Fee Structures
export async function listFeeStructuresService(dbFinance, query) {
  return await listFeeStructuresPaginated(dbFinance, {
    academicSessionId: query.academicSessionId,
    classId: query.classId,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function getFeeStructureByIdService(dbFinance, id) {
  const item = await findFeeStructureById(dbFinance, id);
  if (!item) throw new FinanceServiceError('NOT_FOUND', 'Fee structure not found.', 404);
  return item;
}

export async function createFeeStructureService(dbFinance, workerEnv, actorSession, input, meta) {
  await validateAcademicSessionAndClass(workerEnv, input.academicSessionId, input.classId);
  await getFeeComponentByIdService(dbFinance, input.feeComponentId);
  assertIntegerPaise(input.defaultAmountPaise, { allowNegative: false, allowZero: true, label: 'defaultAmountPaise' });

  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const effectiveFrom = input.effectiveFrom || timestamp.slice(0, 10);
  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'FEE_STRUCTURE',
    entityId: id,
    newValues: { ...input, effectiveFrom },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await createFeeStructureBatch(dbFinance, {
      structure: { id, ...input, effectiveFrom },
      auditStatement,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw new FinanceServiceError('CONFLICT', 'Fee structure already exists for this session, class, and component.', 409);
    }
    throw err;
  }
  return await findFeeStructureById(dbFinance, id);
}

export async function updateFeeStructureService(dbFinance, actorSession, id, input, meta) {
  const existing = await getFeeStructureByIdService(dbFinance, id);
  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'FEE_STRUCTURE',
    entityId: id,
    oldValues: { defaultAmountPaise: existing.defaultAmountPaise, effectiveFrom: existing.effectiveFrom },
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: nowIso(),
  });
  await updateFeeStructureBatch(dbFinance, { id, fields: input, auditStatement });
  return await findFeeStructureById(dbFinance, id);
}

// Student Fee Assignments
export async function listStudentFeeAssignmentsService(dbFinance, query) {
  return await listStudentFeeAssignmentsPaginated(dbFinance, {
    enrollmentId: query.enrollmentId,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function getStudentFeeAssignmentByIdService(dbFinance, id) {
  const item = await findStudentFeeAssignmentById(dbFinance, id);
  if (!item) throw new FinanceServiceError('NOT_FOUND', 'Student fee assignment not found.', 404);
  return item;
}

export async function createStudentFeeAssignmentService(dbFinance, workerEnv, actorSession, input, meta) {
  await validateStudentAndEnrollment(workerEnv, null, input.enrollmentId);
  await getFeeComponentByIdService(dbFinance, input.feeComponentId);
  assertIntegerPaise(input.customAmountPaise, { allowNegative: false, allowZero: true, label: 'customAmountPaise' });

  const id = crypto.randomUUID();
  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'STUDENT_FEE_ASSIGNMENT',
    entityId: id,
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: nowIso(),
  });

  try {
    await createStudentFeeAssignmentBatch(dbFinance, {
      assignment: { id, ...input },
      auditStatement,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw new FinanceServiceError('CONFLICT', 'Custom fee assignment already exists for this enrollment and component.', 409);
    }
    throw err;
  }
  return await findStudentFeeAssignmentById(dbFinance, id);
}

export async function updateStudentFeeAssignmentService(dbFinance, actorSession, id, input, meta) {
  const existing = await getStudentFeeAssignmentByIdService(dbFinance, id);
  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'STUDENT_FEE_ASSIGNMENT',
    entityId: id,
    oldValues: { customAmountPaise: existing.customAmountPaise, reason: existing.reason },
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: nowIso(),
  });
  await updateStudentFeeAssignmentBatch(dbFinance, { id, fields: input, auditStatement });
  return await findStudentFeeAssignmentById(dbFinance, id);
}

// Invoices
export async function listInvoicesService(dbFinance, query) {
  return await listInvoicesPaginated(dbFinance, {
    studentId: query.studentId,
    enrollmentId: query.enrollmentId,
    status: query.status,
    billingYear: query.billingYear,
    billingMonth: query.billingMonth,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function getInvoiceByIdService(dbFinance, id) {
  const inv = await findInvoiceById(dbFinance, id);
  if (!inv) throw new FinanceServiceError('NOT_FOUND', 'Invoice not found.', 404);
  return inv;
}

export async function generateInvoiceService(dbFinance, workerEnv, actorSession, input, meta) {
  const enrollment = await validateStudentAndEnrollment(workerEnv, input.studentId, input.enrollmentId);
  if (enrollment.enrollmentStatus !== 'ACTIVE') {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Invoices can only be generated for ACTIVE enrollments.', 400);
  }

  let itemsToInsert;
  if (Array.isArray(input.items) && input.items.length > 0) {
    for (const item of input.items) {
      await getFeeComponentByIdService(dbFinance, item.feeComponentId);
      assertIntegerPaise(item.amountPaise, { allowNegative: false, allowZero: true, label: 'amountPaise' });
    }
    itemsToInsert = input.items.map((item) => ({
      id: crypto.randomUUID(),
      feeComponentId: item.feeComponentId,
      description: item.description,
      amountPaise: item.amountPaise,
    }));
  } else {
    const resolved = await findResolvedFeeItemsForEnrollment(dbFinance, {
      academicSessionId: enrollment.academicSessionId,
      classId: enrollment.classId,
      enrollmentId: enrollment.id,
      invoiceType: input.invoiceType,
    });
    if (resolved.length === 0) {
      throw new FinanceServiceError(
        'VALIDATION_ERROR',
        'No fee structures configured for this enrollment class and session.',
        400
      );
    }
    const monthStr = `${input.billingYear}-${String(input.billingMonth).padStart(2, '0')}`;
    itemsToInsert = resolved.map((r) => ({
      id: crypto.randomUUID(),
      feeComponentId: r.fee_component_id,
      description: `${r.component_name} - ${monthStr}`,
      amountPaise: Number(r.amount_paise),
    }));
  }

  const totalAmountPaise = sumPaise(itemsToInsert.map((i) => i.amountPaise));
  const status = totalAmountPaise === 0 ? 'PAID' : 'UNPAID';
  const timestamp = nowIso();
  const invoiceId = crypto.randomUUID();
  const billingDatePrefix = `${input.billingYear}-${String(input.billingMonth).padStart(2, '0')}-01`;
  const invoiceNumber = generateDocumentNumber('INV', billingDatePrefix);

  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'INVOICE',
    entityId: invoiceId,
    newValues: {
      invoiceNumber,
      studentId: input.studentId,
      billingMonth: input.billingMonth,
      billingYear: input.billingYear,
      totalAmountPaise,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await createInvoiceBatch(dbFinance, {
      invoice: {
        id: invoiceId,
        invoiceNumber,
        studentId: input.studentId,
        enrollmentId: input.enrollmentId,
        billingMonth: input.billingMonth,
        billingYear: input.billingYear,
        invoiceType: input.invoiceType,
        totalAmountPaise,
        dueDate: input.dueDate,
        status,
        createdAt: timestamp,
      },
      items: itemsToInsert,
      auditStatement,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw new FinanceServiceError(
        'CONFLICT',
        'An invoice for this student, billing period, and invoice type already exists.',
        409
      );
    }
    throw err;
  }

  return await findInvoiceById(dbFinance, invoiceId);
}

// Payments & Allocations
export async function listPaymentsService(dbFinance, query) {
  return await listPaymentsPaginated(dbFinance, {
    studentId: query.studentId,
    status: query.status,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function getPaymentByIdService(dbFinance, id) {
  const payment = await findPaymentById(dbFinance, id);
  if (!payment) throw new FinanceServiceError('NOT_FOUND', 'Payment not found.', 404);
  return payment;
}

export async function createPaymentService(dbFinance, workerEnv, actorSession, input, meta) {
  await validateStudentExists(workerEnv, input.studentId);
  assertIntegerPaise(input.amountPaidPaise, { allowNegative: false, allowZero: false, label: 'amountPaidPaise' });

  if (input.idempotencyKey) {
    const existing = await findPaymentByIdempotencyKey(dbFinance, input.idempotencyKey);
    if (existing) {
      return { payment: existing, idempotentReplay: true };
    }
  }

  const requestedAllocations = input.allocations || [];
  const seenInvoices = new Set();
  let totalAllocated = 0;
  const invoiceStatusUpdates = [];

  for (const alloc of requestedAllocations) {
    if (seenInvoices.has(alloc.invoiceId)) {
      throw new FinanceServiceError('VALIDATION_ERROR', 'Duplicate invoiceId in payment allocations.', 400);
    }
    seenInvoices.add(alloc.invoiceId);
    assertIntegerPaise(alloc.allocatedAmountPaise, { allowNegative: false, allowZero: false, label: 'allocatedAmountPaise' });
    totalAllocated += alloc.allocatedAmountPaise;

    const inv = await getInvoiceByIdService(dbFinance, alloc.invoiceId);
    if (inv.studentId !== input.studentId) {
      throw new FinanceServiceError('VALIDATION_ERROR', 'Allocated invoice does not belong to the payment student.', 400);
    }
    if (alloc.allocatedAmountPaise > inv.outstandingPaise) {
      throw new FinanceServiceError(
        'CONFLICT',
        `Allocation (${alloc.allocatedAmountPaise}) exceeds invoice outstanding balance (${inv.outstandingPaise}).`,
        409
      );
    }
    const nextPaid = inv.paidPaise + alloc.allocatedAmountPaise;
    invoiceStatusUpdates.push({
      invoiceId: inv.id,
      status: deriveEffectiveInvoiceStatus(inv.totalAmountPaise, inv.adjustmentPaise, nextPaid),
    });
  }

  if (totalAllocated > input.amountPaidPaise) {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Total allocated amount cannot exceed amountPaidPaise.', 400);
  }

  const timestamp = nowIso();
  const paymentId = crypto.randomUUID();
  const allocations = requestedAllocations.map((a) => ({
    id: crypto.randomUUID(),
    invoiceId: a.invoiceId,
    allocatedAmountPaise: a.allocatedAmountPaise,
  }));
  const receipt = input.issueReceipt
    ? {
        id: crypto.randomUUID(),
        receiptNumber: generateDocumentNumber('REC', input.paymentDate),
        issuedDate: input.paymentDate,
        createdAt: timestamp,
      }
    : null;

  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: allocations.length > 0 ? 'ALLOCATION' : 'CREATE',
    entityType: 'PAYMENT',
    entityId: paymentId,
    newValues: {
      studentId: input.studentId,
      amountPaidPaise: input.amountPaidPaise,
      paymentMethod: input.paymentMethod,
      receiptNumber: receipt?.receiptNumber ?? null,
      allocatedInvoiceIds: allocations.map((a) => a.invoiceId),
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await createPaymentBatch(dbFinance, {
      payment: {
        id: paymentId,
        studentId: input.studentId,
        amountPaidPaise: input.amountPaidPaise,
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        paymentDate: input.paymentDate,
        notes: input.notes ?? null,
        recordedByUserId: actorSession.userId,
        createdAt: timestamp,
      },
      allocations,
      receipt,
      invoiceStatusUpdates,
      auditStatement,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed') && input.idempotencyKey) {
      const existing = await findPaymentByIdempotencyKey(dbFinance, input.idempotencyKey);
      if (existing) return { payment: existing, idempotentReplay: true };
    }
    throw err;
  }

  return { payment: await findPaymentById(dbFinance, paymentId), idempotentReplay: false };
}

export async function listAllocationsService(dbFinance, query) {
  return await listAllocationsPaginated(dbFinance, {
    paymentId: query.paymentId,
    invoiceId: query.invoiceId,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function createAllocationService(dbFinance, actorSession, input, meta) {
  assertIntegerPaise(input.allocatedAmountPaise, { allowNegative: false, allowZero: false, label: 'allocatedAmountPaise' });
  const payment = await getPaymentByIdService(dbFinance, input.paymentId);
  if (payment.status !== 'POSTED') {
    throw new FinanceServiceError('CONFLICT', 'Cannot allocate a reversed payment.', 409);
  }
  if (input.allocatedAmountPaise > payment.unallocatedPaise) {
    throw new FinanceServiceError(
      'CONFLICT',
      `Allocation exceeds remaining unallocated payment amount (${payment.unallocatedPaise}).`,
      409
    );
  }

  const invoice = await getInvoiceByIdService(dbFinance, input.invoiceId);
  if (invoice.studentId !== payment.studentId) {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Invoice and payment must belong to the same student.', 400);
  }
  if (input.allocatedAmountPaise > invoice.outstandingPaise) {
    throw new FinanceServiceError(
      'CONFLICT',
      `Allocation exceeds invoice outstanding balance (${invoice.outstandingPaise}).`,
      409
    );
  }

  const timestamp = nowIso();
  const allocationId = crypto.randomUUID();
  const nextStatus = deriveEffectiveInvoiceStatus(
    invoice.totalAmountPaise,
    invoice.adjustmentPaise,
    invoice.paidPaise + input.allocatedAmountPaise
  );

  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'ALLOCATION',
    entityType: 'PAYMENT_ALLOCATION',
    entityId: allocationId,
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await createAllocationBatch(dbFinance, {
      allocation: {
        id: allocationId,
        paymentId: input.paymentId,
        invoiceId: input.invoiceId,
        allocatedAmountPaise: input.allocatedAmountPaise,
        createdAt: timestamp,
      },
      invoiceStatusUpdate: { invoiceId: invoice.id, status: nextStatus },
      auditStatement,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw new FinanceServiceError('CONFLICT', 'This payment already has an allocation for the specified invoice.', 409);
    }
    throw err;
  }

  return await getInvoiceByIdService(dbFinance, invoice.id);
}

// Fee Adjustments
export async function listAdjustmentsService(dbFinance, query) {
  return await listAdjustmentsPaginated(dbFinance, {
    studentId: query.studentId,
    invoiceId: query.invoiceId,
    status: query.status,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function getAdjustmentByIdService(dbFinance, id) {
  const item = await findAdjustmentById(dbFinance, id);
  if (!item) throw new FinanceServiceError('NOT_FOUND', 'Fee adjustment not found.', 404);
  return item;
}

export async function createAdjustmentService(dbFinance, workerEnv, actorSession, input, meta) {
  await validateStudentAndEnrollment(workerEnv, input.studentId, input.enrollmentId);
  assertIntegerPaise(input.amountPaise, { allowNegative: true, allowZero: false, label: 'amountPaise' });
  const invoice = await getInvoiceByIdService(dbFinance, input.invoiceId);
  if (invoice.studentId !== input.studentId) {
    throw new FinanceServiceError('VALIDATION_ERROR', 'Invoice does not belong to the specified student.', 400);
  }
  if (input.feeComponentId) {
    await getFeeComponentByIdService(dbFinance, input.feeComponentId);
  }

  const timestamp = nowIso();
  const adjustmentId = crypto.randomUUID();
  const nextStatus = deriveEffectiveInvoiceStatus(
    invoice.totalAmountPaise,
    invoice.adjustmentPaise + input.amountPaise,
    invoice.paidPaise
  );

  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'FEE_ADJUSTMENT',
    entityId: adjustmentId,
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await createAdjustmentBatch(dbFinance, {
      adjustment: {
        id: adjustmentId,
        ...input,
        approvedByUserId: actorSession.userId,
        requestId: meta.requestId,
        createdAt: timestamp,
      },
      invoiceStatusUpdate: { invoiceId: invoice.id, status: nextStatus },
      auditStatement,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw new FinanceServiceError('CONFLICT', 'Duplicate fee adjustment idempotency key.', 409);
    }
    throw err;
  }

  return await findAdjustmentById(dbFinance, adjustmentId);
}

export async function voidAdjustmentService(dbFinance, actorSession, id, voidReason, meta) {
  const existing = await getAdjustmentByIdService(dbFinance, id);
  if (existing.status === 'VOIDED') {
    throw new FinanceServiceError('CONFLICT', 'Fee adjustment is already voided.', 409);
  }
  const invoice = await getInvoiceByIdService(dbFinance, existing.invoiceId);
  const nextStatus = deriveEffectiveInvoiceStatus(
    invoice.totalAmountPaise,
    invoice.adjustmentPaise - existing.amountPaise,
    invoice.paidPaise
  );
  const timestamp = nowIso();

  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'FEE_ADJUSTMENT',
    entityId: id,
    oldValues: { status: 'POSTED' },
    newValues: { status: 'VOIDED', voidReason },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await voidAdjustmentBatch(dbFinance, {
    id,
    voidedByUserId: actorSession.userId,
    voidedAt: timestamp,
    voidReason,
    invoiceStatusUpdate: { invoiceId: invoice.id, status: nextStatus },
    auditStatement,
  });

  return await findAdjustmentById(dbFinance, id);
}

// Payment Reversals (1:1 Full Reversal Only)
export async function listReversalsService(dbFinance, query) {
  return await listReversalsPaginated(dbFinance, {
    paymentId: query.paymentId,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function getReversalByIdService(dbFinance, id) {
  const item = await findReversalById(dbFinance, id);
  if (!item) throw new FinanceServiceError('NOT_FOUND', 'Payment reversal not found.', 404);
  return item;
}

export async function reversePaymentService(dbFinance, actorSession, input, meta) {
  const payment = await getPaymentByIdService(dbFinance, input.paymentId);
  if (payment.status === 'REVERSED' || payment.reversal) {
    throw new FinanceServiceError('CONFLICT', 'Payment has already been reversed.', 409);
  }
  if (
    input.reversedAmountPaise !== undefined &&
    input.reversedAmountPaise !== payment.amountPaidPaise
  ) {
    throw new FinanceServiceError(
      'VALIDATION_ERROR',
      'Only full payment reversals are supported in MVP (reversedAmountPaise must equal amountPaidPaise).',
      400
    );
  }

  const invoiceStatusUpdates = [];
  for (const alloc of payment.allocations) {
    const inv = await getInvoiceByIdService(dbFinance, alloc.invoiceId);
    const { paidPaise, adjustmentPaise } = await getInvoiceLedgerTotals(dbFinance, inv.id);
    const nextPaid = Math.max(0, paidPaise - alloc.allocatedAmountPaise);
    invoiceStatusUpdates.push({
      invoiceId: inv.id,
      status: deriveEffectiveInvoiceStatus(inv.totalAmountPaise, adjustmentPaise, nextPaid),
    });
  }

  const timestamp = nowIso();
  const reversalId = crypto.randomUUID();
  const auditStatement = createAuditOutboxStatement(dbFinance, {
    actorUserId: actorSession.userId,
    action: 'REVERSAL',
    entityType: 'PAYMENT',
    entityId: payment.id,
    oldValues: { status: 'POSTED', amountPaidPaise: payment.amountPaidPaise },
    newValues: {
      status: 'REVERSED',
      reversalId,
      reversedAmountPaise: payment.amountPaidPaise,
      reason: input.reason,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await reversePaymentBatch(dbFinance, {
      reversal: {
        id: reversalId,
        paymentId: payment.id,
        reversedAmountPaise: payment.amountPaidPaise,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey ?? null,
        reversedByUserId: actorSession.userId,
        requestId: meta.requestId,
        createdAt: timestamp,
      },
      invoiceStatusUpdates,
      auditStatement,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      throw new FinanceServiceError('CONFLICT', 'Payment has already been reversed.', 409);
    }
    throw err;
  }

  return await findReversalById(dbFinance, reversalId);
}

// Receipts & Balances
export async function listReceiptsService(dbFinance, query) {
  return await listReceiptsPaginated(dbFinance, {
    paymentId: query.paymentId,
    status: query.status,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
}

export async function getReceiptByIdService(dbFinance, id) {
  const rec = await findReceiptById(dbFinance, id);
  if (!rec) throw new FinanceServiceError('NOT_FOUND', 'Receipt not found.', 404);
  return rec;
}

export async function getStudentBalanceService(dbFinance, workerEnv, studentId) {
  await validateStudentExists(workerEnv, studentId);
  return await getStudentBalanceAggregate(dbFinance, studentId);
}
