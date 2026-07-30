-- ============================================================================
-- BaresTKD — CRM calendar table
-- Run ONCE in the Supabase SQL editor before using the CRM calendar's
-- Schedule button. The calendar reads this table plus trial_bookings.
-- Safe to re-run.
-- ============================================================================

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'event' check (type in ('event','testing','trial','private','blackout')),
  title text not null,
  event_date date not null,
  event_time text,
  notes text,
  link_url text,
  paid boolean,
  member_id uuid references contacts(id) on delete set null,
  created_by text,
  created_at timestamptz default now()
);
alter table calendar_events enable row level security;
drop policy if exists calendar_events_staff_all on calendar_events;
create policy calendar_events_staff_all on calendar_events for all using (is_staff()) with check (is_staff());

-- ============================================================================
-- ROLLBACK (commented)
-- ============================================================================
-- drop policy if exists calendar_events_staff_all on calendar_events;
-- drop table if exists calendar_events;
