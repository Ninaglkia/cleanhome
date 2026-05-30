-- Fix: escrow auto-confirm cron must also release payouts for bookings the
-- cleaner marked as 'work_done' (the cleaner UI sets status='work_done' via
-- markWorkDone, not 'accepted'). Previously this WHERE clause only matched
-- status='accepted', so cleaner-marked jobs were NEVER auto-confirmed after
-- 48h and the escrowed funds stayed stuck on the platform balance.
--
-- Paired with booking-confirm-completion accepting both 'accepted' and
-- 'work_done' as a valid pre-state. CREATE OR REPLACE so the live DB picks it
-- up (the pg_cron schedule keeps calling this same function name).

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
    WHERE status IN ('accepted', 'work_done')
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
