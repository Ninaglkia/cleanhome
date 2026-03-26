-- device_tokens: stores FCM tokens per user/device
create table if not exists public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  token       text not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now(),
  -- One row per (user_id, token) pair
  unique (user_id, token)
);

-- RLS
alter table public.device_tokens enable row level security;

-- Users can only read/write their own tokens
create policy "owner_all" on public.device_tokens
  for all using (auth.uid() = user_id);

-- Service-role bypasses RLS (for dispatcher sending pushes)

-- notification_preferences on profiles
alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{"push": true, "email": true}'::jsonb;
