-- ============================================================================
-- BaresTKD - real notes on a contact profile
-- ----------------------------------------------------------------------------
-- Applied 2026-08-17 via `supabase db query --linked -f`. Safe to re-run.
--
-- The profile's Notes card was a mock (hardcoded empty array, Add was a
-- toast). Front-desk notes are core CRM: "grandma picks up on Wednesdays",
-- "wants to test in October", "call about the shirt size". One row per note,
-- append-only from the UI; created_by records who wrote it.
-- ============================================================================

create table if not exists public.contact_notes (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  body        text not null,
  created_by  text,
  created_at  timestamptz default now()
);

create index if not exists contact_notes_contact_idx
  on public.contact_notes(contact_id, created_at desc);

alter table public.contact_notes enable row level security;
drop policy if exists contact_notes_staff_all on public.contact_notes;
create policy contact_notes_staff_all on public.contact_notes
  for all using (is_staff()) with check (is_staff());

-- ─── ROLLBACK (commented) ───────────────────────────────────────────────────
-- drop policy if exists contact_notes_staff_all on public.contact_notes;
-- drop table if exists public.contact_notes;
