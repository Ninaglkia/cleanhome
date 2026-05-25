-- Reconcile the production notifications table with the app code + the original
-- migration intent (20240101000015). The production table existed with an older
-- schema (is_read boolean, data jsonb) and NO triggers/functions, so
-- notifications were never generated and the client (which expects
-- read_at/link_path) received 400s. The table was empty in production, so the
-- column swap is data-safe.

-- 1. Align columns
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link_path TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at   TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata  JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.notifications DROP COLUMN IF EXISTS is_read;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS data;

-- 2. RLS (read own, update own to mark read). No INSERT policy: server-side only.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "users update own notifications (mark read)" ON public.notifications;
CREATE POLICY "users update own notifications (mark read)"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- 4. SECURITY DEFINER insert helper (bypasses the no-INSERT-for-users RLS)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID, p_type TEXT, p_title TEXT, p_body TEXT DEFAULT NULL,
  p_link_path TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link_path, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_link_path, p_metadata);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[create_notification] failed for user %: %', p_user_id, SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;

-- 5. Trigger: bookings -> notifications
CREATE OR REPLACE FUNCTION public.notify_on_booking_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' THEN
      PERFORM public.create_notification(NEW.cleaner_id, 'booking_new',
        'Nuova richiesta di pulizia',
        'Hai ricevuto una nuova prenotazione. Accetta entro 24 ore.',
        '/booking/' || NEW.id::text, jsonb_build_object('booking_id', NEW.id));
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      PERFORM public.create_notification(NEW.client_id, 'booking_accepted',
        'Prenotazione accettata', 'Il cleaner ha accettato la tua richiesta di pulizia.',
        '/booking/' || NEW.id::text, jsonb_build_object('booking_id', NEW.id));
    ELSIF NEW.status IN ('cancelled', 'auto_cancelled') THEN
      PERFORM public.create_notification(NEW.cleaner_id, 'booking_canceled',
        'Prenotazione annullata', 'Una prenotazione è stata annullata.',
        '/booking/' || NEW.id::text, jsonb_build_object('booking_id', NEW.id));
      PERFORM public.create_notification(NEW.client_id, 'booking_canceled',
        'Prenotazione annullata', 'La tua prenotazione è stata annullata.',
        '/booking/' || NEW.id::text, jsonb_build_object('booking_id', NEW.id));
    ELSIF NEW.status = 'completed' THEN
      PERFORM public.create_notification(NEW.client_id, 'booking_completed',
        'Pulizia completata', 'La pulizia è stata completata. Lascia una recensione!',
        '/booking/' || NEW.id::text, jsonb_build_object('booking_id', NEW.id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_on_booking_change ON public.bookings;
CREATE TRIGGER notify_on_booking_change AFTER INSERT OR UPDATE OF status
  ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.notify_on_booking_change();

-- 6. Trigger: reviews -> notifications
CREATE OR REPLACE FUNCTION public.notify_on_new_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.cleaner_id, 'review_new',
    'Nuova recensione ricevuta', 'Hai ricevuto una nuova recensione.', '/reviews',
    jsonb_build_object('review_id', NEW.id, 'booking_id', NEW.booking_id, 'rating', NEW.rating));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_on_new_review ON public.reviews;
CREATE TRIGGER notify_on_new_review AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_review();

-- 7. Trigger: messages -> notifications
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_booking RECORD; v_recipient UUID;
BEGIN
  SELECT client_id, cleaner_id INTO v_booking FROM public.bookings WHERE id = NEW.booking_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.sender_id = v_booking.client_id THEN v_recipient := v_booking.cleaner_id;
  ELSE v_recipient := v_booking.client_id; END IF;
  PERFORM public.create_notification(v_recipient, 'message_new', 'Nuovo messaggio',
    LEFT(NEW.content, 80), '/chat/' || NEW.booking_id::text,
    jsonb_build_object('booking_id', NEW.booking_id, 'message_id', NEW.id, 'sender_id', NEW.sender_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_on_new_message ON public.messages;
CREATE TRIGGER notify_on_new_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();
