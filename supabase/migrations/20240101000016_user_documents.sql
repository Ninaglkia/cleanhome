-- Migration 16: user_documents
-- ============================================================================
-- Stores metadata for documents uploaded by users (invoices, contracts,
-- identity documents, etc.). The actual files live in the 'user-documents'
-- Storage bucket (private); this table holds the path and signed-URL key
-- needed to retrieve them.
--
-- RLS: each user can only read, insert, and delete their own documents.
-- There is no UPDATE policy — documents are immutable once uploaded.
-- ============================================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Semantic kind: 'invoice' | 'contract' | 'identity' | 'other'
  kind         TEXT        NOT NULL
                           CHECK (kind IN ('invoice', 'contract', 'identity', 'other')),
  name         TEXT        NOT NULL,
  -- Public URL or presigned URL returned after upload
  file_url     TEXT        NOT NULL,
  -- Storage object path (bucket-relative), used to delete the file when
  -- the row is deleted.  Format: "<user_id>/<filename>"
  storage_path TEXT        NOT NULL,
  -- 10 MB upper bound; 0-byte files are rejected at DB level.
  size_bytes   BIGINT      NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  mime_type    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at: documents are immutable once stored.
);

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own documents" ON public.user_documents;
CREATE POLICY "users read own documents"
  ON public.user_documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own documents" ON public.user_documents;
CREATE POLICY "users insert own documents"
  ON public.user_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users delete own documents" ON public.user_documents;
CREATE POLICY "users delete own documents"
  ON public.user_documents FOR DELETE
  USING (auth.uid() = user_id);

-- No UPDATE policy: documents are immutable once uploaded.

-- ── 3. Indexes ───────────────────────────────────────────────────────────────

-- Primary read pattern: list documents for a user, newest first.
CREATE INDEX IF NOT EXISTS idx_user_documents_user_created
  ON public.user_documents (user_id, created_at DESC);

-- ── 4. Storage bucket ────────────────────────────────────────────────────────
-- Private bucket — files require a signed URL to access.
-- file_size_limit: 10 MB (10485760 bytes), enforced by Supabase Storage
--   before the file reaches the server — defence-in-depth alongside the
--   size_bytes CHECK constraint above.
-- allowed_mime_types: restricts uploads to PDF and common image formats
--   to prevent arbitrary file type uploads (e.g., executables).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'user-documents',
    'user-documents',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
  )
  ON CONFLICT (id) DO UPDATE
    SET file_size_limit   = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 5. Storage RLS ───────────────────────────────────────────────────────────
-- Files are stored under the path "<user_id>/<filename>". RLS checks that
-- the first path segment matches the caller's auth.uid().

DROP POLICY IF EXISTS "users upload own documents" ON storage.objects;
CREATE POLICY "users upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users read own documents storage" ON storage.objects;
CREATE POLICY "users read own documents storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "users delete own documents storage" ON storage.objects;
CREATE POLICY "users delete own documents storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
