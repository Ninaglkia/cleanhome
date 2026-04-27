-- Migration 14: cleaner_setup_progress
-- ============================================================================
-- Adds two columns to profiles so the onboarding wizard for cleaners can
-- persist its step-by-step state server-side, and the app can skip the
-- wizard once setup is complete.
--
-- cleaner_setup_progress: free-form JSONB to track which steps have been
--   completed (e.g. { "profile": true, "documents": true, "listing": false })
--
-- cleaner_setup_complete: boolean flag flipped to true when all required
--   onboarding steps are done. Allows fast filter queries on the profiles
--   table without decoding JSONB.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cleaner_setup_progress  JSONB    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cleaner_setup_complete  BOOLEAN  NOT NULL DEFAULT FALSE;

-- Index for querying incomplete cleaners (admin dashboard / onboarding
-- reminder jobs). Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_profiles_cleaner_setup_incomplete
  ON public.profiles (id)
  WHERE cleaner_setup_complete = FALSE;
