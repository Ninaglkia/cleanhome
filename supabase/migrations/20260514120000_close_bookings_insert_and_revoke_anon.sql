-- ============================================================================
-- CRIT-2 + NEW-1
-- Close client INSERT on bookings (re-introduced by mistake in
-- 20260513080236 rls_initplan_wrap_auth_uid). Bookings must be created
-- ONLY by the stripe-webhook Edge Function running as service_role,
-- because the row's money fields (base_price, total_price, *_fee) must
-- match the actual Stripe charge.
-- Also revoke EXECUTE on ensure_cleaner_profile_on_role_switch from anon
-- (was reachable via /rest/v1/rpc).
-- ============================================================================

DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;

COMMENT ON TABLE public.bookings IS
  'Bookings are inserted by the stripe-webhook Edge Function (service_role) '
  'after a successful PaymentIntent. Direct client INSERT is intentionally '
  'forbidden to prevent price/state manipulation.';

REVOKE EXECUTE ON FUNCTION public.ensure_cleaner_profile_on_role_switch()
  FROM anon, public;
