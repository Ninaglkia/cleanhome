-- Migration: tighten profiles SELECT policy
--
-- Migration 10 widened `profiles` SELECT to any authenticated user so
-- that the client-side `sendPushNotification` helper could look up the
-- recipient's push token. That enabled a token-enumeration attack:
-- anyone logged in could dump every user's push token and spam them.
--
-- We've now moved push delivery to a server-side Edge Function
-- (supabase/functions/send-push-notification) which uses the service
-- role to read tokens. The broad SELECT is no longer needed, so we
-- revert it to "own profile only".

DROP POLICY IF EXISTS "authenticated can read profiles" ON public.profiles;

-- Users can read their own profile row only. Public profile data
-- (names, avatars) is read via the `cleaner_profiles` view which has
-- its own authenticated-read policy.
DROP POLICY IF EXISTS "users can read own profile" ON public.profiles;
CREATE POLICY "users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
