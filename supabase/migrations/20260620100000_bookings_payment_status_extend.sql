-- Migration: extend payment_status CHECK and add transfer_reversal_id
-- ============================================================================
-- The stripe-webhook handler was updated to:
--   1. Use more granular payment_status values for refund/dispute lifecycles
--   2. Store the Stripe transfer reversal ID when a dispute is lost
--
-- New payment_status values introduced:
--   'transferred'                  — net amount sent to cleaner via Stripe Transfer
--   'partially_refunded'           — partial refund, payout not yet blocked
--   'refund_after_payout'          — full refund issued AFTER cleaner was already paid
--   'partial_refund_after_payout'  — partial refund after payout (admin review needed)
--   'transfer_reversed'            — Stripe Transfer reversed (dispute lost recovery)
--   'reversal_failed_admin_required' — reversal attempted but failed, needs human
--   'dispute_lost'                 — dispute closed against platform, payout blocked
-- ============================================================================

-- 1. Drop and recreate the payment_status CHECK constraint with full value set.
--    Postgres CHECK constraints are not alterable in-place; drop-recreate is safe
--    because we use a named constraint.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_status_check CHECK (
    payment_status IN (
      -- original values
      'pending',
      'authorized',
      'captured',
      'refunded',
      'failed',
      'disputed',
      -- values added by this migration
      'transferred',
      'partially_refunded',
      'refund_after_payout',
      'partial_refund_after_payout',
      'transfer_reversed',
      'reversal_failed_admin_required',
      'dispute_lost'
    )
  );

-- 2. Add transfer_reversal_id column: stores the Stripe Reversal object ID
--    (trr_xxx) written when a dispute-lost handler reverses the cleaner's payout.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS transfer_reversal_id TEXT;

-- 3. Index for admin queries that filter on anomalous statuses needing review.
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status_admin
  ON public.bookings (payment_status)
  WHERE payment_status IN (
    'refund_after_payout',
    'partial_refund_after_payout',
    'reversal_failed_admin_required'
  );
