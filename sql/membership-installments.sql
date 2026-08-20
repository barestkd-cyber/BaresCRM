-- ===========================================================================
-- Payment schedules: one row per future payment, plus blackout days
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-20: "installments remaining needs to be visible and editable
-- ... Someone might say hey could you bill me 2 weeks late in october 4 months
-- away and i want to be able to change the price or payment date of a specific
-- installment within the agreement."
--
-- This is ALSO the "scheduled payment" primitive from the owner's locked
-- doctrine of 2026-08-15 (ECOSYSTEM 22b): "The scheduled payment IS the due
-- date." An invoice alone means pay-when-you-can; scheduling a charge is what
-- attaches a commitment to a date. The future recurring-charging engine reads
-- THIS table; it is not a display nicety that gets replaced later.
--
-- A membership's payments_remaining/total_payments columns stay as the
-- SALE-TIME snapshot of what was sold. Once a schedule exists, the schedule is
-- the living truth and "remaining" is counted from it.
-- ===========================================================================

create table if not exists public.membership_installments (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  contact_id    uuid references public.contacts(id),
  seq           integer not null,
  due_on        date not null,
  amount_cents  integer not null check (amount_cents >= 0),
  -- 'paid' is reserved for the charging engine; today an installment becomes
  -- 'invoiced' when Race raises its invoice, and paid-ness is read off the
  -- linked sale so there is exactly one source of payment truth.
  status        text not null default 'scheduled'
    check (status in ('scheduled','invoiced','paid','waived','canceled')),
  sale_id       uuid references public.pos_sales(id),
  note          text,
  created_at    timestamptz not null default now()
);

create unique index if not exists membership_installments_seq_uidx
  on public.membership_installments (membership_id, seq);
-- What the charging engine and the nightly report will ask: what is due?
create index if not exists membership_installments_due_idx
  on public.membership_installments (due_on) where status = 'scheduled';
create index if not exists membership_installments_contact_idx
  on public.membership_installments (contact_id);

comment on table public.membership_installments is
  'One row per scheduled payment of a membership. The owner doctrine: the scheduled payment IS the due date. The recurring engine reads this table.';

alter table public.membership_installments enable row level security;
drop policy if exists membership_installments_staff_all on public.membership_installments;
create policy membership_installments_staff_all on public.membership_installments
  for all using (is_staff()) with check (is_staff());

-- ── blackout days ──────────────────────────────────────────────────────────
-- Owner, 2026-08-20: blackout a day entirely, or blackout only some things
-- ("classes are blacked out, but I could still do private lessons"). Three
-- toggles on the existing calendar row, all defaulting to blocked, because
-- "most of the time it is just a total lack of availability".

alter table public.calendar_events
  add column if not exists blocks_classes  boolean not null default true,
  add column if not exists blocks_trials   boolean not null default true,
  add column if not exists blocks_privates boolean not null default true;

comment on column public.calendar_events.blocks_trials is
  'Meaningful on type=blackout rows only. When true, the trial booker refuses this date.';

-- Blackouts are announcements as much as calendar rows: the Curriculum app and
-- the public trial booker both need to see them, and neither is staff. This
-- exposes ONLY type=blackout rows to public readers; every other calendar row
-- stays staff-only.
drop policy if exists calendar_blackouts_public_read on public.calendar_events;
create policy calendar_blackouts_public_read on public.calendar_events
  for select using (type = 'blackout');

select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='membership_installments') as installments_table,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='calendar_events'
      and column_name like 'blocks_%') as blackout_toggle_columns,
  (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid
    where c.relname='calendar_events') as calendar_policies;
