-- migration: add_nearby_cleaners_fn.sql
create or replace function nearby_cleaners(
  lat float,
  lng float,
  radius_km float default 50
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
  distance_km float
)
language sql
stable
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
    round(
      (point(lng, lat) <@> point(p.lng, p.lat))::numeric * 1.60934,
      1
    ) as distance_km
  from profiles p
  left join reviews r on r.reviewed_id = p.id
  where
    p.active_role = 'cleaner'
    and p.cleaner_onboarded = true
    and p.is_banned = false
    and p.lat is not null
    and p.lng is not null
    and (point(lng, lat) <@> point(p.lng, p.lat)) * 1.60934 <= radius_km
  group by p.id
  order by distance_km asc;
$$;
