-- ISSUE-10 (money audit): no index on stripe_payment_intent_id — every webhook
-- triggered a sequential scan of bookings.
-- ISSUE-13 (money audit): payment_status was never set on booking creation,
-- leaving accounting reconciliation impossible. Default to 'captured' so newly-
-- inserted rows from the webhook reflect that Stripe has the money.
-- The trigger bookings_lock_money_fields prevents UPDATEs to payment_status
-- from non-service-role callers, so the default is safe.

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id
  ON public.bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.bookings
  ALTER COLUMN payment_status SET DEFAULT 'captured';

COMMENT ON COLUMN public.bookings.payment_status IS
  'Lifecycle: captured (default at insert) -> transferred (cleaner paid) | refunded (disputed/cancelled). '
  'Set by service role via webhook / confirm-completion. Locked from client updates.';
