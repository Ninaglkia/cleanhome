-- SMS notification trigger — v2
-- Changes vs v1 (20260601000002):
--   1. new_booking_request: link now uses universal link (https://cleanhomeapp.com/booking/<id>)
--      instead of custom-scheme cleanhome:// to open the app directly from SMS on iOS/Android.
--   2. All other types: appends universal booking link when metadata contains booking_id.
--   3. Cleaner name in booking_accepted body is handled at the Edge Function level
--      (stripe-booking-action); the trigger just forwards title/body as-is.
--
-- Safety guarantees (unchanged):
--   - SECURITY DEFINER + fixed search_path
--   - cron_secret read from Vault (NULL → early return, no SMS sent)
--   - Curated type allowlist (cost control, no spam)
--   - Full EXCEPTION wrapper: SMS failure never blocks the notification INSERT
--   - GSM-7 safe: uses "EUR" not €, avoids curly quotes
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER

CREATE OR REPLACE FUNCTION public.notify_sms_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cron_secret text;
  v_project_url text := 'https://tnuipmzksryfmhsctcud.supabase.co';
  v_anon_key    text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudWlwbXprc3J5Zm1oc2N0Y3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTM5MDcsImV4cCI6MjA5MDA4OTkwN30.fvsZ3v4A2kwKmxQiHAgk8gaH4m3lZF841pUJ6bwjFPo';
  v_message     text;
  v_date        text;
  v_earn        numeric;
  v_booking_id  text;
  v_booking_link text;
BEGIN
  -- Allowlist: only high-value events (cost control)
  IF NEW.type NOT IN (
    'new_booking_request','booking_accepted','booking_accepted_by_self',
    'booking_work_done','booking_payout_released','booking_auto_cancelled',
    'booking_canceled','booking_disputed'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Read shared secret from Vault (absent = Twilio not configured, skip silently)
  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_cron_secret IS NULL THEN RETURN NEW; END IF;

  -- Extract booking_id from metadata (used for universal deep-link)
  v_booking_id := NULLIF(NEW.metadata->>'booking_id', '');
  IF v_booking_id IS NOT NULL THEN
    v_booking_link := 'https://cleanhomeapp.com/booking/' || v_booking_id;
  END IF;

  -- Build message per type
  IF NEW.type = 'new_booking_request' THEN
    BEGIN
      SELECT to_char(b.booking_date, 'DD/MM/YYYY'),
             round((b.base_price - COALESCE(b.cleaner_fee, 0))::numeric, 2)
        INTO v_date, v_earn
      FROM public.bookings b
      WHERE b.id = v_booking_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_date := NULL; v_earn := NULL;
    END;

    v_message := 'CleanHome: hai una nuova richiesta di prenotazione!'
      || COALESCE(' Giorno ' || v_date, '')
      || COALESCE(', guadagno EUR ' || trim(to_char(v_earn, 'FM999990.00')), '')
      || CASE
           WHEN v_booking_link IS NOT NULL
           THEN '. Apri l''app per accettare: ' || v_booking_link
           ELSE '. Apri l''app per accettare.'
         END;

  ELSE
    -- Generic: "CleanHome - <title>: <body>" + optional booking link
    v_message := 'CleanHome - ' || COALESCE(NEW.title, '')
      || CASE WHEN NEW.body IS NOT NULL AND NEW.body <> '' THEN ': ' || NEW.body ELSE '' END
      || CASE
           WHEN v_booking_link IS NOT NULL
           THEN ' Apri l''app: ' || v_booking_link
           ELSE ''
         END;
  END IF;

  -- Fire-and-forget POST to send-sms edge function (5 s timeout)
  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/send-sms',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || v_anon_key,
      'x-cron-secret',  v_cron_secret
    ),
    body    := jsonb_build_object('user_id', NEW.user_id, 'message', v_message),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_sms_on_notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent via DROP IF EXISTS)
DROP TRIGGER IF EXISTS trg_notify_sms ON public.notifications;
CREATE TRIGGER trg_notify_sms
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sms_on_notification();
