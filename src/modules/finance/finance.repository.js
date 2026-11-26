/**
 * Direct Cloudflare D1 (`DB_FINANCE`) repository for all 11 finance tables.
 * Uses strictly integer paise and parameterized prepared statements.
 */

export async function listFeeComponentsPaginated(dbFinance, { limit, offset }) {
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare('SELECT COUNT(*) AS total FROM fee_components'),
    dbFinance
      .prepare('SELECT id, code, name, description FROM fee_components ORDER BY code ASC LIMIT ? OFFSET ?')
      .bind(limit, offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    components: (rowsRes.results || []).map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description ?? null,
    })),
  };
}

export async function findFeeComponentById(dbFinance, id) {
  const r = await dbFinance
    .prepare('SELECT id, code, name, description FROM fee_components WHERE id = ? LIMIT 1')
    .bind(id)
    .first();
  return r ? { id: r.id, code: r.code, name: r.name, description: r.description ?? null } : null;
}

export async function createFeeComponentBatch(dbFinance, { component, auditStatement }) {
  return await dbFinance.batch([
    dbFinance
      .prepare('INSERT INTO fee_components (id, code, name, description) VALUES (?, ?, ?, ?)')
      .bind(component.id, component.code, component.name, component.description ?? null),
    auditStatement,
  ]);
}

export async function updateFeeComponentBatch(dbFinance, { id, fields, auditStatement }) {
  const sets = [];
  const params = [];
  if (fields.name !== undefined) {
    sets.push('name = ?');
    params.push(fields.name);
  }
  if (fields.description !== undefined) {
    sets.push('description = ?');
    params.push(fields.description ?? null);
  }
  params.push(id);
  return await dbFinance.batch([
    dbFinance.prepare(`UPDATE fee_components SET ${sets.join(', ')} WHERE id = ?`).bind(...params),
    auditStatement,
  ]);
}

export async function listFeeStructuresPaginated(dbFinance, { academicSessionId, classId, limit, offset }) {
  const where = [];
  const params = [];
  if (academicSessionId) {
    where.push('fs.academic_session_id = ?');
    params.push(academicSessionId);
  }
  if (classId) {
    where.push('fs.class_id = ?');
    params.push(classId);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare(`SELECT COUNT(*) AS total FROM fee_structures fs ${clause}`).bind(...params),
    dbFinance
      .prepare(
        `SELECT fs.id, fs.academic_session_id, fs.class_id, fs.fee_component_id,
                fs.default_amount_paise, fs.effective_from, fc.code AS component_code, fc.name AS component_name
         FROM fee_structures fs
         INNER JOIN fee_components fc ON fc.id = fs.fee_component_id
         ${clause}
         ORDER BY fs.effective_from DESC, fc.code ASC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    structures: (rowsRes.results || []).map((r) => ({
      id: r.id,
      academicSessionId: r.academic_session_id,
      classId: r.class_id,
      feeComponentId: r.fee_component_id,
      componentCode: r.component_code,
      componentName: r.component_name,
      defaultAmountPaise: Number(r.default_amount_paise),
      effectiveFrom: r.effective_from,
    })),
  };
}

export async function findFeeStructureById(dbFinance, id) {
  const r = await dbFinance
    .prepare(
      `SELECT fs.id, fs.academic_session_id, fs.class_id, fs.fee_component_id,
              fs.default_amount_paise, fs.effective_from, fc.code AS component_code, fc.name AS component_name
       FROM fee_structures fs
       INNER JOIN fee_components fc ON fc.id = fs.fee_component_id
       WHERE fs.id = ? LIMIT 1`
    )
    .bind(id)
    .first();
  if (!r) return null;
  return {
    id: r.id,
    academicSessionId: r.academic_session_id,
    classId: r.class_id,
    feeComponentId: r.fee_component_id,
    componentCode: r.component_code,
    componentName: r.component_name,
    defaultAmountPaise: Number(r.default_amount_paise),
    effectiveFrom: r.effective_from,
  };
}

export async function createFeeStructureBatch(dbFinance, { structure, auditStatement }) {
  return await dbFinance.batch([
    dbFinance
      .prepare(
        `INSERT INTO fee_structures (id, academic_session_id, class_id, fee_component_id, default_amount_paise, effective_from)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        structure.id,
        structure.academicSessionId,
        structure.classId,
        structure.feeComponentId,
        structure.defaultAmountPaise,
        structure.effectiveFrom
      ),
    auditStatement,
  ]);
}

