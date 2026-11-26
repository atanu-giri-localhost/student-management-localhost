-- ============================================================================
-- Migration: migrations/audit/0001_init.sql
-- Database:  DB_AUDIT (sms-d1-audit)
-- Purpose:   Immutable entity mutation audit trail and operational system/
--            reconciliation events.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS audit_logs (
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
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
  source_domain TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  request_id TEXT,
  payload_json TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created
  ON audit_logs(entity_type, entity_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
  ON audit_logs(actor_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id
  ON audit_logs(request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_system_events_unresolved
  ON system_events(severity, created_at)
  WHERE resolved_at IS NULL;
