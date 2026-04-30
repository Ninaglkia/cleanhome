-- Auto-confirm bookings 48h after work_done_at if client took no action.
-- Calls booking-confirm-completion edge function via pg_net.
--
-- PRE-REQ: vault.create_secret('<service_role_jwt>', 'service_role_key')
-- must have been run separately (jwt is not in source control).

CREATE OR REPLACE FUNCTION public.cron_auto_confirm_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_service_key text;
  v_project_url text := 'https://tnuipmzksryfmhsctcud.supabase.co';
  v_booking record;
BEGIN
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE WARNING 'service_role_key not found in vault — cron skipped';
    RETURN;
  END IF;

  FOR v_booking IN
    SELECT id
    FROM public.bookings
    WHERE status = 'accepted'
      AND work_done_at IS NOT NULL
      AND work_done_at < (now() - interval '48 hours')
      AND client_confirmed_at IS NULL
      AND client_dispute_opened_at IS NULL
      AND payout_blocked = true
      AND (payment_status IS NULL OR payment_status <> 'refunded')
    LIMIT 50
  LOOP
    PERFORM net.http_post(
      url := v_project_url || '/functions/v1/booking-confirm-completion',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'booking_id', v_booking.id,
        'source', 'cron'
      ),
      timeout_milliseconds := 10000
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.cron_auto_confirm_bookings() IS
  'Cron entrypoint: finds bookings whose 48h client review window expired, calls booking-confirm-completion to release payout to cleaner. Idempotent (edge function checks state).';

-- Schedule every 10 minutes (idempotent: cron.schedule fails if name exists, so guard)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-confirm-bookings') THEN
    PERFORM cron.schedule(
      'auto-confirm-bookings',
      '*/10 * * * *',
      $cron$ SELECT public.cron_auto_confirm_bookings(); $cron$
    );
  END IF;
END $$;
