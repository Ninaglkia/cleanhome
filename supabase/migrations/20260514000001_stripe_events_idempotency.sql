-- Stripe webhook idempotency table.
--
-- Stripe retries webhooks aggressively (up to 3 days on a 4xx/5xx
-- response) and the same event id can land more than once even on a
-- 200 if the producer side replays. Recording each event id with an
-- INSERT ... ON CONFLICT DO NOTHING gives the handler a cheap
-- single-shot guarantee without needing per-handler dedup logic.
--
-- The handler does:
--   INSERT INTO stripe_events (id, type) VALUES ($1, $2)
--     ON CONFLICT (id) DO NOTHING RETURNING id;
-- and returns early if no row was inserted (already processed).
--
-- Service role only — no RLS needed because clients never touch this
-- table (Edge Function uses SUPABASE_SERVICE_ROLE_KEY).

CREATE TABLE IF NOT EXISTS public.stripe_events (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep the table compact: 90 days of history is enough for replay
-- inspection. A pg_cron job purges older rows at 04:00 UTC daily.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge_stripe_events')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_stripe_events');
    PERFORM cron.schedule(
      'purge_stripe_events',
      '0 4 * * *',
      $cron$ DELETE FROM public.stripe_events WHERE received_at < NOW() - INTERVAL '90 days'; $cron$
    );
  END IF;
END $$;

-- Lock the table down explicitly. The Edge Function uses the service
-- role which bypasses RLS, so we don't need policies — but enabling
-- RLS without policies blocks any accidental anon/authenticated
-- access via a leaked anon key.
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
