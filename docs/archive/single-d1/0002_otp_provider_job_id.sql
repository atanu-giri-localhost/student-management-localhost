-- ============================================================================
-- Migration: 0002_otp_provider_job_id.sql
-- Purpose:   Persist upstream WhatsApp delivery job ID (e.g. Ogensync jobId)
--            on otp_challenges for delivery diagnostics without modifying 0001.
-- ============================================================================

PRAGMA foreign_keys = ON;

ALTER TABLE otp_challenges ADD COLUMN provider_job_id TEXT;

CREATE INDEX IF NOT EXISTS idx_otp_challenges_provider_job
  ON otp_challenges(provider_job_id)
  WHERE provider_job_id IS NOT NULL;
