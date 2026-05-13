-- Migration: respect role + phone from signup metadata
--
-- Background: register.tsx collects "cliente"/"professionista" + phone,
-- but the original handle_new_user trigger hardcoded active_role='client'
-- and ignored everything else in raw_user_meta_data beyond full_name.
-- Net effect: every new "Professionista" signup landed as a client and
-- their phone was discarded. Fixing both at the source of truth.

-- 1) Add the phone column on profiles (safe to add NULL — existing rows
--    keep NULL, no backfill needed).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.profiles.phone IS
  'E.164-ish phone number captured at signup (e.g. +393331234567). Optional.';

-- 2) Replace the trigger so it reads role + phone from raw_user_meta_data.
--    Mapping: "professionista" or "cleaner" -> active_role='cleaner';
--    anything else (incl. unset, "cliente", "client") -> 'client'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta_role TEXT;
  resolved_role TEXT;
BEGIN
  meta_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', ''));
  resolved_role := CASE
    WHEN meta_role IN ('professionista', 'cleaner') THEN 'cleaner'
    ELSE 'client'
  END;

  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    active_role,
    cleaner_onboarded,
    phone
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    resolved_role,
    FALSE,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
