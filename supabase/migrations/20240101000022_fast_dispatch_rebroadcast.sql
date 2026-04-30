-- Fast dispatch with auto-rebroadcast: track search location + escalation step
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS search_lat        numeric,
  ADD COLUMN IF NOT EXISTS search_lng        numeric,
  ADD COLUMN IF NOT EXISTS broadcast_step    smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_broadcast_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_bookings_open_escalation
  ON public.bookings (cleaner_deadline, broadcast_step)
  WHERE status = 'open';

COMMENT ON COLUMN public.bookings.broadcast_step IS '0=initial 5km, 1=expanded 15km, 2=final → refund if no accept';
COMMENT ON COLUMN public.bookings.search_lat IS 'Stored at booking time so rebroadcast cron can re-search by location';

-- RPC for distance-based search (used by auto-cancel rebroadcast)
CREATE OR REPLACE FUNCTION public.search_listings_within_radius(
  lat double precision,
  lng double precision,
  radius_km double precision
)
RETURNS TABLE(listing_id uuid, cleaner_id uuid, distance_m double precision)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT
    l.id AS listing_id,
    l.cleaner_id,
    extensions.ST_Distance(
      extensions.ST_SetSRID(extensions.ST_MakePoint(l.coverage_center_lng, l.coverage_center_lat), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
    ) AS distance_m
  FROM public.cleaner_listings l
  JOIN public.cleaner_profiles p ON p.id = l.cleaner_id
  WHERE l.is_active
    AND (l.is_first_listing OR l.subscription_status = 'active')
    AND p.stripe_onboarding_complete
    AND p.stripe_charges_enabled
    AND l.coverage_center_lat IS NOT NULL
    AND l.coverage_center_lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(l.coverage_center_lng, l.coverage_center_lat), 4326)::extensions.geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography,
      radius_km * 1000
    )
  ORDER BY distance_m ASC, p.avg_rating DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.search_listings_within_radius IS 'Find cleaner_listings by distance (in km). Used by auto-cancel cron for rebroadcast escalation.';
