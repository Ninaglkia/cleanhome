-- ============================================================================
-- RLS HARDENING: Close two high-severity policy holes
-- ============================================================================
-- This migration is IDEMPOTENT: uses DROP IF EXISTS before every CREATE POLICY.
--
-- HIGH #1 — messages direct INSERT bypass
--   The live "booking parties can insert messages" policy lets authenticated
--   users INSERT directly into messages, bypassing the validate-message Edge
--   Function that enforces content redaction (phone/email scrubbing, PII).
--   Pattern: same as bookings (migration 19) — remove the client INSERT policy;
--   all message writes must go through the service-role validate-message function.
--
-- HIGH #2 — reviews INSERT only checks 'completed' status
--   The live "clients can insert own completed booking review" policy checks
--   b.status = 'completed' only. The booking status flow is:
--     work_done → (48h timer or client tap) → completed
--   A client who has used the service is legitimately allowed to review once
--   the cleaner marks work done, even if the auto-confirm cron hasn't fired yet.
--   Fix: extend the status check to include 'work_done'.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HIGH #1: messages — remove direct INSERT policy
-- ---------------------------------------------------------------------------
-- After this drop, the ONLY writer is the validate-message Edge Function
-- (service role, bypasses RLS). Direct anon/authenticated INSERT will be
-- denied by default-deny RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "booking parties can insert messages" ON public.messages;

-- SELECT policy is KEPT intact — booking parties can still read their messages.
-- (Policy name: "booking parties can read messages")

-- ---------------------------------------------------------------------------
-- HIGH #2: reviews INSERT — extend status check to include 'work_done'
-- ---------------------------------------------------------------------------
-- The live policy allows only b.status = 'completed'. We extend it to also
-- accept 'work_done' so clients can review immediately after the cleaner
-- marks the job done, without waiting for the 48h auto-confirm cron.
--
-- Additional hardening vs. live: the new policy also wraps auth.uid() in a
-- subselect (initplan pattern) to avoid per-row re-evaluation.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "clients can insert own completed booking review" ON public.reviews;

CREATE POLICY "clients can insert own completed booking review"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = client_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id       = reviews.booking_id
        AND b.client_id  = (SELECT auth.uid())
        AND b.cleaner_id = reviews.cleaner_id
        AND b.status IN ('completed', 'work_done')
    )
  );

-- Reminder after applying:
-- npx supabase gen types typescript --local > types/supabase.ts
