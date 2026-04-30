-- Photo moderation + escrow phase tracking
ALTER TABLE public.booking_photos
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_categories jsonb,
  ADD COLUMN IF NOT EXISTS storage_path text;

CREATE INDEX IF NOT EXISTS idx_booking_photos_booking_type
  ON public.booking_photos (booking_id, type);

CREATE INDEX IF NOT EXISTS idx_booking_photos_pending_moderation
  ON public.booking_photos (created_at)
  WHERE moderation_status = 'pending';

COMMENT ON COLUMN public.booking_photos.type IS 'before | after_cleaner | dispute_client | dispute_cleaner';
COMMENT ON COLUMN public.booking_photos.moderation_status IS 'pending | approved | rejected (NSFW or off-topic)';
COMMENT ON COLUMN public.booking_photos.moderation_categories IS 'OpenAI omni-moderation-latest categories scores';
COMMENT ON COLUMN public.booking_photos.storage_path IS 'Path in booking-photos bucket (for cleanup if rejected)';
