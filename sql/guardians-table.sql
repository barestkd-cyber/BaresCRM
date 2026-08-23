-- ===========================================================================
-- One record per guardian, referenced by each child
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-23: "I don't think Colette needs five rows. She is one
-- person... one guardian row referenced from each child."
--
-- Today student_guardians carries a COPY of the guardian's details on every
-- child. Colette Du Toit is five rows, Carlton Allen two. Nothing has broken
-- because nothing has been edited; the day her phone number is corrected on
-- one child, the other four are stale, which is the exact thing he disliked
-- about Spark: "just repeats of everything all over the place."
--
-- ADDITIVE ONLY. student_guardians keeps its email/name/phone columns and its
-- existing policies, so the CRM and the parent portal keep working untouched
-- while the reads are moved over. Nothing is dropped here.
--
-- EMAILS ARE THEIR OWN TABLE because they carry state: which address gets the
-- default sends. Owner: "you can either get the stuff on default or not get
-- the stuff on default" - one flag, governing receipts and general
-- information alike, not a tag per message type.
--
-- PHONES ARE AN ARRAY because they carry none. A table for them would be
-- plumbing bought for nothing.
--
-- IDENTITY IS THE NAME, NOT THE ADDRESS. Four guardians hold two addresses
-- each - Betsy Thrash (personal + work), Katie Hardin (Ullrich is her former
-- name), Katie Root, Tim Apple - and every one was verified as a single human
-- with the same surname and the same children before this ran. Keying on
-- email would have split each of them in two. Rows with no name yet are keyed
-- on address instead, since that is all they have.
-- ===========================================================================

-- A guardians table already existed: an empty four-column stub
-- (id, contact_id, name, relation) that nothing read. It is extended rather
-- than replaced, because contact_id is precisely the link the owner asked for
-- - "Scott could be factually a guardian to Lincoln and a contact" - so an
-- adult who also trains points at their own contact instead of having their
-- details typed twice. Nothing is dropped.
--
-- relation is left alone and unused. A relationship is per CHILD, not per
-- person: the same man can be father to one student and uncle to another, so
-- the label stays on student_guardians where it already lives.
-- contact_id was NOT NULL on the stub, which assumed every guardian is also a
-- contact. That is the assumption the owner rejected outright: 99 guardians
-- against 141 contacts, and he will not have a contact minted for every
-- parent. It becomes optional - set when the guardian also trains, null when
-- they are only somebody's parent.
alter table public.guardians alter column contact_id drop not null;
-- name was NOT NULL too. 29 guardians are known only by an address so far,
-- and a placeholder like "(unknown)" would pollute every search and every
-- profile that showed it. No name is the honest value until one arrives.
alter table public.guardians alter column name drop not null;

alter table public.guardians
  add column if not exists phones     text[] not null default '{}',
  add column if not exists address    text,
  add column if not exists notes      text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists created_by text;

create table if not exists public.guardian_emails (
  id           uuid primary key default gen_random_uuid(),
  guardian_id  uuid not null references public.guardians(id) on delete cascade,
  email        text not null,
  -- The parent who wants every receipt forever, without being added by hand
  -- each time. The send sheet still lets one-offs be added before sending.
  always_copy  boolean not null default false,
  created_at   timestamptz not null default now()
);
create unique index if not exists guardian_emails_addr_idx
  on public.guardian_emails (lower(email));
create index if not exists guardian_emails_guardian_idx
  on public.guardian_emails (guardian_id);

-- the link from a child to the person
alter table public.student_guardians
  add column if not exists guardian_id uuid references public.guardians(id) on delete set null;
create index if not exists student_guardians_guardian_idx
  on public.student_guardians (guardian_id);

-- who the studio contacts first for this family
alter table public.households
  add column if not exists primary_guardian_id uuid references public.guardians(id) on delete set null;

-- ── populate ───────────────────────────────────────────────────────────────
-- named people first, one per name
insert into public.guardians (name, address, phones, created_by)
select g.name,
       min(g.address) filter (where g.address is not null),
       coalesce(array_agg(distinct g.phone) filter (where g.phone is not null and g.phone <> ''), '{}'),
       'spark-migration'
from public.student_guardians g
where g.name is not null and g.name <> ''
group by g.name
on conflict do nothing;

-- then the unnamed, one per address, since a name is all that could group
-- them. A throwaway column carries the address the record was built from, so
-- the link back is a plain join rather than arithmetic on row order.
alter table public.guardians add column if not exists src_email text;

insert into public.guardians (name, address, phones, created_by, src_email)
select null,
       min(g.address) filter (where g.address is not null),
       coalesce(array_agg(distinct g.phone) filter (where g.phone is not null and g.phone <> ''), '{}'),
       'spark-migration',
       lower(g.email)
from public.student_guardians g
where (g.name is null or g.name = '') and g.email is not null
group by lower(g.email);

-- link every child row to its person: by name where there is one, else by the
-- address the record was built from
update public.student_guardians sg
set guardian_id = gu.id
from public.guardians gu
where sg.guardian_id is null and sg.name is not null and sg.name <> '' and gu.name = sg.name;

update public.student_guardians sg
set guardian_id = gu.id
from public.guardians gu
where sg.guardian_id is null and gu.src_email is not null and gu.src_email = lower(sg.email);

alter table public.guardians drop column if exists src_email;

-- every address the person is known by
insert into public.guardian_emails (guardian_id, email)
select distinct sg.guardian_id, lower(sg.email)
from public.student_guardians sg
where sg.guardian_id is not null and sg.email is not null and sg.email <> ''
on conflict do nothing;

-- ── access ─────────────────────────────────────────────────────────────────
alter table public.guardians enable row level security;
alter table public.guardian_emails enable row level security;

drop policy if exists guardians_staff_all on public.guardians;
create policy guardians_staff_all on public.guardians
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists guardian_emails_staff_all on public.guardian_emails;
create policy guardian_emails_staff_all on public.guardian_emails
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

select (select count(*) from public.guardians)                                as people,
       (select count(*) from public.guardians where name is not null)         as named,
       (select count(*) from public.guardian_emails)                          as addresses,
       (select count(*) from public.student_guardians)                        as child_links,
       (select count(*) from public.student_guardians where guardian_id is null) as unlinked;
