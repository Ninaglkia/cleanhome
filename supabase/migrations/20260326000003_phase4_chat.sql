-- ─────────────────────────────────────────────
-- Phase 4: Chat & Completion
-- ─────────────────────────────────────────────

-- Add work_done_at to bookings (for 48h auto-confirm cron)
alter table public.bookings
  add column if not exists work_done_at timestamptz;

-- ─────────────────────────────────────────────
-- contact_violations table (anti-contact tracking)
-- ─────────────────────────────────────────────
create table if not exists public.contact_violations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade,
  booking_id  uuid references public.bookings(id) on delete cascade,
  content     text not null,
  created_at  timestamptz default now()
);

alter table public.contact_violations enable row level security;

-- Only service role (admin) can access violations; blocks all anon/authed
create policy "admin only"
  on public.contact_violations for all
  using (false);

-- ─────────────────────────────────────────────
-- booking-photos Storage bucket RLS policies
-- ─────────────────────────────────────────────

-- Allow authenticated users to upload to booking-photos bucket
create policy "auth users can upload booking photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'booking-photos');

-- Allow authenticated users to read from booking-photos bucket
create policy "auth users can read booking photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'booking-photos');
