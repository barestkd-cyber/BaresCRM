-- ===========================================================================
-- Editing a live membership, with a trail
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-20: "we need to work on the edit membership function on the
-- student profile page... if I wanted to edit the price of a membership or the
-- billing date or the frequency of billing I should be able to edit all that."
--
-- THE TENSION, and how this resolves it. A sold membership is a frozen
-- snapshot: that is the whole reason editing the catalog never reprices
-- anybody. But a real membership does change - somebody negotiates a rate,
-- moves their billing date, switches weekly to monthly - and pretending
-- otherwise just means those changes happen in Race's head instead.
--
-- So the row stays the single answer to "what are they billed", and every
-- change to it is recorded here with what it was before. Nothing is lost, and
-- "why is this person paying $90" always has an answer.
--
-- The membership's own override_reason/override_by/override_at stay as they
-- are: those record the price override made at the POINT OF SALE and must not
-- be overwritten by a later edit, or the sale's own audit disappears.
--
-- Run:  supabase db query --linked -f sql/membership-edits.sql
-- ===========================================================================

create table if not exists public.membership_edits (
  id            uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  contact_id    uuid references public.contacts(id),
  field         text not null,
  old_value     text,
  new_value     text,
  reason        text,
  edited_by     text,
  edited_at     timestamptz not null default now()
);

alter table public.membership_edits
  add column if not exists contact_id uuid references public.contacts(id),
  add column if not exists reason text,
  add column if not exists edited_by text;

create index if not exists membership_edits_membership_idx
  on public.membership_edits (membership_id, edited_at desc);
create index if not exists membership_edits_contact_idx
  on public.membership_edits (contact_id, edited_at desc);

comment on table public.membership_edits is
  'Every change to a live membership, with the previous value. The membership row is what is billed; this is how it got that way.';

alter table public.membership_edits enable row level security;

drop policy if exists membership_edits_staff_all on public.membership_edits;
create policy membership_edits_staff_all on public.membership_edits
  for all using (is_staff()) with check (is_staff());

select (select count(*) from information_schema.tables
         where table_schema='public' and table_name='membership_edits') as table_exists,
       (select count(*) from pg_policy p
          join pg_class c on c.oid = p.polrelid
         where c.relname = 'membership_edits') as policies;
