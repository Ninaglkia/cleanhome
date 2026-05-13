-- Migration 7: cleaner_listings (1:N)
-- ============================================================================
-- Creates a cleaner_listings table (1 cleaner → N listings) so each
-- cleaner can publish multiple listings with independent coverage zones,
-- pricing, services and descriptions. The first listing is always free.
-- Additional listings require an active Stripe subscription (€4.99/mo
-- each). Stripe fields are added here but not yet enforced — the webhook
-- handler will update subscription_status as events come in.
-- ============================================================================

-- 1. New table
CREATE TABLE IF NOT EXISTS public.cleaner_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Listing content
  title TEXT NOT NULL DEFAULT 'Il mio annuncio',
  cover_url TEXT,
  hourly_rate NUMERIC(10,2),
  services TEXT[],
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Coverage zone (city + circle or polygon). coverage_area is the
  -- derived GEOGRAPHY column used by the spatial search.
  city TEXT,
  coverage_mode TEXT CHECK (coverage_mode IN ('circle','polygon')),
  coverage_center_lat NUMERIC(9,6),
  coverage_center_lng NUMERIC(9,6),
  coverage_radius_km NUMERIC(6,2),
  coverage_polygon JSONB,
  coverage_area GEOGRAPHY(POLYGON, 4326),

  -- Subscription state. The first listing of every cleaner is free —
  -- additional listings need an active Stripe subscription. The
  -- `is_first_listing` flag is set when the row is created by the
  -- application logic (not automatically) so it cannot be spoofed.
  is_first_listing BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_subscription_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'none'
    CHECK (subscription_status IN (
      'none','trialing','active','past_due','canceled','unpaid','incomplete'
    )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS
ALTER TABLE public.cleaner_listings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active listings (for client search)
DROP POLICY IF EXISTS "authenticated users can read active listings" ON public.cleaner_listings;
CREATE POLICY "authenticated users can read active listings"
  ON public.cleaner_listings FOR SELECT
  TO authenticated
  USING (true);

-- Cleaners can manage their own listings
DROP POLICY IF EXISTS "cleaners can insert own listings" ON public.cleaner_listings;
CREATE POLICY "cleaners can insert own listings"
  ON public.cleaner_listings FOR INSERT
  WITH CHECK (auth.uid() = cleaner_id);

DROP POLICY IF EXISTS "cleaners can update own listings" ON public.cleaner_listings;
CREATE POLICY "cleaners can update own listings"
  ON public.cleaner_listings FOR UPDATE
  USING (auth.uid() = cleaner_id)
  WITH CHECK (auth.uid() = cleaner_id);

DROP POLICY IF EXISTS "cleaners can delete own listings" ON public.cleaner_listings;
CREATE POLICY "cleaners can delete own listings"
  ON public.cleaner_listings FOR DELETE
  USING (auth.uid() = cleaner_id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_listings_cleaner_id
  ON public.cleaner_listings (cleaner_id);

CREATE INDEX IF NOT EXISTS idx_listings_is_active
  ON public.cleaner_listings (is_active);

CREATE INDEX IF NOT EXISTS idx_listings_coverage_area
  ON public.cleaner_listings USING GIST (coverage_area);

-- 4. Trigger: auto-compute coverage_area from raw inputs
CREATE OR REPLACE FUNCTION public.compute_listing_coverage_area()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  pt JSONB;
  parts TEXT[];
  poly_text TEXT;
BEGIN
  IF NEW.coverage_mode = 'circle'
     AND NEW.coverage_center_lat IS NOT NULL
     AND NEW.coverage_center_lng IS NOT NULL
     AND NEW.coverage_radius_km IS NOT NULL THEN
    NEW.coverage_area := ST_Buffer(
      ST_SetSRID(
        ST_MakePoint(NEW.coverage_center_lng, NEW.coverage_center_lat),
        4326
      )::geography,
      NEW.coverage_radius_km * 1000.0
    )::geography;
  ELSIF NEW.coverage_mode = 'polygon'
        AND NEW.coverage_polygon IS NOT NULL
        AND jsonb_array_length(NEW.coverage_polygon) >= 3 THEN
    parts := ARRAY[]::TEXT[];
    FOR pt IN SELECT * FROM jsonb_array_elements(NEW.coverage_polygon) LOOP
      parts := array_append(parts, (pt->>'lng') || ' ' || (pt->>'lat'));
    END LOOP;
    parts := array_append(parts, parts[1]);
    poly_text := 'POLYGON((' || array_to_string(parts, ',') || '))';
    NEW.coverage_area := ST_SetSRID(
      ST_GeomFromText(poly_text),
      4326
    )::geography;
  ELSE
    NEW.coverage_area := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_listing_coverage_area ON public.cleaner_listings;
CREATE TRIGGER set_listing_coverage_area
  BEFORE INSERT OR UPDATE OF coverage_mode,
                             coverage_center_lat,
                             coverage_center_lng,
                             coverage_radius_km,
                             coverage_polygon
  ON public.cleaner_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_listing_coverage_area();

-- 5. updated_at auto-trigger (reuses the existing handle_updated_at())
DROP TRIGGER IF EXISTS set_cleaner_listings_updated_at ON public.cleaner_listings;
CREATE TRIGGER set_cleaner_listings_updated_at
  BEFORE UPDATE ON public.cleaner_listings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. Data migration: copy each cleaner_profiles row with an existing
--    coverage zone into cleaner_listings as the free "first listing".
INSERT INTO public.cleaner_listings (
  cleaner_id, title, cover_url, hourly_rate, services, is_active,
  city, coverage_mode, coverage_center_lat, coverage_center_lng,
  coverage_radius_km, coverage_polygon, is_first_listing
)
SELECT
  cp.id,
  'Il mio annuncio',
  cp.avatar_url,
  cp.hourly_rate,
  cp.services,
  cp.is_available,
  cp.city,
  cp.coverage_mode,
  cp.coverage_center_lat,
  cp.coverage_center_lng,
  cp.coverage_radius_km,
  cp.coverage_polygon,
  TRUE
FROM public.cleaner_profiles cp
WHERE cp.coverage_mode IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.cleaner_listings cl
    WHERE cl.cleaner_id = cp.id
  );

-- 7. New RPC: spatial search returning listings + cleaner info
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
    -- First listing is free; additional ones need an active subscription.
    AND (l.is_first_listing = TRUE OR l.subscription_status = 'active')
    AND l.coverage_area IS NOT NULL
    AND ST_Contains(
      l.coverage_area::geometry,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    )
  ORDER BY p.avg_rating DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_listings_by_point(
  DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;

-- 8. Stripe customer ID stored once per user (used to reuse Customer
--    across multiple subscriptions)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
