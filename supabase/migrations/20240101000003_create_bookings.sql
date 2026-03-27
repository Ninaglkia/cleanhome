-- Migration: create_bookings
-- Table: public.bookings
-- Core transactional table of the marketplace.
-- Queried by:
--   fetchBookings  (filter by client_id OR cleaner_id, order by created_at DESC)
--   fetchBooking   (filter by id)
--   updateBookingStatus (update status by id)
--   markWorkDone   (update status + work_done_at by id)

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.bookings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cleaner_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type              TEXT NOT NULL,
  -- ISO date string "YYYY-MM-DD"
  date                      DATE NOT NULL,
  -- e.g. "09:00–11:00"
  time_slot                 TEXT NOT NULL,
  num_rooms                 INTEGER NOT NULL DEFAULT 1,
  estimated_hours           NUMERIC(5, 2) NOT NULL DEFAULT 1,
  base_price                NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Platform fee charged to the client
  client_fee                NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Net payout to the cleaner
  cleaner_fee               NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Total amount charged to the client (base_price + client_fee)
  total_price               NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- "pending" | "accepted" | "declined" | "completed" |
  -- "work_done" | "disputed" | "cancelled" | "auto_cancelled"
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN (
                                'pending', 'accepted', 'declined', 'completed',
                                'work_done', 'disputed', 'cancelled', 'auto_cancelled'
                              )),
  -- Deadline for the cleaner to accept/decline (ISO timestamp)
  cleaner_deadline          TIMESTAMPTZ,
  address                   TEXT,
  notes                     TEXT,
  stripe_payment_intent_id  TEXT,
  -- Set when cleaner marks job as done
  work_done_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS (MANDATORY)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- A client can read their own bookings.
CREATE POLICY "clients can read own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = client_id);

-- A cleaner can read bookings assigned to them.
CREATE POLICY "cleaners can read assigned bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = cleaner_id);

-- Only the client (the one requesting the service) can create a booking.
CREATE POLICY "clients can insert own bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- The client can update their own booking (e.g. cancel it).
CREATE POLICY "clients can update own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- The cleaner can update bookings assigned to them (accept/decline/work_done).
CREATE POLICY "cleaners can update assigned bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = cleaner_id)
  WITH CHECK (auth.uid() = cleaner_id);

-- Only the client can delete (soft-cancel is preferred, but keep hard-delete for
-- the owner as a safety valve).
CREATE POLICY "clients can delete own bookings"
  ON public.bookings FOR DELETE
  USING (auth.uid() = client_id);

-- 4. Indexes
-- fetchBookings queries by client_id or cleaner_id, orders by created_at.
CREATE INDEX IF NOT EXISTS idx_bookings_client_id
  ON public.bookings (client_id);

CREATE INDEX IF NOT EXISTS idx_bookings_cleaner_id
  ON public.bookings (cleaner_id);

CREATE INDEX IF NOT EXISTS idx_bookings_created_at
  ON public.bookings (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON public.bookings (status);

-- 5. Auto-update updated_at trigger
CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
