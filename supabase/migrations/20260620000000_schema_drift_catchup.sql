-- ============================================================================
-- CATCH-UP MIGRATION: Reproduce live prod schema on a fresh DB
-- ============================================================================
-- Context: tables booking_offers and disputes, functions is_admin and
-- dispatch_accept_offer, and several bookings columns exist in production
-- but are absent from local migration history.
--
-- This migration is IDEMPOTENT: every statement is safe to run on the live
-- prod DB where these objects already exist. On a fresh DB it creates them.
--
-- DO NOT APPLY VIA apply_migration WITHOUT REVIEW.
-- Run: npx supabase db push  (after review)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. booking_offers table
-- ---------------------------------------------------------------------------
-- Live schema: 7 columns, status CHECK (pending/accepted/declined/expired/cancelled),
-- UNIQUE(booking_id, cleaner_id), 4 non-PK indexes, 2 FKs (CASCADE on delete).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_offers (
  id           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id   UUID         NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  cleaner_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT         NOT NULL DEFAULT 'pending'::text,
  expires_at   TIMESTAMPTZ  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,

  CONSTRAINT booking_offers_status_check
    CHECK (status = ANY (ARRAY['pending','accepted','declined','expired','cancelled'])),
  CONSTRAINT booking_offers_booking_id_cleaner_id_key
    UNIQUE (booking_id, cleaner_id)
);

-- RLS
ALTER TABLE public.booking_offers ENABLE ROW LEVEL SECURITY;

-- SELECT: cleaner who received the offer, client who owns the booking, admins
DROP POLICY IF EXISTS "authorized users can read booking offers" ON public.booking_offers;
CREATE POLICY "authorized users can read booking offers"
  ON public.booking_offers
  FOR SELECT TO authenticated
  USING (
    is_admin((SELECT auth.uid()))
    OR (SELECT auth.uid()) = cleaner_id
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_offers.booking_id
        AND b.client_id = (SELECT auth.uid())
    )
  );

-- No direct INSERT/UPDATE/DELETE from client: all writes go through
-- dispatch_accept_offer() (SECURITY DEFINER) or service-role Edge Functions.

-- Indexes (IF NOT EXISTS syntax available in Postgres 9.5+)
CREATE UNIQUE INDEX IF NOT EXISTS booking_offers_booking_id_cleaner_id_key
  ON public.booking_offers(booking_id, cleaner_id);

CREATE INDEX IF NOT EXISTS idx_booking_offers_booking
  ON public.booking_offers(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_offers_cleaner_status
  ON public.booking_offers(cleaner_id, status);

CREATE INDEX IF NOT EXISTS idx_booking_offers_expires
  ON public.booking_offers(expires_at);

-- ---------------------------------------------------------------------------
-- 2. disputes table
-- ---------------------------------------------------------------------------
-- Live schema: 11 columns, status CHECK (open/resolved), UNIQUE(booking_id),
-- 4 non-PK indexes, 4 FKs (all NO ACTION).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
  id                        UUID     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id                UUID     NOT NULL REFERENCES public.bookings(id),
  client_id                 UUID     NOT NULL REFERENCES public.profiles(id),
  cleaner_id                UUID     NOT NULL REFERENCES public.profiles(id),
  client_description        TEXT     NOT NULL,
  ai_suggestion             TEXT,
  admin_decision_percentage NUMERIC,
  status                    TEXT     NOT NULL DEFAULT 'open'::text,
  resolved_by               UUID     REFERENCES public.profiles(id),
  resolved_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT disputes_status_check
    CHECK (status = ANY (ARRAY['open','resolved'])),
  CONSTRAINT disputes_booking_id_key
    UNIQUE (booking_id)
);

-- RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- SELECT: client, cleaner, or admin
DROP POLICY IF EXISTS "participants and admins can read disputes" ON public.disputes;
CREATE POLICY "participants and admins can read disputes"
  ON public.disputes
  FOR SELECT
  USING (
    (SELECT auth.uid()) = client_id
    OR (SELECT auth.uid()) = cleaner_id
    OR is_admin((SELECT auth.uid()))
  );

-- INSERT: only the client of the booking can open a dispute
DROP POLICY IF EXISTS "Clients can create disputes" ON public.disputes;
CREATE POLICY "Clients can create disputes"
  ON public.disputes
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = client_id);

-- UPDATE: admins only (resolution workflow)
DROP POLICY IF EXISTS "admins can update disputes" ON public.disputes;
CREATE POLICY "admins can update disputes"
  ON public.disputes
  FOR UPDATE
  USING    (is_admin((SELECT auth.uid())))
  WITH CHECK (is_admin((SELECT auth.uid())));

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS disputes_booking_id_key
  ON public.disputes(booking_id);