export async function updateFeeStructureBatch(dbFinance, { id, fields, auditStatement }) {
  const sets = [];
  const params = [];
  if (fields.defaultAmountPaise !== undefined) {
    sets.push('default_amount_paise = ?');
    params.push(fields.defaultAmountPaise);
  }
  if (fields.effectiveFrom !== undefined) {
    sets.push('effective_from = ?');
    params.push(fields.effectiveFrom);
  }
  params.push(id);
  return await dbFinance.batch([
    dbFinance.prepare(`UPDATE fee_structures SET ${sets.join(', ')} WHERE id = ?`).bind(...params),
    auditStatement,
  ]);
}

export async function listStudentFeeAssignmentsPaginated(dbFinance, { enrollmentId, limit, offset }) {
  const where = enrollmentId ? 'WHERE sfa.enrollment_id = ?' : '';
  const params = enrollmentId ? [enrollmentId] : [];
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare(`SELECT COUNT(*) AS total FROM student_fee_assignments sfa ${where}`).bind(...params),
    dbFinance
      .prepare(
        `SELECT sfa.id, sfa.enrollment_id, sfa.fee_component_id, sfa.custom_amount_paise,
                sfa.reason, sfa.effective_from, fc.code AS component_code, fc.name AS component_name
         FROM student_fee_assignments sfa
         INNER JOIN fee_components fc ON fc.id = sfa.fee_component_id
         ${where}
         ORDER BY sfa.effective_from DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    assignments: (rowsRes.results || []).map((r) => ({
      id: r.id,
      enrollmentId: r.enrollment_id,
      feeComponentId: r.fee_component_id,
      componentCode: r.component_code,
      componentName: r.component_name,
      customAmountPaise: Number(r.custom_amount_paise),
      reason: r.reason ?? null,
      effectiveFrom: r.effective_from,
    })),
  };
}

export async function findStudentFeeAssignmentById(dbFinance, id) {
  const r = await dbFinance
    .prepare(
      `SELECT sfa.id, sfa.enrollment_id, sfa.fee_component_id, sfa.custom_amount_paise,
              sfa.reason, sfa.effective_from, fc.code AS component_code, fc.name AS component_name
       FROM student_fee_assignments sfa
       INNER JOIN fee_components fc ON fc.id = sfa.fee_component_id
       WHERE sfa.id = ? LIMIT 1`
    )
    .bind(id)
    .first();
  if (!r) return null;
  return {
    id: r.id,
    enrollmentId: r.enrollment_id,
    feeComponentId: r.fee_component_id,
    componentCode: r.component_code,
    componentName: r.component_name,
    customAmountPaise: Number(r.custom_amount_paise),
    reason: r.reason ?? null,
    effectiveFrom: r.effective_from,
  };
}

export async function createStudentFeeAssignmentBatch(dbFinance, { assignment, auditStatement }) {
  return await dbFinance.batch([
    dbFinance
      .prepare(
        `INSERT INTO student_fee_assignments (id, enrollment_id, fee_component_id, custom_amount_paise, reason, effective_from)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        assignment.id,
        assignment.enrollmentId,
        assignment.feeComponentId,
        assignment.customAmountPaise,
        assignment.reason ?? null,
        assignment.effectiveFrom
      ),
    auditStatement,
  ]);
}

export async function updateStudentFeeAssignmentBatch(dbFinance, { id, fields, auditStatement }) {
  const sets = [];
  const params = [];
  if (fields.customAmountPaise !== undefined) {
    sets.push('custom_amount_paise = ?');
    params.push(fields.customAmountPaise);
  }
  if (fields.reason !== undefined) {
    sets.push('reason = ?');
    params.push(fields.reason ?? null);
  }
  if (fields.effectiveFrom !== undefined) {
    sets.push('effective_from = ?');
    params.push(fields.effectiveFrom);
  }
  params.push(id);
  return await dbFinance.batch([
    dbFinance.prepare(`UPDATE student_fee_assignments SET ${sets.join(', ')} WHERE id = ?`).bind(...params),
    auditStatement,
  ]);
}

