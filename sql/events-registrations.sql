-- ===========================================================================
-- Events: one record everywhere, and who is actually attending.
-- ---------------------------------------------------------------------------
-- OWNER: the CRM's Checkout pages → Events editor creates, prices, opens and
-- archives events. The POS sells the sellable ones from the same row.
-- Curriculum displays them and never writes. (Its old editor is removed.)
--
-- events gains the fields a checkout page needs. `date` (free text) stays as
-- the printed label; `event_date` is the real date that orders lists and
-- stops sales once it has passed. price_cents loses its 0 default: an event
-- is sellable only when it is marked so AND priced (0 = free but sellable).
--
-- event_registrations is the source of truth for attendance:
--   contact_id        the PARTICIPANT (who attends)
--   buyer_contact_id  who paid, when that is someone else (a parent)
--   sale_id           the invoice that covers it; paid or unpaid is read off
--                     the sale, never stored twice
-- Written at the POS tender (one row per seat line). A canceled registration
-- frees the seat, so the unique index is partial.
--
-- Run:  supabase db query --linked -f sql/events-registrations.sql
-- ===========================================================================
alter table public.events
  add column if not exists event_date      date,
  add column if not exists start_time      text,
  add column if not exists description     text,
  add column if not exists sellable        boolean not null default false,
  add column if not exists public_open     boolean not null default false,
  add column if not exists waiver_required boolean not null default true,
  add column if not exists receipt_note    text,
  add column if not exists updated_at      timestamptz default now();

alter table public.events alter column price_cents drop default;
alter table public.events alter column price_cents drop not null;

create table if not exists public.event_registrations (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  contact_id       uuid not null references public.contacts(id) on delete cascade,
  buyer_contact_id uuid references public.contacts(id) on delete set null,
  sale_id          uuid references public.pos_sales(id) on delete set null,
  status           text not null default 'registered' check (status in ('registered','canceled')),
  source           text not null default 'pos',        -- pos | website | staff
  note             text,
  created_at       timestamptz default now()
);

create unique index if not exists event_registrations_one_seat_uidx
  on public.event_registrations (event_id, contact_id) where status = 'registered';
create index if not exists event_registrations_sale_idx on public.event_registrations (sale_id);
create index if not exists event_registrations_event_idx on public.event_registrations (event_id);

alter table public.event_registrations enable row level security;
drop policy if exists event_registrations_staff_all on public.event_registrations;
create policy event_registrations_staff_all on public.event_registrations
  for all using (is_staff()) with check (is_staff());

-- The sale line remembers which event it paid for (the participant already
-- rides in student_contact_id, the same column membership lines use).
alter table public.pos_sale_lines
  add column if not exists event_id uuid references public.events(id) on delete set null;
