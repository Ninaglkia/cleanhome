-- SMS notifications (best-effort) — fire a Twilio SMS for high-value booking
-- events by POSTing to the send-sms edge function whenever a notification of a
-- selected type is inserted. Fully decoupled: no change to payment functions.
--
-- Safety:
--  * Only a curated set of types trigger an SMS (cost control).
--  * Reads the shared cron_secret from Vault (same secret the crons use) and
--    passes it as x-cron-secret so send-sms can authenticate the call.
--  * Wrapped in EXCEPTION WHEN OTHERS so an SMS failure can NEVER block the
--    notification insert or any booking flow.
--  * send-sms itself no-ops when Twilio secrets / the user's phone are missing.

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
  v_message text;
BEGIN
  -- Only SMS the high-value events (keep cost down; the rest stay push/in-app).
  IF NEW.type NOT IN (
    'new_booking_request',
    'booking_accepted',
    'booking_accepted_by_self',
    'booking_work_done',
    'booking_payout_released',
    'booking_auto_cancelled',
    'booking_canceled',
    'booking_disputed'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_cron_secret IS NULL THEN
    RETURN NEW; -- no secret configured → skip SMS silently
  END IF;

  v_message := 'CleanHome — ' || COALESCE(NEW.title, '') ||
               CASE WHEN NEW.body IS NOT NULL AND NEW.body <> '' THEN ': ' || NEW.body ELSE '' END;

  PERFORM net.http_post(
    url := v_project_url || '/functions/v1/send-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'x-cron-secret', v_cron_secret
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'message', v_message
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let an SMS hiccup break the notification insert / booking flow.
  RAISE WARNING 'notify_sms_on_notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sms ON public.notifications;
CREATE TRIGGER trg_notify_sms
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sms_on_notification();