export async function findResolvedFeeItemsForEnrollment(dbFinance, { academicSessionId, classId, enrollmentId, invoiceType }) {
  const { results } = await dbFinance
    .prepare(
      `SELECT fs.fee_component_id, fc.code AS component_code, fc.name AS component_name,
              COALESCE(sfa.custom_amount_paise, fs.default_amount_paise) AS amount_paise
       FROM fee_structures fs
       INNER JOIN fee_components fc ON fc.id = fs.fee_component_id
       LEFT JOIN student_fee_assignments sfa
         ON sfa.enrollment_id = ? AND sfa.fee_component_id = fs.fee_component_id
       WHERE fs.academic_session_id = ?
         AND fs.class_id = ?
       ORDER BY fc.code ASC`
    )
    .bind(enrollmentId, academicSessionId, classId)
    .all();

  return (results || []).filter((r) => {
    if (invoiceType === 'SEPARATE_COACHING') return r.component_code === 'COACHING';
    if (invoiceType === 'SEPARATE_MESS') return r.component_code === 'MESS';
    return true;
  });
}

export async function getInvoiceLedgerTotals(dbFinance, invoiceId) {
  const [paidRow, adjRow] = await dbFinance.batch([
    dbFinance
      .prepare(
        `SELECT COALESCE(SUM(pa.allocated_amount_paise), 0) AS paid_paise
         FROM payment_allocations pa
         INNER JOIN payments p ON p.id = pa.payment_id
         WHERE pa.invoice_id = ?
           AND p.status = 'POSTED'`
      )
      .bind(invoiceId),
    dbFinance
      .prepare(
        `SELECT COALESCE(SUM(amount_paise), 0) AS adjustment_paise
         FROM fee_adjustments
         WHERE invoice_id = ?
           AND status = 'POSTED'`
      )
      .bind(invoiceId),
  ]);
  return {
    paidPaise: Number(paidRow.results?.[0]?.paid_paise ?? 0),
    adjustmentPaise: Number(adjRow.results?.[0]?.adjustment_paise ?? 0),
  };
}

export async function findInvoiceById(dbFinance, invoiceId) {
  const [invRes, itemsRes] = await dbFinance.batch([
    dbFinance
      .prepare(
        `SELECT id, invoice_number, student_id, enrollment_id, billing_month, billing_year,
                invoice_type, total_amount_paise, due_date, status, created_at
         FROM invoices WHERE id = ? LIMIT 1`
      )
      .bind(invoiceId),
    dbFinance
      .prepare(
        `SELECT ii.id, ii.invoice_id, ii.fee_component_id, ii.description, ii.amount_paise,
                fc.code AS component_code, fc.name AS component_name
         FROM invoice_items ii
         INNER JOIN fee_components fc ON fc.id = ii.fee_component_id
         WHERE ii.invoice_id = ?`
      )
      .bind(invoiceId),
  ]);
  const r = invRes.results?.[0];
  if (!r) return null;

  const { paidPaise, adjustmentPaise } = await getInvoiceLedgerTotals(dbFinance, invoiceId);
  const totalAmountPaise = Number(r.total_amount_paise);
  const netPayablePaise = Math.max(0, totalAmountPaise + adjustmentPaise);
  const outstandingPaise = Math.max(0, netPayablePaise - paidPaise);

  return {
    id: r.id,
    invoiceNumber: r.invoice_number,
    studentId: r.student_id,
    enrollmentId: r.enrollment_id,
    billingMonth: Number(r.billing_month),
    billingYear: Number(r.billing_year),
    invoiceType: r.invoice_type,
    totalAmountPaise,
    adjustmentPaise,
    netPayablePaise,
    paidPaise,
    outstandingPaise,
    dueDate: r.due_date,
    status: r.status,
    createdAt: r.created_at,
    items: (itemsRes.results || []).map((it) => ({
      id: it.id,
      feeComponentId: it.fee_component_id,
      componentCode: it.component_code,
      componentName: it.component_name,
      description: it.description,
      amountPaise: Number(it.amount_paise),
    })),
  };
}

