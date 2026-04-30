-- Hold-until-confirm escrow: track client review actions and platform→cleaner transfer
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_confirmed_at      timestamp with time zone,
  ADD COLUMN IF NOT EXISTS client_dispute_opened_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS client_dispute_reason    text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id       text;

CREATE INDEX IF NOT EXISTS idx_bookings_work_done_unresolved
  ON public.bookings (work_done_at)
  WHERE work_done_at IS NOT NULL
    AND client_confirmed_at IS NULL
    AND client_dispute_opened_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_payout_blocked
  ON public.bookings (payout_blocked)
  WHERE payout_blocked = true;

COMMENT ON COLUMN public.bookings.client_confirmed_at IS 'Set when client confirms service or auto-confirm cron fires after 48h';
COMMENT ON COLUMN public.bookings.client_dispute_opened_at IS 'Distinct from stripe dispute_id (chargeback) — this is in-app dispute';
COMMENT ON COLUMN public.bookings.stripe_transfer_id IS 'tr_... id of the transfer to cleaner Connect account at confirm time';
