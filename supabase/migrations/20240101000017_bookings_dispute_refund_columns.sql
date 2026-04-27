-- Migration 17: bookings — dispute and refund columns
-- ============================================================================
-- Adds columns required by the stripe-webhook handlers for charge.refunded,
-- charge.dispute.created, and charge.dispute.closed events.
--
-- Also adds 'dispute_lost' and 'refunded' to the status CHECK constraint.
-- Status spelling uses double-l ('cancelled', 'auto_cancelled') for consistency
-- with the rest of the codebase. New TS code MUST use these exact forms;
-- Stripe's American 'canceled' is only used for subscription_status, not booking status.
-- ============================================================================

-- payment_status tracks the Stripe payment lifecycle independently from
-- the booking workflow status. Useful for accounting reconciliation.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status TEXT
    CHECK (payment_status IN (
      'pending', 'authorized', 'captured', 'refunded', 'failed', 'disputed'
    ));

-- Amount refunded by Stripe (in EUR). Populated on charge.refunded.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2);

-- Stripe Dispute ID (dis_xxx). Set when charge.dispute.created fires.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS dispute_id TEXT;

-- When true, the cleaner's payout must not be released until the dispute
-- is resolved. Set by the charge.dispute.created webhook handler.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payout_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- Stores the final dispute outcome ('won', 'lost', 'needs_response', etc.)
-- as returned by Stripe on charge.dispute.closed.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS dispute_outcome TEXT;

-- Extend the status CHECK constraint to include 'dispute_lost'.
-- Postgres does not support ALTER CONSTRAINT on CHECK — we must drop
-- and recreate. We use a named constraint so this is safe to repeat
-- (IF NOT EXISTS on the new name).
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'pending', 'accepted', 'declined', 'completed',
      'work_done', 'disputed', 'dispute_lost',
      'cancelled', 'auto_cancelled'
    )
  );

-- Also extend the cleaner_listings subscription_status to include
-- the 'canceled' value used by cancel-listing-subscription. The existing
-- CHECK already has 'canceled' so this is a no-op if the constraint is
-- already correct; we drop-and-recreate defensively.
ALTER TABLE public.cleaner_listings
  DROP CONSTRAINT IF EXISTS cleaner_listings_subscription_status_check;

ALTER TABLE public.cleaner_listings
  ADD CONSTRAINT cleaner_listings_subscription_status_check CHECK (
    subscription_status IN (
      'none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete'
    )
  );

-- Add subscription_canceled_at column used by cancel-listing-subscription
ALTER TABLE public.cleaner_listings
  ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMPTZ;

-- Index for payout reconciliation queries
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status
  ON public.bookings (payment_status);

CREATE INDEX IF NOT EXISTS idx_bookings_payout_blocked
  ON public.bookings (payout_blocked)
  WHERE payout_blocked = TRUE;
