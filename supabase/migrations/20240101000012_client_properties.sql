-- Migration: client_properties
-- Table: public.client_properties
-- Saved properties/houses for a client. Lets a client with multiple homes
-- (Airbnb hosts, property managers, privates with a second house) save
-- each property once and reuse it when creating a booking.
--
-- Queried by:
--   fetchClientProperties (filter by client_id, order by is_default DESC,
--                          created_at DESC)
--   createClientProperty  (insert single row)
--   updateClientProperty  (update by id)
--   deleteClientProperty  (delete by id)
--   setDefaultProperty    (update is_default flag + unset others)

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.client_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User-facing label ("Casa mamma", "Airbnb Navigli", "Villa al mare")
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  -- Full street address
  address     TEXT NOT NULL CHECK (length(address) BETWEEN 1 AND 255),
  -- Number of rooms — pre-fills the booking form
  num_rooms   INTEGER NOT NULL DEFAULT 2 CHECK (num_rooms BETWEEN 1 AND 50),
  -- Optional surface in square meters
  sqm         INTEGER CHECK (sqm IS NULL OR (sqm BETWEEN 10 AND 2000)),
  -- Always-on notes the cleaner will see ("keys from the doorman", "cat inside")
  notes       TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  -- Optional cover photo
  photo_url   TEXT,
  -- One property per client can be flagged as default (first in list)
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS (MANDATORY)
ALTER TABLE public.client_properties ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies — a client only sees/manages their own properties
CREATE POLICY "clients can read own properties"
  ON public.client_properties FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "clients can insert own properties"
  ON public.client_properties FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "clients can update own properties"
  ON public.client_properties FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "clients can delete own properties"
  ON public.client_properties FOR DELETE
  USING (auth.uid() = client_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_client_properties_client_id
  ON public.client_properties (client_id);

-- Default property lookup: filter by client_id then is_default.
CREATE INDEX IF NOT EXISTS idx_client_properties_client_default
  ON public.client_properties (client_id, is_default DESC);

-- 5. Enforce AT MOST ONE default per client — when a row is inserted or
--    flipped to is_default=true, unset any previously-default row for
--    that same client. Keeps the UI invariant simple on read.
CREATE OR REPLACE FUNCTION public.enforce_single_default_property()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE public.client_properties
       SET is_default = FALSE
     WHERE client_id = NEW.client_id
       AND id <> NEW.id
       AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_default_property
  AFTER INSERT OR UPDATE OF is_default ON public.client_properties
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION public.enforce_single_default_property();

-- 6. updated_at auto-touch (reuse the shared helper created in
--    20240101000001_create_profiles.sql)
CREATE TRIGGER set_client_properties_updated_at
  BEFORE UPDATE ON public.client_properties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Link a booking to the property it was created from (optional, useful
--    for history per-property). Nullable for backward compatibility with
--    existing bookings.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.client_properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_property_id
  ON public.bookings (property_id);
