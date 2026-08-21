-- ===========================================================================
-- Fixes from the adversarial review of the live private lesson page
-- ---------------------------------------------------------------------------
-- The big one: a booking was written as 'booked' BEFORE the card was charged,
-- and nothing ever released it. Every abandoned checkout destroyed a slot
-- permanently, and an anonymous script could have held every slot in the
-- six-week window for free and closed online booking entirely.
--
-- A booking now starts as 'pending' and only becomes 'booked' when the money
-- lands. The unique index covers pending too, so a pending hold still stops a
-- double sale, and the function expires stale holds so an abandoned checkout
-- gives the slot back on its own.
-- ===========================================================================

alter table public.private_lessons drop constraint if exists private_lessons_status_check;
alter table public.private_lessons add constraint private_lessons_status_check
  check (status in ('pending','booked','completed','canceled','no_show'));

drop index if exists private_lessons_slot_uidx;
-- 'pending' included on purpose: a hold in flight must still block a second
-- sale of the same slot. Expiry is what stops that hold lasting forever.
create unique index private_lessons_slot_uidx
  on public.private_lessons (starts_at) where status in ('pending','booked','completed');

-- How long an unpaid hold survives. Long enough to type a card, short enough
-- that an abandoned tab is not a lost lesson.
alter table public.settings
  add column if not exists private_hold_minutes integer not null default 20;

select
  (select count(*) from pg_indexes where indexname='private_lessons_slot_uidx') as slot_index,
  (select private_hold_minutes from public.settings limit 1) as hold_minutes,
  (select pg_get_constraintdef(oid) from pg_constraint
    where conname='private_lessons_status_check') as status_rule;
