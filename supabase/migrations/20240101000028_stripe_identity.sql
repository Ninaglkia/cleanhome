-- ============================================================================
-- Migration: stripe_identity
-- Adds Stripe Identity verification fields to cleaner_profiles.
-- ============================================================================

ALTER TABLE cleaner_profiles
  ADD COLUMN IF NOT EXISTS stripe_identity_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_identity_status text
    CHECK (stripe_identity_status IN ('not_started','processing','verified','requires_input','canceled')),
  ADD COLUMN IF NOT EXISTS stripe_identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_identity_first_name text,
  ADD COLUMN IF NOT EXISTS stripe_identity_last_name text,
  ADD COLUMN IF NOT EXISTS stripe_identity_dob date,
  ADD COLUMN IF NOT EXISTS stripe_identity_last_error text;

CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_identity_session
  ON cleaner_profiles (stripe_identity_session_id)
  WHERE stripe_identity_session_id IS NOT NULL;
