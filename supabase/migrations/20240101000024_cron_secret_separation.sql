-- Replace cron auto-confirm function: use cron_secret (NOT service_role_key)
-- and pass it via x-cron-secret header. Authorization carries anon JWT only,
-- which is required by Supabase Edge Functions but no longer authoritative.
--
-- PRE-REQ: vault.create_secret('<random-hex>', 'cron_secret') must be set.

CREATE OR REPLACE FUNCTION public.cron_auto_confirm_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cron_secret text;
  v_project_url text := 'https://tnuipmzksryfmhsctcud.supabase.co';
  v_anon_key    text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudWlwbXprc3J5Zm1oc2N0Y3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTM5MDcsImV4cCI6MjA5MDA4OTkwN30.fvsZ3v4A2kwKmxQiHAgk8gaH4m3lZF841pUJ6bwjFPo';
  v_booking record;
BEGIN
  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_cron_secret IS NULL THEN
    RAISE WARNING 'cron_secret not in vault — cron skipped';
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
        'Authorization', 'Bearer ' || v_anon_key,
        'x-cron-secret', v_cron_secret
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

-- Re-schedule auto-cancel cron with x-cron-secret header
DO $$
DECLARE
  v_cron_secret text;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudWlwbXprc3J5Zm1oc2N0Y3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTM5MDcsImV4cCI6MjA5MDA4OTkwN30.fvsZ3v4A2kwKmxQiHAgk8gaH4m3lZF841pUJ6bwjFPo';
BEGIN
  SELECT decrypted_secret INTO v_cron_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_cron_secret IS NULL THEN RETURN; END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'auto-cancel-expired-bookings';

  PERFORM cron.schedule(
    'auto-cancel-expired-bookings',
    '*/5 * * * *',
    format(
      $cron$
      SELECT extensions.net.http_post(
        url := 'https://tnuipmzksryfmhsctcud.supabase.co/functions/v1/auto-cancel-expired-bookings',
        body := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s',
          'x-cron-secret', %L
        )
      );
      $cron$,
      v_anon_key,
      v_cron_secret
    )
  );
END $$;
