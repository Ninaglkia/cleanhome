-- Migration 18: cleaner_listings — restrict SELECT RLS to active listings
-- ============================================================================
-- Replaces the overly-permissive "authenticated users can read active listings"
-- policy (USING true — exposes ALL listings including inactive/past_due/canceled)
-- with two targeted policies:
--
--   1. Public read: only listings that are genuinely searchable by clients
--      (is_active=TRUE and subscription in a paying state).
--
--   2. Owner read: a cleaner can always see their own listings, even when
--      inactive, so they can manage and reactivate them.
--
-- The broad USING(true) policy was a HIGH security issue because it let any
-- authenticated user read deactivated listings, past_due listings, and
-- listings belonging to churned cleaners — leaking business data.
-- ============================================================================

-- Drop the broad policy created in migration 007.
DROP POLICY IF EXISTS "authenticated users can read active listings"
  ON public.cleaner_listings;

-- ── Policy 1: public reads active listings ───────────────────────────────────
-- Clients (and any authenticated user) can only discover listings that are
-- currently live: is_active must be TRUE and the subscription must be in a
-- funded state (excludes 'past_due' and 'canceled').
-- is_first_listing=TRUE listings are always free — their subscription_status
-- stays 'none', which is intentionally NOT in the exclusion list.
DROP POLICY IF EXISTS "public reads active listings" ON public.cleaner_listings;
CREATE POLICY "public reads active listings"
  ON public.cleaner_listings FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND subscription_status NOT IN ('past_due', 'canceled')
  );

-- ── Policy 2: cleaner reads own listings ─────────────────────────────────────
-- A cleaner can read all of their own listings regardless of active/inactive
-- state, so they can see, edit, and manage inactive listings from their dashboard.
DROP POLICY IF EXISTS "cleaner reads own listings" ON public.cleaner_listings;
CREATE POLICY "cleaner reads own listings"
  ON public.cleaner_listings FOR SELECT
  TO authenticated
  USING (auth.uid() = cleaner_id);
