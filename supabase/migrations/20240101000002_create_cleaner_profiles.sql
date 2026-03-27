-- Migration: create_cleaner_profiles
-- Table: public.cleaner_profiles
-- Extended profile for users who are also cleaners.
-- The primary key (id) maps 1:1 to auth.users(id) and to profiles(id).
-- Upserted via upsertCleanerProfile() in api.ts with onConflict: "id".
-- Queried by: searchCleaners (filter by is_available, city, order by avg_rating)
--             fetchCleaner   (filter by id)

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.cleaner_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  avatar_url      TEXT,
  bio             TEXT,
  city            TEXT,
  -- "privato" | "azienda"
  cleaner_type    TEXT CHECK (cleaner_type IN ('privato', 'azienda')),
  hourly_rate     NUMERIC(10, 2),
  -- Array of service names (e.g. ["Pulizia ordinaria", "Stiratura"])
  services        TEXT[],
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  avg_rating      NUMERIC(3, 2) NOT NULL DEFAULT 0,
  review_count    INTEGER NOT NULL DEFAULT 0,
  distance_km     NUMERIC(8, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS (MANDATORY)
ALTER TABLE public.cleaner_profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Anyone authenticated can browse available cleaners (marketplace listing).
CREATE POLICY "authenticated users can read cleaner profiles"
  ON public.cleaner_profiles FOR SELECT
  TO authenticated
  USING (true);

-- A cleaner can only insert their own profile row.
CREATE POLICY "cleaners can insert own profile"
  ON public.cleaner_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A cleaner can only update their own profile row.
CREATE POLICY "cleaners can update own profile"
  ON public.cleaner_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- A cleaner can only delete their own profile row.
CREATE POLICY "cleaners can delete own profile"
  ON public.cleaner_profiles FOR DELETE
  USING (auth.uid() = id);

-- 4. Indexes
-- searchCleaners filters by is_available and orders by avg_rating.
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_is_available
  ON public.cleaner_profiles (is_available);

CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_avg_rating
  ON public.cleaner_profiles (avg_rating DESC);

-- searchCleaners optionally filters by city (ILIKE).
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_city
  ON public.cleaner_profiles (city);

-- 5. Auto-update updated_at trigger
CREATE TRIGGER set_cleaner_profiles_updated_at
  BEFORE UPDATE ON public.cleaner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
