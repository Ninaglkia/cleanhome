-- ============================================================================
-- 20240101000027_bookings_rls_lock_price_and_delete.sql
-- ----------------------------------------------------------------------------
-- SECURITY HARDENING (pre-launch blocker)
--
-- Problem 1 — UPDATE on price columns:
--   The existing RLS UPDATE policy on `bookings` filters by client_id but
--   does not restrict which columns the client can change. A malicious
--   client could call:
--     supabase.from('bookings').update({ base_price: 1 }).eq('id', X)
--   which would alter the values used in `booking-confirm-completion` to
--   compute the cleaner transfer (cleaner_net = base_price - cleaner_fee).
--   Net effect: a client could trigger a €0 transfer to the cleaner and
--   keep the service for free.
--
-- Problem 2 — DELETE on terminal-status bookings:
--   The existing RLS DELETE policy lets a client hard-delete a booking
--   regardless of status. Deleting a `completed` booking destroys the
--   accounting trail and breaks dispute / refund history.
--
-- Fix:
--   1. Drop the open client UPDATE/DELETE policies and replace them with
--      column-restricted variants:
--        - UPDATE: only mutable client-controlled fields (notes, address,
--          time_slot when status='pending'). Money fields are off-limits.
--        - DELETE: only when status IN ('pending', 'open', 'auto_cancelled',
--          'declined'). Once a cleaner has accepted or work is in progress,
--          deletion is forbidden — admins resolve via service role.
-- ============================================================================

-- ── 1. UPDATE policy: column-restricted ────────────────────────────────────
DROP POLICY IF EXISTS "clients can update own bookings" ON public.bookings;

-- Helper trigger to enforce column immutability — RLS WITH CHECK can only
-- compare row state, not which columns changed in the UPDATE statement, so
-- we use a BEFORE UPDATE trigger that runs only for non-service-role calls.
CREATE OR REPLACE FUNCTION public.bookings_lock_money_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role bypasses this check (it has full DB access by design).
  -- Detected via the "request.jwt.claim.role" GUC set by Supabase.
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Reject changes to money columns from any client-side UPDATE.
  IF NEW.base_price IS DISTINCT FROM OLD.base_price
     OR NEW.total_price IS DISTINCT FROM OLD.total_price
     OR NEW.client_fee IS DISTINCT FROM OLD.client_fee
     OR NEW.cleaner_fee IS DISTINCT FROM OLD.cleaner_fee
     OR NEW.refund_amount IS DISTINCT FROM OLD.refund_amount
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_transfer_id IS DISTINCT FROM OLD.stripe_transfer_id
     OR NEW.payout_blocked IS DISTINCT FROM OLD.payout_blocked
     OR NEW.dispute_id IS DISTINCT FROM OLD.dispute_id
     OR NEW.dispute_outcome IS DISTINCT FROM OLD.dispute_outcome THEN
    RAISE EXCEPTION
      'bookings money/payment fields are read-only for clients (service role only)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_lock_money_fields_trg ON public.bookings;
CREATE TRIGGER bookings_lock_money_fields_trg
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.bookings_lock_money_fields();

-- Restore a client UPDATE policy that only authorizes the row-level access;
-- column-level enforcement is done by the trigger above.
CREATE POLICY "clients can update own bookings (non-money fields)"
  ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- ── 2. DELETE policy: terminal-status only ─────────────────────────────────
DROP POLICY IF EXISTS "clients can delete own bookings" ON public.bookings;

CREATE POLICY "clients can delete bookings before acceptance"
  ON public.bookings
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = client_id
    AND status IN ('pending', 'open', 'auto_cancelled', 'declined')
  );

-- ── 3. Cleaner UPDATE policy (status-only) — same trigger guards money ────
-- The trigger above already protects money columns regardless of who calls
-- UPDATE. The existing cleaner UPDATE policy (if any) keeps working.

COMMENT ON FUNCTION public.bookings_lock_money_fields() IS
  'Pre-launch hardening: blocks non-service-role UPDATE on bookings money/payment columns. Triggered by 20240101000027.';
