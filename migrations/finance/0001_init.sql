-- ============================================================================
-- Migration: migrations/finance/0001_init.sql
-- Database:  DB_FINANCE (sms-d1-finance)
-- Purpose:   Integer-paise fee ledger, fee structures, overrides, invoices,
--            payments, allocations, signed fee adjustments, full-only payment
--            reversals, receipts, and critical-event audit_outbox.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fee_components (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code IN ('COACHING', 'MESS', 'OTHER')),
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id TEXT PRIMARY KEY,
  academic_session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  fee_component_id TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT,
  default_amount_paise INTEGER NOT NULL CHECK (default_amount_paise >= 0),
  effective_from TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d', 'now')),
  UNIQUE (academic_session_id, class_id, fee_component_id)
);

CREATE TABLE IF NOT EXISTS student_fee_assignments (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  fee_component_id TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT,
  custom_amount_paise INTEGER NOT NULL CHECK (custom_amount_paise >= 0),
  reason TEXT,
  effective_from TEXT NOT NULL,
  UNIQUE (enrollment_id, fee_component_id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  billing_month INTEGER NOT NULL CHECK (billing_month BETWEEN 1 AND 12),
  billing_year INTEGER NOT NULL CHECK (billing_year >= 2000 AND billing_year <= 2100),
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('COMBINED', 'SEPARATE_COACHING', 'SEPARATE_MESS')),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID')),
  created_at TEXT NOT NULL,
  UNIQUE (student_id, billing_month, billing_year, invoice_type)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  fee_component_id TEXT NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  amount_paid_paise INTEGER NOT NULL CHECK (amount_paid_paise > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'UPI', 'BANK_TRANSFER')),
  transaction_reference TEXT,
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'REVERSED')),
  payment_date TEXT NOT NULL,
  notes TEXT,
  recorded_by_user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  allocated_amount_paise INTEGER NOT NULL CHECK (allocated_amount_paise > 0),
  created_at TEXT NOT NULL,
  UNIQUE (payment_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS fee_adjustments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  fee_component_id TEXT REFERENCES fee_components(id) ON DELETE RESTRICT,
  adjustment_type TEXT NOT NULL CHECK (
    adjustment_type IN ('WAIVER', 'DISCOUNT', 'LATE_FINE', 'CORRECTION')
  ),
  amount_paise INTEGER NOT NULL CHECK (
    (adjustment_type IN ('WAIVER', 'DISCOUNT') AND amount_paise < 0)
    OR (adjustment_type = 'LATE_FINE' AND amount_paise > 0)
    OR (adjustment_type = 'CORRECTION' AND amount_paise != 0)
  ),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED')),
  approved_by_user_id TEXT NOT NULL,
  voided_by_user_id TEXT,
  voided_at TEXT,
  void_reason TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL,
  CHECK (
    status != 'VOIDED'
    OR (
      voided_by_user_id IS NOT NULL
      AND voided_at IS NOT NULL
      AND void_reason IS NOT NULL
      AND length(trim(void_reason)) > 0
    )
  )
);

CREATE TABLE IF NOT EXISTS payment_reversals (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  reversed_amount_paise INTEGER NOT NULL CHECK (reversed_amount_paise > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  idempotency_key TEXT UNIQUE,
  reversed_by_user_id TEXT NOT NULL,
  request_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'VOIDED')),
  voided_at TEXT,
  issued_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_outbox (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL CHECK (
    action IN ('CREATE', 'UPDATE', 'DELETE', 'CORRECTION', 'ALLOCATION', 'REVERSAL', 'REVOKE', 'UNLINK')
  ),
  entity_type TEXT NOT NULL CHECK (length(trim(entity_type)) > 0),
  entity_id TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  request_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fee_structures_session_class
  ON fee_structures(academic_session_id, class_id);

CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_enrollment
  ON student_fee_assignments(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_invoices_student_status_due
  ON invoices(student_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_invoices_enrollment_period
  ON invoices(enrollment_id, billing_year, billing_month);

CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON invoices(due_date)
  WHERE status != 'PAID';

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
  ON invoice_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_student_date
  ON payments(student_id, payment_date);

CREATE INDEX IF NOT EXISTS idx_payments_date
  ON payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice
  ON payment_allocations(invoice_id);

CREATE INDEX IF NOT EXISTS idx_fee_adjustments_student
  ON fee_adjustments(student_id, created_at);

CREATE INDEX IF NOT EXISTS idx_fee_adjustments_invoice
  ON fee_adjustments(invoice_id, status);

CREATE INDEX IF NOT EXISTS idx_receipts_issued_date
  ON receipts(issued_date);

CREATE INDEX IF NOT EXISTS idx_audit_outbox_pending
  ON audit_outbox(status, created_at)
  WHERE status = 'PENDING';
