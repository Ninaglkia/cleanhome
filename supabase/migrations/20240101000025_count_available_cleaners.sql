-- Used by client app BEFORE payment to show "X cleaner disponibili"
-- and avoid bookings that will fail with "no cleaner accepted"
CREATE OR REPLACE FUNCTION public.count_available_cleaners(
  lat double precision,
  lng double precision,
  radius_km double precision DEFAULT 15
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  WITH ranked AS (
    SELECT
      l.cleaner_id,
      extensions.ST_Distance(
        extensions.ST_SetSRID(extensions.ST_MakePoint(l.coverage_center_lng, l.coverage_center_lat), 4326)::extensions.geography,
        extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
      ) AS distance_m,
      p.avg_rating
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
  )
  SELECT jsonb_build_object(
    'total', COUNT(DISTINCT cleaner_id),
    'within_5km', COUNT(DISTINCT cleaner_id) FILTER (WHERE distance_m <= 5000),
    'within_15km', COUNT(DISTINCT cleaner_id) FILTER (WHERE distance_m <= 15000),
    'avg_rating', ROUND(AVG(avg_rating)::numeric, 2)
  )
  FROM ranked;
$$;

COMMENT ON FUNCTION public.count_available_cleaners IS
  'Pre-validation: how many active+verified cleaners cover this geo. Lets the client app warn the user before paying if no cleaners are available.';
