-- Migration: add push notification token columns to profiles
--
-- CleanHome uses Expo Push (exp.host) as the primary delivery channel
-- and keeps the raw FCM/APNs token as a fallback. The client writes to
-- these columns after requesting notification permissions (see
-- lib/notifications.ts → savePushToken).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT,
  ADD COLUMN IF NOT EXISTS fcm_token       TEXT,
  ADD COLUMN IF NOT EXISTS device_platform TEXT;

-- Index so the "lookup target user's token before sending a push" path
-- stays O(log n) as the table grows.
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token
  ON public.profiles (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

-- RLS: the existing "users can update own profile" policy already covers
-- UPDATE on these new columns. For SELECT we need authenticated users to
-- be able to read another user's push token so `sendPushNotification()`
-- on the client can look up the recipient. The profiles table does NOT
-- contain emails or other sensitive data (emails live in auth.users),
-- so widening SELECT to all authenticated users is acceptable.
--
-- NOTE: for a stricter model, move push delivery into an Edge Function
-- with the service_role key and remove this policy. See
-- lib/notifications.ts → sendPushNotification.

DROP POLICY IF EXISTS "users can read own profile" ON public.profiles;

CREATE POLICY "authenticated can read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
