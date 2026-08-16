-- ============================================================================
-- BaresTKD — session-based programs (Little Kickers and anything like it)
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor, AFTER little-kickers.sql.
-- Safe to re-run.
--
-- WHAT THIS SOLVES: a session class does not live in `schedule_template` like
-- the recurring weekly classes do, so its dates had nowhere to live. They were
-- hardcoded inside the lk-checkout function, which meant the calendar, the
-- website and the instructors each held a separate copy of "September 16".
--
-- One row here is one COHORT. From it we derive:
--   * every class date (starts_on plus a week, `weeks` times)
--   * the calendar entries, via generate_session_classes()
--   * whether enrollment is open, which the checkout page and function obey
--
-- The dates belong to the SESSION, never to the enrolling child: twelve kids
-- in a six-week session is still six classes, not seventy-two.
--
-- OPENING ENROLLMENT IS NOW DATA, NOT A DEPLOY. Set status='open' and the
-- website starts selling; set it back to 'draft' and it stops. No code change.
-- ============================================================================

create table if not exists public.program_sessions (
  id                  uuid primary key default gen_random_uuid(),
  program             text not null,                    -- 'Little Kickers'
  plan_code           text not null,                    -- what it sells from pricing_plans
  label               text,                             -- 'Fall 2026'
  starts_on           date not null,                    -- first class; sets the weekday for all of them
  weeks               integer not null default 6 check (weeks between 1 and 52),
  class_time          text not null,                    -- '9:30-10:20 AM', printed as-is
  capacity            integer,                          -- null = no cap
  status              text not null default 'draft'
                        check (status in ('draft','open','closed','completed')),
  enrollment_opens_on date,                             -- shown while status='draft'
  notes               text,
  created_by          text,
  created_at          timestamptz default now()
);

-- Only one session per program may be sellable at a time, so the checkout
-- function never has to guess which cohort a buyer meant.
create unique index if not exists program_sessions_one_open
  on public.program_sessions(program) where status = 'open';

-- Calendar rows are generated FROM a session, so they can be regenerated when
-- a date moves. on delete cascade: dropping a cohort takes its classes with it.
alter table public.calendar_events
  add column if not exists session_id uuid references public.program_sessions(id) on delete cascade;

create index if not exists calendar_events_session_idx
  on public.calendar_events(session_id) where session_id is not null;

alter table public.program_sessions enable row level security;
drop policy if exists program_sessions_staff_all on public.program_sessions;
create policy program_sessions_staff_all on public.program_sessions
  for all using (is_staff()) with check (is_staff());

-- The public checkout page needs to READ the open session (dates, times) with
-- the anon key. Reading a cohort's schedule is not sensitive; writing is.
drop policy if exists program_sessions_public_read_open on public.program_sessions;
create policy program_sessions_public_read_open on public.program_sessions
  for select using (status in ('open','draft'));

-- ─── generate the class dates ───────────────────────────────────────────────
-- Deletes and rebuilds this session's calendar rows, so it is safe to re-run
-- after changing a start date. Runs as the CALLER (no security definer), so
-- RLS still applies and only staff can generate.
create or replace function public.generate_session_classes(p_session uuid)
returns integer
language plpgsql
as $$
declare
  s public.program_sessions%rowtype;
  i integer;
  made integer := 0;
begin
  select * into s from public.program_sessions where id = p_session;
  if not found then
    raise exception 'no such session: %', p_session;
  end if;

  delete from public.calendar_events where session_id = p_session;

  for i in 0 .. (s.weeks - 1) loop
    insert into public.calendar_events
      (type, title, event_date, event_time, notes, session_id, created_by)
    values (
      'event',
      s.program || ' (' || (i + 1) || ' of ' || s.weeks || ')',
      s.starts_on + (i * 7),
      s.class_time,
      coalesce(s.label, '') ,
      p_session,
      coalesce(s.created_by, 'session generator')
    );
    made := made + 1;
  end loop;

  return made;
end $$;

-- ─── seed the first cohort ──────────────────────────────────────────────────
-- Little Kickers, six Wednesdays from 2026-09-16. Starts as 'draft' so the
-- website stays gated until Stripe is live; flip to 'open' to start selling.
insert into public.program_sessions
  (program, plan_code, label, starts_on, weeks, class_time, status, enrollment_opens_on, created_by)
select 'Little Kickers', 'little_kickers_session', 'Fall 2026',
       date '2026-09-16', 6, '9:30-10:20 AM', 'draft', date '2026-08-17', 'setup'
where not exists (
  select 1 from public.program_sessions
  where program = 'Little Kickers' and starts_on = date '2026-09-16'
);

-- Build its six calendar entries.
select public.generate_session_classes(id) as classes_created
from public.program_sessions
where program = 'Little Kickers' and starts_on = date '2026-09-16';

-- Confirm: one session, six classes.
select program, label, starts_on, weeks, class_time, status,
       starts_on + ((weeks - 1) * 7) as ends_on
from public.program_sessions where program = 'Little Kickers';

select event_date, event_time, title
from public.calendar_events
where session_id in (select id from public.program_sessions where program = 'Little Kickers')
order by event_date;

-- ─── ROLLBACK (commented) ───────────────────────────────────────────────────
-- drop function if exists public.generate_session_classes(uuid);
-- delete from public.calendar_events where session_id is not null;
-- alter table public.calendar_events drop column if exists session_id;
-- drop table if exists public.program_sessions;
