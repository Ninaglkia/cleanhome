-- Migration 15: notifications
-- ============================================================================
-- In-app notification log. Every relevant domain event (booking state
-- changes, new messages, new reviews, system alerts) inserts a row here.
--
-- Insert path: server-side only (Edge Functions or Postgres triggers using
-- the service-role client or SECURITY DEFINER functions). There is
-- intentionally NO INSERT RLS policy for normal authenticated users.
--
-- Users can:
--   SELECT  — read their own notifications
--   UPDATE  — mark notifications as read (set read_at)
-- ============================================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Semantic type used by the client to choose the icon/color/action.
  -- Values: 'booking_new' | 'booking_accepted' | 'booking_canceled' |
  --         'booking_completed' | 'payment_succeeded' | 'payment_refunded' |
  --         'booking_disputed' | 'dispute_resolved' | 'message_new' |
  --         'review_new' | 'system'
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT,
  -- Deep-link path used by the RN navigator, e.g. '/booking/abc123'
  link_path  TEXT,
  -- Arbitrary extra data the client may use (booking_id, amount, etc.)
  metadata   JSONB       NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users may read only their own notifications.
DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users may update their own notifications (to mark as read).
-- WITH CHECK ensures they cannot move a notification to another user_id.
DROP POLICY IF EXISTS "users update own notifications (mark read)" ON public.notifications;
CREATE POLICY "users update own notifications (mark read)"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT: no policy for authenticated users — only the service role and
-- SECURITY DEFINER triggers may insert notifications.

-- ── 3. Indexes ───────────────────────────────────────────────────────────────

-- Primary read pattern: list unread notifications for a user.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read_at)
  WHERE read_at IS NULL;

-- Secondary read pattern: paginated notification feed (newest first).
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- ── 4. SECURITY DEFINER helper ───────────────────────────────────────────────
-- Postgres triggers run as the invoking user, which may not have INSERT
-- on notifications (RLS blocks it). This function runs as the function
-- owner (superuser/postgres) so it can bypass RLS and insert safely.
-- It is NOT exposed to anon/authenticated roles — it is called only by
-- the triggers defined below.

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id   UUID,
  p_type      TEXT,
  p_title     TEXT,
  p_body      TEXT    DEFAULT NULL,
  p_link_path TEXT    DEFAULT NULL,
  p_metadata  JSONB   DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link_path, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_link_path, p_metadata);
EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure abort the main transaction.
  RAISE WARNING '[create_notification] failed for user %: %', p_user_id, SQLERRM;
END;
$$;

-- Revoke public execute; triggers call it internally.
REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC;

-- ── 5. Trigger: bookings → notifications ─────────────────────────────────────
--
-- Events covered:
--   INSERT  (status='pending')           → cleaner: booking_new
--   UPDATE  pending → accepted            → client:  booking_accepted
--   UPDATE  any    → canceled/auto_cancelled → other party: booking_canceled
--   UPDATE  any    → completed            → client:  booking_completed

CREATE OR REPLACE FUNCTION public.notify_on_booking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── New booking (INSERT) ──────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      PERFORM public.create_notification(
        NEW.cleaner_id,
        'booking_new',
        'Nuova richiesta di pulizia',
        'Hai ricevuto una nuova prenotazione. Accetta entro 24 ore.',
        '/booking/' || NEW.id::text,
        jsonb_build_object('booking_id', NEW.id)
      );
    END IF;
    RETURN NEW;
  END IF;

  -- ── Status transitions (UPDATE) ──────────────────────────────────────────
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

    -- pending → accepted: notify the client
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      PERFORM public.create_notification(
        NEW.client_id,
        'booking_accepted',
        'Prenotazione accettata',
        'Il cleaner ha accettato la tua richiesta di pulizia.',
        '/booking/' || NEW.id::text,
        jsonb_build_object('booking_id', NEW.id)
      );

    -- any → canceled / auto_cancelled: notify the other party
    ELSIF NEW.status IN ('cancelled', 'auto_cancelled') THEN
      -- Determine who triggered the cancel: if the client updated it,
      -- notify the cleaner, and vice versa. If it came from the system
      -- (service role), notify both.
      -- Since we cannot know the triggering session here, we notify
      -- both parties (cleaner and client) — duplicates are acceptable
      -- and better than missing a notification.
      PERFORM public.create_notification(
        NEW.cleaner_id,
        'booking_canceled',
        'Prenotazione annullata',
        'Una prenotazione è stata annullata.',
        '/booking/' || NEW.id::text,
        jsonb_build_object('booking_id', NEW.id)
      );
      PERFORM public.create_notification(
        NEW.client_id,
        'booking_canceled',
        'Prenotazione annullata',
        'La tua prenotazione è stata annullata.',
        '/booking/' || NEW.id::text,
        jsonb_build_object('booking_id', NEW.id)
      );

    -- in_progress / work_done → completed: notify the client
    ELSIF NEW.status = 'completed' THEN
      PERFORM public.create_notification(
        NEW.client_id,
        'booking_completed',
        'Pulizia completata',
        'La pulizia è stata completata. Lascia una recensione!',
        '/booking/' || NEW.id::text,
        jsonb_build_object('booking_id', NEW.id)
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_booking_change ON public.bookings;
CREATE TRIGGER notify_on_booking_change
  AFTER INSERT OR UPDATE OF status
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_booking_change();

-- ── 6. Trigger: reviews → notifications ──────────────────────────────────────
-- When a client posts a review, notify the cleaner.

CREATE OR REPLACE FUNCTION public.notify_on_new_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_notification(
    NEW.cleaner_id,
    'review_new',
    'Nuova recensione ricevuta',
    'Hai ricevuto una nuova recensione.',
    '/reviews',
    jsonb_build_object(
      'review_id',  NEW.id,
      'booking_id', NEW.booking_id,
      'rating',     NEW.rating
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_new_review ON public.reviews;
CREATE TRIGGER notify_on_new_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_review();

-- ── 7. Trigger: messages → notifications ─────────────────────────────────────
-- When a new message arrives, notify the other party in the booking.
-- We look up the booking to determine who the recipient is.

CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking   RECORD;
  v_recipient UUID;
BEGIN
  SELECT client_id, cleaner_id
    INTO v_booking
    FROM public.bookings
   WHERE id = NEW.booking_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Recipient is whoever is NOT the sender
  IF NEW.sender_id = v_booking.client_id THEN
    v_recipient := v_booking.cleaner_id;
  ELSE
    v_recipient := v_booking.client_id;
  END IF;

  PERFORM public.create_notification(
    v_recipient,
    'message_new',
    'Nuovo messaggio',
    -- Trim the preview to 80 chars to keep the notification concise
    LEFT(NEW.content, 80),
    '/chat/' || NEW.booking_id::text,
    jsonb_build_object(
      'booking_id', NEW.booking_id,
      'message_id', NEW.id,
      'sender_id',  NEW.sender_id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_new_message ON public.messages;
CREATE TRIGGER notify_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_message();
