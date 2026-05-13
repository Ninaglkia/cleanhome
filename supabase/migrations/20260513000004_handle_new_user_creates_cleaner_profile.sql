-- Make handle_new_user also create a public.cleaner_profiles row when
-- the new auth.users record signs up as a professionista.
--
-- Without this, every cleaner-side Edge Function that joins on
-- cleaner_profiles (stripe-connect-onboarding-link, payouts, etc.)
-- returns 404 "Profilo professionista non trovato" right after signup
-- until the user happens to hit something that lazily creates it.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  meta_role TEXT;
  resolved_role TEXT;
  resolved_full_name TEXT;
BEGIN
  meta_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', ''));
  resolved_role := CASE
    WHEN meta_role IN ('professionista', 'cleaner') THEN 'cleaner'
    ELSE 'client'
  END;

  resolved_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );

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
    resolved_full_name,
    NEW.raw_user_meta_data->>'avatar_url',
    resolved_role,
    FALSE,
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  IF resolved_role = 'cleaner' THEN
    INSERT INTO public.cleaner_profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NULLIF(resolved_full_name, ''), 'Cleaner'))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
