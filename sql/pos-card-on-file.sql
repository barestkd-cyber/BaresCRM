-- ============================================================================
-- BaresTKD — keyed card payments at the POS + card on file
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Adds the two columns the pos-charge function needs so a card run at the desk
-- attaches to a Stripe customer and stays on file for later charges (the
-- owner's locked model: Race can charge a member whenever they owe; customers
-- never manage their own cards).
-- ============================================================================

-- Which Stripe customer a person is, so a saved card can be found again.
alter table public.contacts   add column if not exists stripe_customer_id text;
-- Denormalised onto the sale so a charge does not have to resolve the buyer
-- twice, and so a walk-in sale can still carry one.
alter table public.pos_sales  add column if not exists stripe_customer_id text;

create index if not exists contacts_stripe_customer_idx
  on public.contacts(stripe_customer_id) where stripe_customer_id is not null;

comment on column public.contacts.stripe_customer_id is
  'Stripe customer. Cards saved against it are charged BY STAFF only; customers never see or manage them.';

-- ─── ROLLBACK (commented) ───────────────────────────────────────────────────
-- drop index if exists contacts_stripe_customer_idx;
-- alter table public.pos_sales drop column if exists stripe_customer_id;
-- alter table public.contacts  drop column if exists stripe_customer_id;
