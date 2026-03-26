-- Enable PostGIS for geolocation queries
create extension if not exists postgis with schema extensions;

-- ============================================
-- PROFILES
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  avatar_url text,
  bio text default '',
  city text,
  location geography(point, 4326),
  active_role text not null default 'client' check (active_role in ('cleaner', 'client')),
  cleaner_type text check (cleaner_type in ('privato', 'azienda')),
  hourly_rate numeric(10, 2),
  services text[] default '{}',
  is_available boolean not null default true,
  is_banned boolean not null default false,
  cleaner_onboarded boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- Index for geolocation queries
create index profiles_location_idx on public.profiles using gist (location);

-- Index for available cleaners
create index profiles_available_cleaners_idx on public.profiles (is_available, is_banned)
  where active_role = 'cleaner' and cleaner_onboarded = true;

-- ============================================
-- BOOKINGS
-- ============================================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  cleaner_id uuid not null references public.profiles(id),
  service_type text not null,
  booking_date date not null,
  time_slot text not null,
  num_rooms integer not null default 1,
  estimated_hours numeric(4, 1) not null,
  base_price numeric(10, 2) not null,
  client_fee numeric(10, 2) not null,
  cleaner_fee numeric(10, 2) not null,
  total_price numeric(10, 2) not null,
  status text not null default 'pending' check (status in (
    'pending', 'accepted', 'declined', 'completed', 'disputed', 'cancelled', 'auto_cancelled'
  )),
  cleaner_deadline timestamptz not null,
  address text,
  notes text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.update_updated_at();

-- ============================================
-- BOOKING PHOTOS
-- ============================================
create table public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  photo_url text not null,
  type text not null check (type in ('completion', 'dispute')),
  room_label text,
  created_at timestamptz not null default now()
);

-- ============================================
-- MESSAGES
-- ============================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null default '',
  photo_url text,
  created_at timestamptz not null default now()
);

create index messages_booking_idx on public.messages (booking_id, created_at);

-- ============================================
-- REVIEWS
-- ============================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  reviewer_id uuid not null references public.profiles(id),
  reviewed_id uuid not null references public.profiles(id),
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text default '',
  created_at timestamptz not null default now(),
  unique (booking_id, reviewer_id)
);

-- ============================================
-- DISPUTES
-- ============================================
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) unique,
  client_id uuid not null references public.profiles(id),
  cleaner_id uuid not null references public.profiles(id),
  client_description text not null,
  ai_suggestion text,
  admin_decision_percentage numeric(5, 2),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================
-- PAYOUTS
-- ============================================
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  cleaner_id uuid not null references public.profiles(id),
  week_start date not null,
  week_end date not null,
  total_gross numeric(10, 2) not null,
  commission_deducted numeric(10, 2) not null,
  net_amount numeric(10, 2) not null,
  stripe_transfer_id text,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_at timestamptz not null default now()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles
alter table public.profiles enable row level security;

create policy "Users can read any profile"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Bookings
alter table public.bookings enable row level security;

create policy "Users can read own bookings"
  on public.bookings for select
  using (auth.uid() = client_id or auth.uid() = cleaner_id);

create policy "Clients can create bookings"
  on public.bookings for insert
  with check (auth.uid() = client_id);

create policy "Participants can update bookings"
  on public.bookings for update
  using (auth.uid() = client_id or auth.uid() = cleaner_id);

-- Booking Photos
alter table public.booking_photos enable row level security;

create policy "Booking participants can read photos"
  on public.booking_photos for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
      and (b.client_id = auth.uid() or b.cleaner_id = auth.uid())
    )
  );

create policy "Booking participants can upload photos"
  on public.booking_photos for insert
  with check (auth.uid() = uploaded_by);

-- Messages
alter table public.messages enable row level security;

create policy "Booking participants can read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
      and (b.client_id = auth.uid() or b.cleaner_id = auth.uid())
    )
  );

create policy "Booking participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
      and (b.client_id = auth.uid() or b.cleaner_id = auth.uid())
      and b.status = 'accepted'
    )
  );

-- Reviews
alter table public.reviews enable row level security;

create policy "Anyone can read reviews"
  on public.reviews for select
  using (true);

create policy "Booking participants can create reviews"
  on public.reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
      and b.status = 'completed'
      and (b.client_id = auth.uid() or b.cleaner_id = auth.uid())
    )
  );

-- Disputes
alter table public.disputes enable row level security;

create policy "Dispute participants can read disputes"
  on public.disputes for select
  using (auth.uid() = client_id or auth.uid() = cleaner_id);

create policy "Clients can create disputes"
  on public.disputes for insert
  with check (auth.uid() = client_id);

-- Payouts
alter table public.payouts enable row level security;

create policy "Cleaners can read own payouts"
  on public.payouts for select
  using (auth.uid() = cleaner_id);

-- Notifications
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- ============================================
-- HELPER: Get distance between user and cleaner
-- ============================================
create or replace function public.nearby_cleaners(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision default 50
)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  city text,
  cleaner_type text,
  hourly_rate numeric,
  services text[],
  distance_km double precision
)
language sql stable
as $$
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.city,
    p.cleaner_type,
    p.hourly_rate,
    p.services,
    round((st_distance(
      p.location,
      st_point(user_lng, user_lat)::geography
    ) / 1000)::numeric, 1)::double precision as distance_km
  from public.profiles p
  where p.cleaner_onboarded = true
    and p.is_available = true
    and p.is_banned = false
    and p.location is not null
    and st_dwithin(
      p.location,
      st_point(user_lng, user_lat)::geography,
      radius_km * 1000
    )
  order by distance_km;
$$;
