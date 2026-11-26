-- ============================================================================
-- Migration: migrations/identity/0001_init.sql
-- Database:  DB_IDENTITY (sms-d1-identity)
-- Purpose:   Authentication, RBAC roles, WhatsApp OTP challenges, sessions,
--            and critical-event audit_outbox.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone_normalized TEXT NOT NULL UNIQUE CHECK (phone_normalized LIKE '+%'),
  email TEXT CHECK (email IS NULL OR length(trim(email)) > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (
    name IN ('SUPER_ADMIN', 'COACHING_ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
  ),
  description TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  phone_normalized TEXT NOT NULL CHECK (phone_normalized LIKE '+%'),
  otp_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    delivery_status IN ('PENDING', 'DELIVERED', 'FAILED')
  ),
  request_ip TEXT,
  provider_job_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT,
  ip_address TEXT,
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
  ON users(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_active
  ON users(is_active, created_at);

CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles(role_id);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_phone_created
  ON otp_challenges(phone_normalized, created_at);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_ip_created
  ON otp_challenges(request_ip, created_at)
  WHERE request_ip IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_challenges_provider_job
  ON otp_challenges(provider_job_id)
  WHERE provider_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
  ON sessions(user_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_audit_outbox_pending
  ON audit_outbox(status, created_at)
  WHERE status = 'PENDING';
