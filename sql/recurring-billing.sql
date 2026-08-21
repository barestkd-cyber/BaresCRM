-- ===========================================================================
-- Recurring billing: the engine that charges a saved card on schedule
-- ---------------------------------------------------------------------------
-- This is the only system in the CRM that moves money with nobody watching,
-- so it is built to fail CLOSED and to be provable before it is trusted:
--
--   * It is OFF until Race turns it on. A deploy can never start charging.
--   * It has a hard per-run ceiling. A bug that mis-selects rows can hurt a
--     handful of people, not the whole roster.
--   * It charges membership_installments, one row per payment, because the
--     owner's own doctrine is "the scheduled payment IS the due date" and
--     because that gives him a row to move, reprice, or waive per member.
--   * Two runs on the same day must not charge twice. A partial unique index
--     on (membership_id, due_on) makes that the database's job, not the
--     code's, the same lesson the duplicate-receipt bug taught in August.
-- ===========================================================================

-- What happened on each attempt, so a decline is legible instead of silent.
alter table public.membership_installments
  add column if not exists attempts         integer not null default 0,
  add column if not exists last_attempt_at  timestamptz,
  add column if not exists last_error       text;

-- One scheduled payment per membership per date. A retry finds the SAME row
-- rather than making a second one.
create unique index if not exists membership_installments_due_uidx
  on public.membership_installments (membership_id, due_on)
  where status in ('scheduled', 'invoiced', 'paid');

-- The engine reads this every run. Defaults are deliberately timid.
alter table public.settings
  add column if not exists billing_engine_live   boolean not null default false,
  add column if not exists billing_max_per_run   integer not null default 25,
  add column if not exists billing_retry_days    integer not null default 3,
  add column if not exists billing_max_attempts  integer not null default 4,
  add column if not exists billing_token         uuid not null default gen_random_uuid();

comment on column public.settings.billing_engine_live is
  'Master switch. False means the engine reports what it WOULD charge and charges nothing.';
comment on column public.settings.billing_max_per_run is
  'Hard ceiling on charges per run. A mis-selecting bug cannot drain the roster.';

select billing_engine_live, billing_max_per_run, billing_retry_days, billing_max_attempts,
       (select count(*) from public.membership_installments) as installments_today
  from public.settings limit 1;
