-- Race, 2026-08-20: "my Monday at four is already filled and my Thursday at
-- four is already filled." Those are standing weekly lessons, not one-off
-- bookings, so they are recorded as a recurring rule he can edit rather than
-- as fake bookings that would expire and need topping up forever.
alter table public.settings
  add column if not exists private_blocked_slots text not null default 'Mon 4:00 PM, Thu 4:00 PM';

select private_blocked_slots from public.settings limit 1;
