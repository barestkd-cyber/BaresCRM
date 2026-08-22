-- ===========================================================================
-- Digital agreement invites: "send digital agreement"
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-21: "the next page would give me three options... sign in
-- person, send digital agreement, or skip now" and "instead of them filling
-- out the information on a checkout page, it would already be prefilled and
-- they would just review it and then sign."
--
-- THE DOCUMENT IS FROZEN AT INVITE TIME. The invite carries the finished
-- document, not the ingredients for one, so what they sign at home is byte
-- for byte what was on the screen when it was sent. Nothing is re-rendered
-- from a template that may have moved in between, and the public signing
-- page needs no pricing logic, no catalog, and no agreement templates.
--
-- The 128-bit token is the entire gate, matching pos_sales.view_token. It
-- grants THIS one document and nothing else, it expires, and it is spent the
-- moment it is used.
-- ===========================================================================

create table if not exists public.agreement_invites (
  id                  uuid primary key default gen_random_uuid(),
  membership_id       uuid not null references public.memberships(id) on delete cascade,
  contact_id          uuid not null references public.contacts(id),
  token               text not null unique,
  sent_to             text not null,

  -- the frozen document, exactly as membership_agreements stores it
  program             text not null,
  plan_code           text,
  template_key        text not null,
  template_version    text not null,
  document_title      text not null,
  body_json           jsonb not null,
  body_text           text not null,
  body_html           text not null,
  down_cents          integer,
  recurring_cents     integer,
  pif_cents           integer,
  agreed_payment_date text,

  -- who we expect to sign, so the page can prefill and insist correctly
  signer_hint         text,
  is_minor            boolean not null default false,
  participant_name    text,

  created_by          text,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '14 days'),
  signed_at           timestamptz,
  agreement_id        uuid references public.membership_agreements(id),
  revoked_at          timestamptz
);

create index if not exists agreement_invites_membership_idx
  on public.agreement_invites(membership_id);
create index if not exists agreement_invites_open_idx
  on public.agreement_invites(membership_id) where signed_at is null and revoked_at is null;

alter table public.agreement_invites enable row level security;

-- Staff read and write. The public signing page never touches this table
-- directly: it goes through the agreement-sign function, which uses the
-- service key and is the only thing that ever sees a token.
drop policy if exists agreement_invites_staff_all on public.agreement_invites;
create policy agreement_invites_staff_all on public.agreement_invites
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='agreement_invites') as table_made,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='agreement_invites') as policies;
