-- ===========================================================================
-- Card links know where they came from
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-23: "the link knows the profile it was sent from and person
-- sent to, so if the email doesn't match it goes to the profile the link was
-- sent from under the participant until I can match it to a guardian."
--
-- That is better than what I had built, which parked an unmatched card on a
-- freshly invented guardian nobody had asked for. A card that arrives has to
-- land somewhere real, and the link already knows two real places.
--
-- It also settles the open-page question: with a token there is no way to
-- probe whether an address is known, because the page will not load without
-- one.
--
-- The 128-bit token is the whole gate, matching pos_sales.view_token and
-- agreement_invites. It grants adding a card and nothing else.
-- ===========================================================================

create table if not exists public.card_invites (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  -- the profile it was sent from: where an unmatched card lands
  contact_id    uuid not null references public.contacts(id) on delete cascade,
  -- who it was sent to, when staff picked somebody
  guardian_id   uuid references public.guardians(id) on delete set null,
  sent_to       text not null,
  created_by    text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '30 days'),
  used_at       timestamptz,
  -- which guardian the card actually ended up on, once it has
  landed_on     uuid references public.guardians(id) on delete set null,
  -- true when the address they typed matched nobody and it fell back
  needs_matching boolean not null default false
);

create index if not exists card_invites_contact_idx on public.card_invites(contact_id);
create index if not exists card_invites_open_idx
  on public.card_invites(needs_matching) where needs_matching;

alter table public.card_invites enable row level security;

-- Staff only. The public page never touches this table: it goes through
-- card-setup, which uses the service key and is the only thing that ever
-- sees a token.
drop policy if exists card_invites_staff_all on public.card_invites;
create policy card_invites_staff_all on public.card_invites
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

select count(*) as invites from public.card_invites;
