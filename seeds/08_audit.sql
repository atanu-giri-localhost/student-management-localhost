-- ============================================================================
-- Synthetic Development Seed: seeds/08_audit.sql
-- Target DB: DB_AUDIT (sms-d1-audit)
-- WARNING: SYNTHETIC DEVELOPMENT FIXTURES ONLY. NEVER run against production.
-- ============================================================================

PRAGMA foreign_keys = ON;

INSERT INTO audit_logs (
  id, actor_user_id, action, entity_type, entity_id,
  old_values, new_values, ip_address, request_id, created_at
) VALUES
  (
    '30000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000002',
    'CREATE',
    'PAYMENT',
    '2d000000-0000-4000-8000-000000000001',
    NULL,
    '{"amountPaidPaise":360000,"paymentMethod":"UPI","invoiceId":"2b000000-0000-4000-8000-000000000001","receiptNumber":"REC-202611-0001"}',
    '127.0.0.1',
    'req_seed_0001',
    '2026-11-05T06:15:00.000Z'
  )
ON CONFLICT DO NOTHING;
