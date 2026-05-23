-- Migration: user_blocks + content_reports
-- Apple App Store Guideline 1.2 (User-Generated Content): users must be able to
-- block abusive users and report objectionable content. Content filtering
-- already exists via the `validate-message` edge function; these two tables add
-- the missing "block user" and "report content" mechanisms.

-- ─── user_blocks ────────────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists idx_user_blocks_blocker on public.user_blocks(blocker_id);
create index if not exists idx_user_blocks_blocked on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks
  for select using ((select auth.uid()) = blocker_id);

drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks
  for insert with check ((select auth.uid()) = blocker_id);

drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks
  for delete using ((select auth.uid()) = blocker_id);

-- ─── content_reports ────────────────────────────────────────────────────────
create table if not exists public.content_reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references auth.users(id) on delete cascade,
  reported_user_id  uuid references auth.users(id) on delete set null,
  booking_id        uuid references public.bookings(id) on delete set null,
  message_id        uuid,                       -- loose ref: a reported message may be redacted/removed
  reason            text not null,
  details           text,
  status            text not null default 'open',
  created_at        timestamptz not null default now(),
  constraint content_reports_reason_len  check (char_length(reason) between 1 and 100),
  constraint content_reports_details_len check (details is null or char_length(details) <= 2000),
  constraint content_reports_status_ck   check (status in ('open', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists idx_content_reports_reported on public.content_reports(reported_user_id);
create index if not exists idx_content_reports_status   on public.content_reports(status);
create index if not exists idx_content_reports_reporter on public.content_reports(reporter_id);

alter table public.content_reports enable row level security;

-- A user can file a report as themselves, and read back only their own reports.
-- Reviewing/acting on reports is done with the service role (admin), never the client.
drop policy if exists content_reports_insert_own on public.content_reports;
create policy content_reports_insert_own on public.content_reports
  for insert with check ((select auth.uid()) = reporter_id);

drop policy if exists content_reports_select_own on public.content_reports;
create policy content_reports_select_own on public.content_reports
  for select using ((select auth.uid()) = reporter_id);