export async function listInvoicesPaginated(dbFinance, filters) {
  const where = [];
  const params = [];
  if (filters.studentId) {
    where.push('student_id = ?');
    params.push(filters.studentId);
  }
  if (filters.enrollmentId) {
    where.push('enrollment_id = ?');
    params.push(filters.enrollmentId);
  }
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.billingYear !== undefined) {
    where.push('billing_year = ?');
    params.push(filters.billingYear);
  }
  if (filters.billingMonth !== undefined) {
    where.push('billing_month = ?');
    params.push(filters.billingMonth);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare(`SELECT COUNT(*) AS total FROM invoices ${clause}`).bind(...params),
    dbFinance
      .prepare(
        `SELECT id, invoice_number, student_id, enrollment_id, billing_month, billing_year,
                invoice_type, total_amount_paise, due_date, status, created_at
         FROM invoices
         ${clause}
         ORDER BY billing_year DESC, billing_month DESC, created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    invoices: (rowsRes.results || []).map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number,
      studentId: r.student_id,
      enrollmentId: r.enrollment_id,
      billingMonth: Number(r.billing_month),
      billingYear: Number(r.billing_year),
      invoiceType: r.invoice_type,
      totalAmountPaise: Number(r.total_amount_paise),
      dueDate: r.due_date,
      status: r.status,
      createdAt: r.created_at,
    })),
  };
}

export async function createInvoiceBatch(dbFinance, { invoice, items, auditStatement }) {
  const statements = [
    dbFinance
      .prepare(
        `INSERT INTO invoices (
          id, invoice_number, student_id, enrollment_id, billing_month, billing_year,
          invoice_type, total_amount_paise, due_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        invoice.id,
        invoice.invoiceNumber,
        invoice.studentId,
        invoice.enrollmentId,
        invoice.billingMonth,
        invoice.billingYear,
        invoice.invoiceType,
        invoice.totalAmountPaise,
        invoice.dueDate,
        invoice.status,
        invoice.createdAt
      ),
    ...items.map((item) =>
      dbFinance
        .prepare(
          'INSERT INTO invoice_items (id, invoice_id, fee_component_id, description, amount_paise) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(item.id, invoice.id, item.feeComponentId, item.description, item.amountPaise)
    ),
    auditStatement,
  ];
  return await dbFinance.batch(statements);
}

export async function findPaymentById(dbFinance, paymentId) {
  const [payRes, allocRes, recRes, revRes] = await dbFinance.batch([
    dbFinance
      .prepare(
        `SELECT id, student_id, amount_paid_paise, payment_method, transaction_reference,
                idempotency_key, status, payment_date, notes, recorded_by_user_id, created_at
         FROM payments WHERE id = ? LIMIT 1`
      )
      .bind(paymentId),
    dbFinance
      .prepare(
        `SELECT id, payment_id, invoice_id, allocated_amount_paise, created_at
         FROM payment_allocations WHERE payment_id = ?`
      )
      .bind(paymentId),
    dbFinance
      .prepare(
        `SELECT id, receipt_number, payment_id, status, voided_at, issued_date, created_at
         FROM receipts WHERE payment_id = ? LIMIT 1`
      )
      .bind(paymentId),
    dbFinance
      .prepare(
        `SELECT id, payment_id, reversed_amount_paise, reason, idempotency_key, reversed_by_user_id, request_id, created_at
         FROM payment_reversals WHERE payment_id = ? LIMIT 1`
      )
      .bind(paymentId),
  ]);
  const r = payRes.results?.[0];
  if (!r) return null;

  const allocations = (allocRes.results || []).map((a) => ({
    id: a.id,
    paymentId: a.payment_id,
    invoiceId: a.invoice_id,
    allocatedAmountPaise: Number(a.allocated_amount_paise),
    createdAt: a.created_at,
  }));
  const allocatedTotalPaise = allocations.reduce((s, a) => s + a.allocatedAmountPaise, 0);
  const amountPaidPaise = Number(r.amount_paid_paise);

  const rec = recRes.results?.[0];
  const rev = revRes.results?.[0];

  return {
    id: r.id,
    studentId: r.student_id,
    amountPaidPaise,
    allocatedTotalPaise,
    unallocatedPaise: Math.max(0, amountPaidPaise - allocatedTotalPaise),
    paymentMethod: r.payment_method,
    transactionReference: r.transaction_reference ?? null,
    idempotencyKey: r.idempotency_key ?? null,
    status: r.status,
    paymentDate: r.payment_date,
    notes: r.notes ?? null,
    recordedByUserId: r.recorded_by_user_id ?? null,
    createdAt: r.created_at,
    allocations,
    receipt: rec
      ? {
          id: rec.id,
          receiptNumber: rec.receipt_number,
          status: rec.status,
          voidedAt: rec.voided_at ?? null,
          issuedDate: rec.issued_date,
          createdAt: rec.created_at,
        }
      : null,
    reversal: rev
      ? {
          id: rev.id,
          reversedAmountPaise: Number(rev.reversed_amount_paise),
          reason: rev.reason,
          reversedByUserId: rev.reversed_by_user_id,
          createdAt: rev.created_at,
        }
      : null,
  };
}

export async function findPaymentByIdempotencyKey(dbFinance, idempotencyKey) {
  const row = await dbFinance
    .prepare('SELECT id FROM payments WHERE idempotency_key = ? LIMIT 1')
    .bind(idempotencyKey)
    .first();
  return row ? await findPaymentById(dbFinance, row.id) : null;
}

export async function listPaymentsPaginated(dbFinance, { studentId, status, limit, offset }) {
  const where = [];
  const params = [];
  if (studentId) {
    where.push('student_id = ?');
    params.push(studentId);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare(`SELECT COUNT(*) AS total FROM payments ${clause}`).bind(...params),
    dbFinance
      .prepare(
        `SELECT id, student_id, amount_paid_paise, payment_method, transaction_reference,
                status, payment_date, created_at
         FROM payments
         ${clause}
         ORDER BY payment_date DESC, created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    payments: (rowsRes.results || []).map((r) => ({
      id: r.id,
      studentId: r.student_id,
      amountPaidPaise: Number(r.amount_paid_paise),
      paymentMethod: r.payment_method,
      transactionReference: r.transaction_reference ?? null,
      status: r.status,
      paymentDate: r.payment_date,
      createdAt: r.created_at,
    })),
  };
}

export async function createPaymentBatch(
  dbFinance,
  { payment, allocations, receipt, invoiceStatusUpdates, auditStatement }
) {
  const statements = [
    dbFinance
      .prepare(
        `INSERT INTO payments (
          id, student_id, amount_paid_paise, payment_method, transaction_reference,
          idempotency_key, status, payment_date, notes, recorded_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?, ?)`
      )
      .bind(
        payment.id,
        payment.studentId,
        payment.amountPaidPaise,
        payment.paymentMethod,
        payment.transactionReference ?? null,
        payment.idempotencyKey ?? null,
        payment.paymentDate,
        payment.notes ?? null,
        payment.recordedByUserId ?? null,
        payment.createdAt
      ),
    ...allocations.map((a) =>
      dbFinance
        .prepare(
          'INSERT INTO payment_allocations (id, payment_id, invoice_id, allocated_amount_paise, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(a.id, payment.id, a.invoiceId, a.allocatedAmountPaise, payment.createdAt)
    ),
    ...(receipt
      ? [
          dbFinance
            .prepare(
              `INSERT INTO receipts (id, receipt_number, payment_id, status, voided_at, issued_date, created_at)
               VALUES (?, ?, ?, 'ISSUED', NULL, ?, ?)`
            )
            .bind(receipt.id, receipt.receiptNumber, payment.id, receipt.issuedDate, receipt.createdAt),
        ]
      : []),
    ...invoiceStatusUpdates.map((u) =>
      dbFinance.prepare('UPDATE invoices SET status = ? WHERE id = ?').bind(u.status, u.invoiceId)
    ),
    auditStatement,
  ];
  return await dbFinance.batch(statements);
}

export async function listAllocationsPaginated(dbFinance, { paymentId, invoiceId, limit, offset }) {
  const where = [];
  const params = [];
  if (paymentId) {
    where.push('pa.payment_id = ?');
    params.push(paymentId);
  }
  if (invoiceId) {
    where.push('pa.invoice_id = ?');
    params.push(invoiceId);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare(`SELECT COUNT(*) AS total FROM payment_allocations pa ${clause}`).bind(...params),
    dbFinance
      .prepare(
        `SELECT pa.id, pa.payment_id, pa.invoice_id, pa.allocated_amount_paise, pa.created_at,
                p.status AS payment_status
         FROM payment_allocations pa
         INNER JOIN payments p ON p.id = pa.payment_id
         ${clause}
         ORDER BY pa.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    allocations: (rowsRes.results || []).map((r) => ({
      id: r.id,
      paymentId: r.payment_id,
      invoiceId: r.invoice_id,
      allocatedAmountPaise: Number(r.allocated_amount_paise),
      paymentStatus: r.payment_status,
      createdAt: r.created_at,
    })),
  };
}

export async function createAllocationBatch(dbFinance, { allocation, invoiceStatusUpdate, auditStatement }) {
  return await dbFinance.batch([
    dbFinance
      .prepare(
        'INSERT INTO payment_allocations (id, payment_id, invoice_id, allocated_amount_paise, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(
        allocation.id,
        allocation.paymentId,
        allocation.invoiceId,
        allocation.allocatedAmountPaise,
        allocation.createdAt
      ),
    dbFinance
      .prepare('UPDATE invoices SET status = ? WHERE id = ?')
      .bind(invoiceStatusUpdate.status, invoiceStatusUpdate.invoiceId),
    auditStatement,
  ]);
}

export async function findAdjustmentById(dbFinance, id) {
  const r = await dbFinance
    .prepare(
      `SELECT id, student_id, enrollment_id, invoice_id, fee_component_id,
              adjustment_type, amount_paise, reason, idempotency_key, status,
              approved_by_user_id, voided_by_user_id, voided_at, void_reason,
              request_id, created_at
       FROM fee_adjustments WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .first();
  if (!r) return null;
  return {
    id: r.id,
    studentId: r.student_id,
    enrollmentId: r.enrollment_id,
    invoiceId: r.invoice_id,
    feeComponentId: r.fee_component_id ?? null,
    adjustmentType: r.adjustment_type,
    amountPaise: Number(r.amount_paise),
    reason: r.reason,
    idempotencyKey: r.idempotency_key ?? null,
    status: r.status,
    approvedByUserId: r.approved_by_user_id,
    voidedByUserId: r.voided_by_user_id ?? null,
    voidedAt: r.voided_at ?? null,
    voidReason: r.void_reason ?? null,
    requestId: r.request_id ?? null,
    createdAt: r.created_at,
  };
}

export async function listAdjustmentsPaginated(dbFinance, { studentId, invoiceId, status, limit, offset }) {
  const where = [];
  const params = [];
  if (studentId) {
    where.push('student_id = ?');
    params.push(studentId);
  }
  if (invoiceId) {
    where.push('invoice_id = ?');
    params.push(invoiceId);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare(`SELECT COUNT(*) AS total FROM fee_adjustments ${clause}`).bind(...params),
    dbFinance
      .prepare(
        `SELECT id, student_id, enrollment_id, invoice_id, fee_component_id,
                adjustment_type, amount_paise, reason, status, approved_by_user_id, created_at
         FROM fee_adjustments
         ${clause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    adjustments: (rowsRes.results || []).map((r) => ({
      id: r.id,
      studentId: r.student_id,
      enrollmentId: r.enrollment_id,
      invoiceId: r.invoice_id,
      feeComponentId: r.fee_component_id ?? null,
      adjustmentType: r.adjustment_type,
      amountPaise: Number(r.amount_paise),
      reason: r.reason,
      status: r.status,
      approvedByUserId: r.approved_by_user_id,
      createdAt: r.created_at,
    })),
  };
}

export async function createAdjustmentBatch(dbFinance, { adjustment, invoiceStatusUpdate, auditStatement }) {
  return await dbFinance.batch([
    dbFinance
      .prepare(
        `INSERT INTO fee_adjustments (
          id, student_id, enrollment_id, invoice_id, fee_component_id,
          adjustment_type, amount_paise, reason, idempotency_key, status,
          approved_by_user_id, voided_by_user_id, voided_at, void_reason,
          request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?, NULL, NULL, NULL, ?, ?)`
      )
      .bind(
        adjustment.id,
        adjustment.studentId,
        adjustment.enrollmentId,
        adjustment.invoiceId,
        adjustment.feeComponentId ?? null,
        adjustment.adjustmentType,
        adjustment.amountPaise,
        adjustment.reason,
        adjustment.idempotencyKey ?? null,
        adjustment.approvedByUserId,
        adjustment.requestId ?? null,
        adjustment.createdAt
      ),
    dbFinance
      .prepare('UPDATE invoices SET status = ? WHERE id = ?')
      .bind(invoiceStatusUpdate.status, invoiceStatusUpdate.invoiceId),
    auditStatement,
  ]);
}

export async function voidAdjustmentBatch(
  dbFinance,
  { id, voidedByUserId, voidedAt, voidReason, invoiceStatusUpdate, auditStatement }
) {
  return await dbFinance.batch([
    dbFinance
      .prepare(
        `UPDATE fee_adjustments
         SET status = 'VOIDED', voided_by_user_id = ?, voided_at = ?, void_reason = ?
         WHERE id = ? AND status = 'POSTED'`
      )
      .bind(voidedByUserId, voidedAt, voidReason, id),
    dbFinance
      .prepare('UPDATE invoices SET status = ? WHERE id = ?')
      .bind(invoiceStatusUpdate.status, invoiceStatusUpdate.invoiceId),
    auditStatement,
  ]);
}

export async function findReversalById(dbFinance, id) {
  const r = await dbFinance
    .prepare(
      `SELECT id, payment_id, reversed_amount_paise, reason, idempotency_key,
              reversed_by_user_id, request_id, created_at
       FROM payment_reversals WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .first();
  if (!r) return null;
  return {
    id: r.id,
    paymentId: r.payment_id,
    reversedAmountPaise: Number(r.reversed_amount_paise),
    reason: r.reason,
    idempotencyKey: r.idempotency_key ?? null,
    reversedByUserId: r.reversed_by_user_id,
    requestId: r.request_id ?? null,
    createdAt: r.created_at,
  };
}

export async function listReversalsPaginated(dbFinance, { paymentId, limit, offset }) {
  const where = paymentId ? 'WHERE payment_id = ?' : '';
  const params = paymentId ? [paymentId] : [];
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare(`SELECT COUNT(*) AS total FROM payment_reversals ${where}`).bind(...params),
    dbFinance
      .prepare(
        `SELECT id, payment_id, reversed_amount_paise, reason, reversed_by_user_id, request_id, created_at
         FROM payment_reversals ${where}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    reversals: (rowsRes.results || []).map((r) => ({
      id: r.id,
      paymentId: r.payment_id,
      reversedAmountPaise: Number(r.reversed_amount_paise),
      reason: r.reason,
      reversedByUserId: r.reversed_by_user_id,
      requestId: r.request_id ?? null,
      createdAt: r.created_at,
    })),
  };
}

export async function reversePaymentBatch(
  dbFinance,
  { reversal, invoiceStatusUpdates, auditStatement }
) {
  return await dbFinance.batch([
    dbFinance
      .prepare(
        `INSERT INTO payment_reversals (
          id, payment_id, reversed_amount_paise, reason, idempotency_key,
          reversed_by_user_id, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        reversal.id,
        reversal.paymentId,
        reversal.reversedAmountPaise,
        reversal.reason,
        reversal.idempotencyKey ?? null,
        reversal.reversedByUserId,
        reversal.requestId ?? null,
        reversal.createdAt
      ),
    dbFinance
      .prepare("UPDATE payments SET status = 'REVERSED' WHERE id = ? AND status = 'POSTED'")
      .bind(reversal.paymentId),
    dbFinance
      .prepare("UPDATE receipts SET status = 'VOIDED', voided_at = ? WHERE payment_id = ? AND status = 'ISSUED'")
      .bind(reversal.createdAt, reversal.paymentId),
    ...invoiceStatusUpdates.map((u) =>
      dbFinance.prepare('UPDATE invoices SET status = ? WHERE id = ?').bind(u.status, u.invoiceId)
    ),
    auditStatement,
  ]);
}

export async function findReceiptById(dbFinance, id) {
  const r = await dbFinance
    .prepare(
      `SELECT r.id, r.receipt_number, r.payment_id, r.status, r.voided_at, r.issued_date, r.created_at,
              p.student_id, p.amount_paid_paise, p.payment_method, p.status AS payment_status
       FROM receipts r
       INNER JOIN payments p ON p.id = r.payment_id
       WHERE r.id = ? LIMIT 1`
    )
    .bind(id)
    .first();
  if (!r) return null;
  return {
    id: r.id,
    receiptNumber: r.receipt_number,
    paymentId: r.payment_id,
    studentId: r.student_id,
    amountPaidPaise: Number(r.amount_paid_paise),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    status: r.status,
    voidedAt: r.voided_at ?? null,
    issuedDate: r.issued_date,
    createdAt: r.created_at,
  };
}

export async function listReceiptsPaginated(dbFinance, { paymentId, status, limit, offset }) {
  const where = [];
  const params = [];
  if (paymentId) {
    where.push('r.payment_id = ?');
    params.push(paymentId);
  }
  if (status) {
    where.push('r.status = ?');
    params.push(status);
  }
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [countRes, rowsRes] = await dbFinance.batch([
    dbFinance.prepare(`SELECT COUNT(*) AS total FROM receipts r ${clause}`).bind(...params),
    dbFinance
      .prepare(
        `SELECT r.id, r.receipt_number, r.payment_id, r.status, r.voided_at, r.issued_date, r.created_at,
                p.student_id, p.amount_paid_paise, p.payment_method, p.status AS payment_status
         FROM receipts r
         INNER JOIN payments p ON p.id = r.payment_id
         ${clause}
         ORDER BY r.issued_date DESC, r.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset),
  ]);
  return {
    total: Number(countRes.results[0]?.total ?? 0),
    receipts: (rowsRes.results || []).map((r) => ({
      id: r.id,
      receiptNumber: r.receipt_number,
      paymentId: r.payment_id,
      studentId: r.student_id,
      amountPaidPaise: Number(r.amount_paid_paise),
      paymentMethod: r.payment_method,
      paymentStatus: r.payment_status,
      status: r.status,
      voidedAt: r.voided_at ?? null,
      issuedDate: r.issued_date,
      createdAt: r.created_at,
    })),
  };
}

export async function getStudentBalanceAggregate(dbFinance, studentId) {
  const [invRow, adjRow, paidRow] = await dbFinance.batch([
    dbFinance
      .prepare('SELECT COALESCE(SUM(total_amount_paise), 0) AS total_billed_paise FROM invoices WHERE student_id = ?')
      .bind(studentId),
    dbFinance
      .prepare(
        `SELECT COALESCE(SUM(amount_paise), 0) AS total_adjustments_paise
         FROM fee_adjustments WHERE student_id = ? AND status = 'POSTED'`
      )
      .bind(studentId),
    dbFinance
      .prepare(
        `SELECT COALESCE(SUM(pa.allocated_amount_paise), 0) AS total_paid_paise
         FROM payment_allocations pa
         INNER JOIN payments p ON p.id = pa.payment_id
         INNER JOIN invoices i ON i.id = pa.invoice_id
         WHERE i.student_id = ? AND p.status = 'POSTED'`
      )
      .bind(studentId),
  ]);
  const totalBilledPaise = Number(invRow.results?.[0]?.total_billed_paise ?? 0);
  const totalAdjustmentsPaise = Number(adjRow.results?.[0]?.total_adjustments_paise ?? 0);
  const totalPaidPaise = Number(paidRow.results?.[0]?.total_paid_paise ?? 0);
  const netPayablePaise = Math.max(0, totalBilledPaise + totalAdjustmentsPaise);
  const outstandingPaise = Math.max(0, netPayablePaise - totalPaidPaise);
  return {
    studentId,
    totalBilledPaise,
    totalAdjustmentsPaise,
    netPayablePaise,
    totalPaidPaise,
    outstandingPaise,
  };
}
