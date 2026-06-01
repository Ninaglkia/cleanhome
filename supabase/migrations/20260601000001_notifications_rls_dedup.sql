-- Performance/cleanup: notifications had duplicate RLS policies (old + reconcile
-- versions both present) and one variant re-evaluated auth.uid() per row + a
-- SELECT/UPDATE pair missing a WITH CHECK. Collapse to one canonical policy per
-- action, using (select auth.uid()) so it is evaluated once per query.
-- Behaviour is unchanged (a user can read/update only their own notifications).

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users update own notifications (mark read)" ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
