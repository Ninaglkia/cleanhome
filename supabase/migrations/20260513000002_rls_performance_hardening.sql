-- ─────────────────────────────────────────────────────────────────────
-- RLS performance hardening — closes 62 WARN advisors:
--   * auth_rls_initplan (39): wrap auth.uid() / auth.role() in subselect
--     so Postgres evaluates them once per query, not per row
--   * multiple_permissive_policies (22): drop duplicates and consolidate
--     overlapping user+admin SELECT/UPDATE policies into single OR'd ones
--   * unindexed_foreign_keys (1): add index on reviews.client_id
--
-- Snapshot of policies after the four sub-migrations applied via MCP:
--   20260513080236 rls_initplan_wrap_auth_uid
--   20260513080301 rls_consolidate_duplicate_policies
--   20260513080308 add_index_reviews_client_id
--   20260513080326 rls_profiles_drop_duplicate_update_policy
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON public.reviews(client_id);

-- bookings: consolidate user+admin SELECT into one policy
DROP POLICY IF EXISTS "Users can read own bookings" ON public.bookings;
DROP POLICY IF EXISTS "admins can read all bookings" ON public.bookings;
DROP POLICY IF EXISTS "users and admins can read bookings" ON public.bookings;
CREATE POLICY "users and admins can read bookings" ON public.bookings
  FOR SELECT
  USING (
    (SELECT auth.uid()) = client_id
    OR (SELECT auth.uid()) = cleaner_id
    OR is_admin((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;
CREATE POLICY "Clients can create bookings" ON public.bookings
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = client_id);

DROP POLICY IF EXISTS "Participants can update bookings" ON public.bookings;
CREATE POLICY "Participants can update bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = client_id OR (SELECT auth.uid()) = cleaner_id)
  WITH CHECK ((SELECT auth.uid()) = client_id OR (SELECT auth.uid()) = cleaner_id);

DROP POLICY IF EXISTS "clients can delete bookings before acceptance" ON public.bookings;
CREATE POLICY "clients can delete bookings before acceptance" ON public.bookings
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = client_id
    AND status = ANY (ARRAY['pending'::text, 'open'::text, 'auto_cancelled'::text, 'declined'::text])
  );

-- disputes: consolidate user+admin SELECT
DROP POLICY IF EXISTS "Users can read own disputes" ON public.disputes;
DROP POLICY IF EXISTS "admins can read all disputes" ON public.disputes;
DROP POLICY IF EXISTS "participants and admins can read disputes" ON public.disputes;
CREATE POLICY "participants and admins can read disputes" ON public.disputes
  FOR SELECT
  USING (
    (SELECT auth.uid()) = client_id
    OR (SELECT auth.uid()) = cleaner_id
    OR is_admin((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Clients can create disputes" ON public.disputes;
CREATE POLICY "Clients can create disputes" ON public.disputes
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = client_id);

DROP POLICY IF EXISTS "admins can update disputes" ON public.disputes;
CREATE POLICY "admins can update disputes" ON public.disputes
  FOR UPDATE
  USING (is_admin((SELECT auth.uid())))
  WITH CHECK (is_admin((SELECT auth.uid())));

-- booking_offers: consolidate 3 SELECT policies into one
DROP POLICY IF EXISTS "Cleaners can read own offers" ON public.booking_offers;
DROP POLICY IF EXISTS "Clients can read offers for own bookings" ON public.booking_offers;
DROP POLICY IF EXISTS "admins can read all offers" ON public.booking_offers;
DROP POLICY IF EXISTS "authorized users can read booking offers" ON public.booking_offers;
CREATE POLICY "authorized users can read booking offers" ON public.booking_offers
  FOR SELECT TO authenticated
  USING (
    is_admin((SELECT auth.uid()))
    OR (SELECT auth.uid()) = cleaner_id
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_offers.booking_id
        AND b.client_id = (SELECT auth.uid())
    )
  );

-- contact_violations: drop conflicting ALL policy with qual=false (blocked admins)
DROP POLICY IF EXISTS "admin only" ON public.contact_violations;

-- profiles: drop duplicate update policy (pascal-case without WITH CHECK was
-- shadowing the lowercase version with WITH CHECK); also drop redundant
-- "users can read own profile" since "Users can read any profile" already
-- allows anyone-readable rows.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "users can read own profile" ON public.profiles;

-- All remaining policies on profiles, client_properties, cleaner_*,
-- messages, notifications, payouts, support_*, reviews, booking_photos,
-- device_tokens, booking_offers (insert/update/delete) were rewritten
-- in-place via the rls_initplan_wrap_auth_uid migration so their
-- auth.uid()/auth.role() calls now use (SELECT auth.uid()).
-- See 20260513080236_rls_initplan_wrap_auth_uid in the remote history.
