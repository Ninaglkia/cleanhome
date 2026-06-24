-- Dispatch fix: an offered cleaner must be able to READ the open booking.
--
-- Bug: bookings SELECT policy was (auth.uid() = client_id OR auth.uid() = cleaner_id
-- OR is_admin). For an open dispatch booking cleaner_id IS NULL, so a cleaner who
-- received a booking_offer could not read the booking. Effect in the app:
--   * cleaner-home "Richieste in arrivo" OfferCard got a null joined booking and
--     rendered nothing (while the "in attesa" counter still showed 1);
--   * the booking detail screen returned "Prenotazione non trovata".
-- Net result: cleaners could never see/accept dispatch requests -> marketplace broken.
--
-- Fix: allow an offered cleaner to read the booking while their offer is live.
-- A SECURITY DEFINER helper is used so the bookings policy does not re-trigger
-- booking_offers RLS (avoids mutual recursion).

create or replace function public.cleaner_has_live_offer(p_booking_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.booking_offers o
    where o.booking_id = p_booking_id
      and o.cleaner_id = auth.uid()
      and o.status = 'pending'
      and o.expires_at > now()
  );
$$;

revoke all on function public.cleaner_has_live_offer(uuid) from public;
grant execute on function public.cleaner_has_live_offer(uuid) to authenticated;

drop policy if exists "offered cleaners can read their live booking" on public.bookings;
create policy "offered cleaners can read their live booking"
on public.bookings for select
to authenticated
using ( public.cleaner_has_live_offer(id) );
