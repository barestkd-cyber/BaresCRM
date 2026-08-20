-- ===========================================================================
-- Private lessons: booked slots, and prepaid packs
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-20: "$35 for 30 min, buy 6 get one free so i offer one or 7
-- at a time." Availability is the open hours BEFORE the first class of the
-- day. His own Monday and Thursday 4:00 PM lessons are already taken, which is
-- exactly why 30 minutes is the unit: both end as the 4:30 class begins.
--
-- A pack is a BALANCE, not seven bookings. Buying seven does not mean picking
-- seven times up front; it means one lesson booked now and six still owed.
-- ===========================================================================

create table if not exists public.private_lesson_packs (
  id             uuid primary key default gen_random_uuid(),
  contact_id     uuid not null references public.contacts(id) on delete cascade,
  sale_id        uuid references public.pos_sales(id) on delete set null,
  lessons_total  integer not null check (lessons_total > 0),
  lessons_used   integer not null default 0 check (lessons_used >= 0),
  amount_cents   integer not null check (amount_cents >= 0),
  purchased_on   date not null default (now() at time zone 'America/Chicago')::date,
  created_at     timestamptz not null default now(),
  constraint pack_not_overdrawn check (lessons_used <= lessons_total)
);

create table if not exists public.private_lessons (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references public.contacts(id) on delete set null,
  pack_id      uuid references public.private_lesson_packs(id) on delete set null,
  sale_id      uuid references public.pos_sales(id) on delete set null,
  starts_at    timestamptz not null,
  duration_min integer not null default 30 check (duration_min > 0),
  status       text not null default 'booked'
    check (status in ('booked','completed','canceled','no_show')),
  student_name text,
  contact_name text,
  phone        text,
  email        text,
  notes        text,
  created_at   timestamptz not null default now()
);

-- Two people must never hold the same slot. A partial unique index lets a
-- canceled lesson free its time again.
create unique index if not exists private_lessons_slot_uidx
  on public.private_lessons (starts_at) where status in ('booked','completed');
create index if not exists private_lessons_contact_idx on public.private_lessons (contact_id);
create index if not exists private_lesson_packs_contact_idx on public.private_lesson_packs (contact_id);

comment on table public.private_lessons is
  'One booked private lesson. starts_at is unique among live bookings so a slot cannot be double sold.';
comment on table public.private_lesson_packs is
  'A prepaid balance of lessons (owner sells 7 for the price of 6). lessons_used counts what has been booked against it.';

alter table public.private_lessons enable row level security;
alter table public.private_lesson_packs enable row level security;
drop policy if exists private_lessons_staff_all on public.private_lessons;
create policy private_lessons_staff_all on public.private_lessons
  for all using (is_staff()) with check (is_staff());
drop policy if exists private_lesson_packs_staff_all on public.private_lesson_packs;
create policy private_lesson_packs_staff_all on public.private_lesson_packs
  for all using (is_staff()) with check (is_staff());

-- Rate and page toggle live beside the testing page's, so Race can change the
-- price without a deploy.
alter table public.settings
  add column if not exists private_rate_cents integer not null default 3500,
  add column if not exists private_pack_size integer not null default 7,
  add column if not exists private_pack_pay_for integer not null default 6,
  add column if not exists private_open_weekday text not null default '15:00',
  add column if not exists private_open_saturday text not null default '08:30',
  add column if not exists private_page_live boolean not null default false;

select private_rate_cents, private_pack_size, private_pack_pay_for,
       private_open_weekday, private_open_saturday, private_page_live
  from public.settings limit 1;
