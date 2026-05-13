-- ─────────────────────────────────────────────────────────────────────
-- Close 17 WARN advisor lints in one pass:
--  1. Set explicit search_path on 3 functions to neutralize role-mutable path
--  2. REVOKE EXECUTE from anon (and authenticated where appropriate)
--     on SECURITY DEFINER functions exposed via /rest/v1/rpc
--  3. Drop overly-broad SELECT policies on public buckets — direct CDN
--     URL access keeps working, only storage.objects.list() is blocked
-- ─────────────────────────────────────────────────────────────────────

-- 1. search_path hardening
ALTER FUNCTION public.count_available_cleaners(double precision, double precision, double precision)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.search_listings_by_point(double precision, double precision)
  SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.touch_support_chat()
  SET search_path = public, pg_temp;

-- 2a. Trigger function — never callable directly
REVOKE EXECUTE ON FUNCTION public.bookings_lock_money_fields() FROM PUBLIC, anon, authenticated;

-- 2b. Cron-only function — only pg_cron service should reach it; revoke broadly
REVOKE EXECUTE ON FUNCTION public.cron_auto_confirm_bookings() FROM PUBLIC, anon, authenticated;

-- 2c. RPC-exposed functions: client-callable only when signed in
REVOKE EXECUTE ON FUNCTION public.count_available_cleaners(double precision, double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_listings_by_point(double precision, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dispatch_accept_offer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;

-- 3. Storage: drop broad SELECT policies on public buckets.
--    Public buckets serve files directly via CDN URL without a SELECT
--    policy; the policy only gates list() calls, which we don't need.
DROP POLICY IF EXISTS "avatars bucket is publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "property photos are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "auth users can read booking photos" ON storage.objects;
