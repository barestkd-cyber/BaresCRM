-- ============================================================================
-- BaresTKD — extra people on a student: second guardian, emergency contacts,
-- authorized pickups (owner request 2026-08-18)
-- ----------------------------------------------------------------------------
-- Safe to re-run.
--
-- Enrollment collects ONE required guardian. Everything below is optional:
-- a second guardian (with email/phone/address), any number of emergency
-- contacts (name + phone + relationship), and people authorized to pick the
-- child up (name + phone).
-- ============================================================================

-- The guardian table only held an email + name; a second guardian carries
-- full contact details.
alter table public.student_guardians add column if not exists phone text;
alter table public.student_guardians add column if not exists address text;

-- Emergency contacts and pickup people are NOT guardians: no email, no
-- account, never a contact channel. Their own table keeps that clear.
create table if not exists public.student_contacts (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.contacts(id) on delete cascade,
  kind          text not null check (kind in ('emergency','pickup')),
  name          text not null,
  phone         text,
  relationship  text,
  created_at    timestamptz default now()
);

alter table public.student_contacts enable row level security;
drop policy if exists student_contacts_staff_all on public.student_contacts;
create policy student_contacts_staff_all on public.student_contacts
  for all using (is_staff()) with check (is_staff());

-- ─── ROLLBACK (commented) ───────────────────────────────────────────────────
-- drop policy if exists student_contacts_staff_all on public.student_contacts;
-- drop table if exists public.student_contacts;
-- alter table public.student_guardians drop column if exists address;
-- alter table public.student_guardians drop column if exists phone;
