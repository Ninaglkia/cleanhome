-- Migration: add_cleaner_coverage_zone
-- Adds geographic coverage zone to cleaner_profiles so that a cleaner
-- can declare the area they serve (either a circle or a freeform polygon).
-- Clients search by their own GPS point and get back ONLY cleaners whose
-- coverage zone actually contains that point.
--
-- Design:
--  - Raw inputs (mode + circle params OR polygon vertices) are stored as
--    regular columns / JSONB so the RN client only has to write scalars.
--  - A BEFORE trigger converts those raw inputs into a single GEOGRAPHY
--    column (`coverage_area`) that PostGIS can index + query in one shot.
--  - A STABLE SQL function `search_cleaners_by_point(lat, lng)` is exposed
--    via supabase.rpc() and runs the ST_Contains spatial query.

-- 1. PostGIS extension (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. New columns on cleaner_profiles
ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS coverage_mode TEXT
    CHECK (coverage_mode IN ('circle','polygon')),
  ADD COLUMN IF NOT EXISTS coverage_center_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS coverage_center_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS coverage_radius_km NUMERIC(6,2),
  -- Raw polygon vertices stored as JSONB: [{"lat":..,"lng":..}, …]
  ADD COLUMN IF NOT EXISTS coverage_polygon JSONB,
  -- Derived column used by spatial queries (filled by trigger).
  ADD COLUMN IF NOT EXISTS coverage_area GEOGRAPHY(POLYGON, 4326);

-- 3. GIST index for fast ST_Contains queries
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_coverage_area
  ON public.cleaner_profiles
  USING GIST (coverage_area);

-- 4. Trigger: recompute coverage_area from the raw inputs whenever any of
--    them changes. This way the RN client never has to build WKT strings.
CREATE OR REPLACE FUNCTION public.compute_cleaner_coverage_area()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  poly_text TEXT;
  pt JSONB;
  parts TEXT[];
BEGIN
  IF NEW.coverage_mode = 'circle'
     AND NEW.coverage_center_lat IS NOT NULL
     AND NEW.coverage_center_lng IS NOT NULL
     AND NEW.coverage_radius_km IS NOT NULL THEN
    -- Buffer a geography point by the radius (meters) — this gives a
    -- ring polygon that ST_Contains can index.
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
    -- Build a WKT POLYGON from the JSON array of {lat,lng}.
    parts := ARRAY[]::TEXT[];
    FOR pt IN SELECT * FROM jsonb_array_elements(NEW.coverage_polygon) LOOP
      parts := array_append(
        parts,
        (pt->>'lng') || ' ' || (pt->>'lat')
      );
    END LOOP;
    -- Close the ring by repeating the first vertex.
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

DROP TRIGGER IF EXISTS set_cleaner_coverage_area ON public.cleaner_profiles;
CREATE TRIGGER set_cleaner_coverage_area
  BEFORE INSERT OR UPDATE OF coverage_mode,
                             coverage_center_lat,
                             coverage_center_lng,
                             coverage_radius_km,
                             coverage_polygon
  ON public.cleaner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_cleaner_coverage_area();

-- 5. RPC: spatial search. Returns every available cleaner whose zone
--    contains the given customer point. Call from the RN client via
--    supabase.rpc('search_cleaners_by_point', { lat, lng }).
CREATE OR REPLACE FUNCTION public.search_cleaners_by_point(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
RETURNS SETOF public.cleaner_profiles
LANGUAGE SQL
STABLE
AS $$
  SELECT *
  FROM public.cleaner_profiles
  WHERE is_available = TRUE
    AND coverage_area IS NOT NULL
    AND ST_Contains(
      coverage_area::geometry,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    )
  ORDER BY avg_rating DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_cleaners_by_point(
  DOUBLE PRECISION, DOUBLE PRECISION
) TO anon, authenticated;
