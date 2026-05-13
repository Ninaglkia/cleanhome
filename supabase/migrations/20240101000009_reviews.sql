-- Migration 9: reviews
-- ============================================================================
-- Clients can leave a review after a completed booking. The review is
-- tied to a booking (1:1) and a cleaner. A trigger auto-updates the
-- cleaner's avg_rating and review_count on cleaner_profiles.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cleaner_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read reviews (for cleaner profiles)
CREATE POLICY "authenticated can read reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (true);

-- Only the client of the booking can insert a review
CREATE POLICY "clients can insert own review"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- No update/delete — reviews are immutable once posted

CREATE INDEX IF NOT EXISTS idx_reviews_cleaner_id
  ON public.reviews (cleaner_id);

CREATE INDEX IF NOT EXISTS idx_reviews_booking_id
  ON public.reviews (booking_id);

-- Trigger: auto-update avg_rating + review_count on cleaner_profiles
CREATE OR REPLACE FUNCTION public.update_cleaner_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.cleaner_profiles
  SET
    avg_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM public.reviews
      WHERE cleaner_id = NEW.cleaner_id
    ), 0),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE cleaner_id = NEW.cleaner_id
    ),
    updated_at = NOW()
  WHERE id = NEW.cleaner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_cleaner_rating_on_review ON public.reviews;
CREATE TRIGGER update_cleaner_rating_on_review
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cleaner_rating();