CREATE INDEX IF NOT EXISTS idx_disputes_client_id
  ON public.disputes(client_id);

CREATE INDEX IF NOT EXISTS idx_disputes_cleaner_id
  ON public.disputes(cleaner_id);

CREATE INDEX IF NOT EXISTS idx_disputes_resolved_by
  ON public.disputes(resolved_by);

CREATE INDEX IF NOT EXISTS idx_disputes_status_created_at
  ON public.disputes(status, created_at);

-- ---------------------------------------------------------------------------
-- 3. is_admin() function
-- ---------------------------------------------------------------------------
-- Stable, SECURITY DEFINER, search_path=''. Checks profiles.role = 'admin'.
-- CREATE OR REPLACE is inherently idempotent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin'
  );
$$;

-- Ensure anon/public cannot call it (safe to re-run)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 4. dispatch_accept_offer() function
-- ---------------------------------------------------------------------------
-- Atomic offer acceptance: claims offer, cancels others, assigns cleaner.
-- SECURITY DEFINER so it can bypass RLS to update booking_offers and bookings.
-- CREATE OR REPLACE is inherently idempotent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_accept_offer(
  p_booking_id uuid,
  p_cleaner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows_updated  INTEGER := 0;
  v_cancelled     INTEGER := 0;
BEGIN
  -- Step 1: Claim this offer atomically (only succeeds for the first caller)
  UPDATE public.booking_offers
  SET status = 'accepted', responded_at = NOW()
  WHERE booking_id = p_booking_id
    AND cleaner_id = p_cleaner_id
    AND status = 'pending';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    -- Someone else already accepted, or offer was cancelled/expired
    RETURN jsonb_build_object('won', false, 'cancelled_count', 0);
  END IF;

  -- Step 2: Cancel all other pending offers for this booking
  UPDATE public.booking_offers
  SET status = 'cancelled', responded_at = NOW()
  WHERE booking_id = p_booking_id
    AND cleaner_id != p_cleaner_id
    AND status = 'pending';

  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  -- Step 3: Assign cleaner to booking (guard: only if still open and unclaimed)
  UPDATE public.bookings
  SET cleaner_id = p_cleaner_id,
      status = 'accepted'
  WHERE id = p_booking_id
    AND cleaner_id IS NULL
    AND status = 'open';

  RETURN jsonb_build_object('won', true, 'cancelled_count', v_cancelled);
END;
$$;

-- Ensure anon cannot call it (safe to re-run)
REVOKE EXECUTE ON FUNCTION public.dispatch_accept_offer(uuid, uuid) FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 5. bookings.cleaner_id — ensure nullable (dispatch model)
-- ---------------------------------------------------------------------------
-- Live: cleaner_id is NULL-able (YES). A fresh DB from migration 003 may have
-- set it NOT NULL. This DO block is a no-op if the column is already nullable.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'cleaner_id'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.bookings ALTER COLUMN cleaner_id DROP NOT NULL;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. bookings.status CHECK constraint — ensure 'open' is present
-- ---------------------------------------------------------------------------
-- Live constraint already includes 'open'. On a fresh DB it may be absent.
-- Guard: drop old constraint (if name matches) then recreate with full set.
-- On live this is a no-op: the DROP removes the identical constraint and the
-- ADD recreates it with the same values — Postgres validates that no existing
-- row violates the new constraint before committing, so this is safe.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Drop the constraint only if it exists (by name)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND constraint_name = 'bookings_status_check'
  ) THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
  END IF;

  -- Recreate with the full live value set
  ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_status_check
    CHECK (status = ANY (ARRAY[
      'open',
      'pending',
      'accepted',
      'declined',
      'completed',
      'work_done',
      'disputed',
      'cancelled',
      'auto_cancelled',
      'dispute_lost'
    ]));
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. bookings.booking_date — ensure column name is 'booking_date' (not 'date')
-- ---------------------------------------------------------------------------
-- Live: column is 'booking_date' (type date, NOT NULL). All code references
-- booking_date. A fresh DB from migration 003 may have created it as 'date'.
-- Guard: rename only if 'date' exists and 'booking_date' does not.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'booking_date'
  ) THEN
    ALTER TABLE public.bookings RENAME COLUMN "date" TO booking_date;
  END IF;
END;
$$;

-- Reminder after applying:
-- npx supabase gen types typescript --local > types/supabase.ts
