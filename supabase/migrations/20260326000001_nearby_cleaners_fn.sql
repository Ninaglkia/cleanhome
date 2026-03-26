-- migration: replace nearby_cleaners with avg_rating + review_count
-- Drop old version (different return signature from Phase 1)
drop function if exists public.nearby_cleaners(double precision, double precision, double precision);

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
  is_available boolean,
  avg_rating numeric,
  review_count bigint,
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
    p.is_available,
    coalesce(round(avg(r.rating)::numeric, 1), 0) as avg_rating,
    count(r.id) as review_count,
    round((extensions.st_distance(
      p.location,
      extensions.st_point(user_lng, user_lat)::extensions.geography
    ) / 1000)::numeric, 1)::double precision as distance_km
  from public.profiles p
  left join public.reviews r on r.reviewed_id = p.id
  where p.cleaner_onboarded = true
    and p.is_available = true
    and p.is_banned = false
    and p.location is not null
    and extensions.st_dwithin(
      p.location,
      extensions.st_point(user_lng, user_lat)::extensions.geography,
      radius_km * 1000
    )
  group by p.id
  order by distance_km;
$$;
