-- Phone verification support
--
-- 1. Add phone_verified flag to public.profiles (phone column already exists
--    from migration 20260513000003_add_phone_and_role_aware_signup_trigger.sql).
--
-- 2. Create public.phone_verifications table:
--    - Stores hashed OTP codes (SHA-256 of code+user_id) — never plaintext
--    - Only Edge Functions using the service role touch this table
--    - RLS enabled, deny-by-default (no anon/authenticated policies)
--
-- Idempotent: all DDL uses IF NOT EXISTS / IF EXISTS guards.

-- ─── 1. profiles: add phone_verified ────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.phone_verified IS
  'TRUE once the user has successfully completed the SMS OTP flow via verify-phone-otp.';

-- ─── 2. phone_verifications ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  code_hash   TEXT        NOT NULL,   -- SHA-256 hex of (code || user_id)
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.phone_verifications IS
  'Pending SMS OTP verifications. Rows are deleted on success or after 5 failed attempts.';

-- Index for the per-user lookups performed by send-phone-otp and verify-phone-otp
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id
  ON public.phone_verifications (user_id);

-- Index to support the rate-limit query (count rows created in the last hour)
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_created
  ON public.phone_verifications (user_id, created_at);

-- ─── 3. RLS — deny by default (service role bypasses RLS entirely) ──────────

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- No policies: anon and authenticated roles are denied all access.
-- Only Edge Functions that use SUPABASE_SERVICE_ROLE_KEY can read/write rows.
-- This is intentional: the OTP flow is server-side only.
