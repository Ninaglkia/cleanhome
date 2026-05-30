-- Ensure a cleaner_profiles row exists whenever a user becomes a
-- cleaner — either at signup (handle_new_user covers this when
-- meta.role is set) OR later via the "Modalità Professionista" toggle
-- that updates profiles.active_role to 'cleaner'.
--
-- Without this trigger, every user who registered as client and then
-- switched to cleaner inside the app hits a 404 'Profilo professionista
-- non trovato' on the Stripe Connect onboarding endpoint.

CREATE OR REPLACE FUNCTION public.ensure_cleaner_profile_on_role_switch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  full_name_value TEXT;
BEGIN
  IF NEW.active_role = 'cleaner' THEN
    SELECT COALESCE(NULLIF(NEW.full_name, ''), 'Cleaner')
      INTO full_name_value;

    INSERT INTO public.cleaner_profiles (id, full_name)
    VALUES (NEW.id, full_name_value)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_cleaner_profile_on_role_switch
  ON public.profiles;

CREATE TRIGGER ensure_cleaner_profile_on_role_switch
AFTER INSERT OR UPDATE OF active_role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_cleaner_profile_on_role_switch();

-- Backfill: any existing user whose profile is currently set to
-- cleaner but who somehow doesn't yet have a cleaner_profiles row
-- gets one created right now. Safe ON CONFLICT.
INSERT INTO public.cleaner_profiles (id, full_name)
SELECT p.id, COALESCE(NULLIF(p.full_name, ''), 'Cleaner')
FROM public.profiles p
WHERE p.active_role = 'cleaner'
  AND NOT EXISTS (
    SELECT 1 FROM public.cleaner_profiles cp WHERE cp.id = p.id
  )
ON CONFLICT (id) DO NOTHING;
