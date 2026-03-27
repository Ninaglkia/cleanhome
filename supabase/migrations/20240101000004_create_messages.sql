-- Migration: create_messages
-- Table: public.messages
-- In-booking chat between client and cleaner.
-- Queried by:
--   fetchMessages      (filter by booking_id, order by created_at ASC)
--   sendMessage        (insert with booking_id, sender_id, content)
--   subscribeToMessages (realtime INSERT filter by booking_id)
-- RLS must allow both parties of the booking (client and cleaner) to
-- read and write messages for that booking.

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- messages are immutable once sent: no updated_at column
);

-- 2. Enable RLS (MANDATORY)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Both the client and the cleaner of the related booking can read messages.
-- We JOIN through bookings to verify the caller is one of the two parties.
CREATE POLICY "booking parties can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = messages.booking_id
        AND (b.client_id = auth.uid() OR b.cleaner_id = auth.uid())
    )
  );

-- Only a party to the booking can send a message,
-- and the sender_id must match the caller.
CREATE POLICY "booking parties can insert messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = messages.booking_id
        AND (b.client_id = auth.uid() OR b.cleaner_id = auth.uid())
    )
  );

-- Messages are immutable: no UPDATE policy.

-- Neither party can hard-delete messages (audit trail).
-- No DELETE policy intentionally.

-- 4. Indexes
-- fetchMessages and realtime filter both use booking_id.
CREATE INDEX IF NOT EXISTS idx_messages_booking_id
  ON public.messages (booking_id);

-- fetchMessages orders by created_at ASC.
CREATE INDEX IF NOT EXISTS idx_messages_booking_id_created_at
  ON public.messages (booking_id, created_at ASC);

-- sender_id is a foreign key; index it for any future reverse lookups.
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);
