-- ============================================================================
-- BaresTKD — Signed membership agreements
-- ----------------------------------------------------------------------------
-- Run ONCE, by hand, in the Supabase SQL editor (project akdncbzxiwvihfcyijvm),
-- AFTER membership-schema.sql. The POS writes here at the end of every
-- membership sale; the profile reads from it. Safe to re-run.
--
-- WHY THE DOCUMENT IS STORED, NOT JUST REFERENCED
-- The full rendered agreement is frozen into this row at signing time
-- (body_json + body_text), exactly like the pricing snapshot on `memberships`.
-- Revising a template or changing a price must never alter what somebody
-- already put their name to. To know what a member agreed to, you read this
-- row — never the current template.
--
-- One complete standalone agreement per program (owner decision 2026-08-14):
-- every clause in the signed document applies to that program, so there is no
-- conditional language to interpret after the fact.
-- ============================================================================

create table if not exists membership_agreements (
  id                  uuid primary key default gen_random_uuid(),

  -- What it covers. membership_id is the anchor; contact_id and sale_id are
  -- kept denormalized so an agreement is still findable if a membership row is
  -- ever reshaped.
  membership_id       uuid references memberships(id) on delete set null,
  contact_id          uuid not null references contacts(id) on delete cascade,
  sale_id             uuid,
  program             text not null,
  plan_code           text,

  -- Which document, and which revision of it.
  template_key        text not null,
  template_version    text not null,
  document_title      text not null,

  -- The frozen document. body_json is the rendered block structure (what the
  -- viewer re-renders); body_text is the same content flattened, so the
  -- agreement stays readable even if the renderer changes.
  body_json           jsonb not null,
  body_text           text  not null,

  -- The money that was on the page, denormalized for reporting. Cents.
  down_cents          integer,
  recurring_cents     integer,
  pif_cents           integer,
  agreed_payment_date text,

  -- Who signed. signature_png is a data: URL of the drawn signature.
  signer_name         text not null,
  signer_relationship text,
  signer_initials     text,
  signature_png       text,
  signed_at           timestamptz not null default now(),

  -- Provenance.
  signed_with_staff   text,
  user_agent          text,
  status              text not null default 'signed'
                        check (status in ('signed','voided','superseded')),
  voided_reason       text,
  created_at          timestamptz not null default now()
);

create index if not exists membership_agreements_membership_idx on membership_agreements(membership_id);
create index if not exists membership_agreements_contact_idx    on membership_agreements(contact_id);
create index if not exists membership_agreements_sale_idx       on membership_agreements(sale_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- House style: one staff-all policy using is_staff(). A signed agreement
-- carries a signature image and family detail; nothing here is public. If a
-- member-facing copy is ever wanted, it goes through an Edge Function with a
-- view token (the receipt-view pattern), NOT by opening this table to anon.
alter table membership_agreements enable row level security;

drop policy if exists membership_agreements_staff_all on membership_agreements;
create policy membership_agreements_staff_all on membership_agreements
  for all using (is_staff()) with check (is_staff());

-- ─── ROLLBACK (commented) ───────────────────────────────────────────────────
-- drop policy if exists membership_agreements_staff_all on membership_agreements;
-- drop table if exists membership_agreements;
