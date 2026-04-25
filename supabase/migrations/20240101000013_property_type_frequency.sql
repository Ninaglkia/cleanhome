-- Migration: property_type + cleaning_frequency
-- Adds two columns to client_properties so the booking flow can
-- differentiate B2C apartments from B2B offices/restaurants and
-- estimate recurring revenue based on the client's preferred cadence.
--
-- property_type      drives pricing model + which detail fields the
--                    creation wizard asks for (sqm vs covers vs desks).
-- cleaning_frequency informs the dispatch engine that the listing is
--                    a recurring contract opportunity, not a one-off.

-- 1. property_type — what kind of property is being cleaned.
ALTER TABLE public.client_properties
  ADD COLUMN IF NOT EXISTS property_type TEXT
    NOT NULL DEFAULT 'apartment'
    CHECK (property_type IN (
      'apartment',
      'house',       -- casa indipendente / villa
      'office',
      'restaurant',
      'bnb',         -- B&B / Airbnb
      'shop',
      'other'
    ));

-- 2. cleaning_frequency — how often the client wants this property
--    cleaned. NULL = no preference set / one-off.
ALTER TABLE public.client_properties
  ADD COLUMN IF NOT EXISTS cleaning_frequency TEXT
    CHECK (cleaning_frequency IS NULL OR cleaning_frequency IN (
      'monthly',       -- 1x/month
      'biweekly',      -- 2x/month
      'weekly',        -- 1x/week (4x/month)
      'twice_weekly'   -- 2x/week (8x/month)
    ));

-- 3. Type-specific extras stored as JSONB so the schema can evolve
--    without further migrations as we tune the wizard. Examples:
--      apartment   -> { typology: 'trilocale', bedrooms: 2, bathrooms: 1 }
--      house       -> { floors: 2, has_garden: true }
--      office      -> { desks: 12 }
--      restaurant  -> { covers: 60, has_kitchen: true }
--      bnb         -> { bedrooms: 3, bathrooms: 2 }
--      shop        -> { has_windows: true }
--      other       -> { description: '...' }
ALTER TABLE public.client_properties
  ADD COLUMN IF NOT EXISTS type_details JSONB
    NOT NULL DEFAULT '{}'::jsonb;

-- 4. Index on property_type so we can quickly slice "all offices in
--    Milan" for B2B-focused dispatch / analytics queries.
CREATE INDEX IF NOT EXISTS idx_client_properties_type
  ON public.client_properties (property_type);

-- 5. Index on (client_id, cleaning_frequency) so a cleaner-side query
--    "show me all my recurring contracts" stays fast as data grows.
CREATE INDEX IF NOT EXISTS idx_client_properties_recurring
  ON public.client_properties (client_id, cleaning_frequency)
  WHERE cleaning_frequency IS NOT NULL;
