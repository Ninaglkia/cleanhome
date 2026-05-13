-- Migration 8: stripe_connect
-- ============================================================================
-- Adds Stripe Connect onboarding state to cleaner_profiles so that a
-- cleaner can (1) start KYC via an AccountLink, (2) become searchable
-- only after Stripe verifies them, and (3) receive booking payouts via
-- destination charges from the platform.
--
-- Related backend pieces:
--   - Edge Function `stripe-connect-onboarding-link`: creates an Express
--     Account for the cleaner the first time they click "Verifica
--     identità" and returns an onboarding URL.
--   - Edge Function `stripe-webhook`: listens for `account.updated` and
--     flips `stripe_onboarding_complete` + `stripe_charges_enabled`
--     when Stripe marks the cleaner as verified.
--   - Edge Function `stripe-booking-payment`: creates a PaymentIntent
--     with `transfer_data.destination = stripe_account_id` and
--     `application_fee_amount` equal to the platform cut.
--
-- Related frontend pieces (implemented next):
--   - Banner "Verifica identità" on /listings for unverified cleaners.
--   - booking/new.tsx calls the new Edge Function and presents the
--     Stripe Payment Sheet (replacing the old Vercel endpoint).
-- ============================================================================

-- 1. Columns on cleaner_profiles
ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Fast lookup index for webhook `account.updated` handler
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_stripe_account_id
  ON public.cleaner_profiles (stripe_account_id);

-- 3. Update the public spatial search RPC so customers only see
--    cleaners who completed Stripe onboarding AND can be charged.
--    This is the security guarantee that we never show a listing we
--    cannot actually pay out to.
CREATE OR REPLACE FUNCTION public.search_listings_by_point(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
RETURNS TABLE (
  listing_id UUID,
  cleaner_id UUID,
  title TEXT,
  cover_url TEXT,
  hourly_rate NUMERIC,
  services TEXT[],
  description TEXT,
  city TEXT,
  coverage_center_lat NUMERIC,
  coverage_center_lng NUMERIC,
  cleaner_name TEXT,
  cleaner_bio TEXT,
  cleaner_type TEXT,
  avg_rating NUMERIC,
  review_count INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    l.id           AS listing_id,
    l.cleaner_id,
    l.title,
    l.cover_url,
    l.hourly_rate,
    l.services,
    l.description,
    l.city,
    l.coverage_center_lat,
    l.coverage_center_lng,
    p.full_name    AS cleaner_name,
    p.bio          AS cleaner_bio,
    p.cleaner_type,
    p.avg_rating,
    p.review_count
  FROM public.cleaner_listings l
  JOIN public.cleaner_profiles p ON p.id = l.cleaner_id
  WHERE l.is_active = TRUE
    AND (l.is_first_listing = TRUE OR l.subscription_status = 'active')
    AND l.coverage_area IS NOT NULL
    -- Stripe Connect gate: only list cleaners who completed KYC
    -- and are authorised to accept charges. Without this the client
    -- could see a listing we cannot pay out to.
    AND p.stripe_onboarding_complete = TRUE
    AND p.stripe_charges_enabled = TRUE
    AND ST_Contains(
      l.coverage_area::geometry,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    )
  ORDER BY p.avg_rating DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_listings_by_point(
  DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;

-- 4. Add a stripe_payment_intent_id on bookings already exists (per
--    20240101000003_create_bookings.sql), so booking → payment mapping
--    is available. Nothing to add here.
