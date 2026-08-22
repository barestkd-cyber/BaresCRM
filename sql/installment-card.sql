-- ===========================================================================
-- Which card a single scheduled payment goes on
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-21: "the membership should show the card that's on file for
-- the membership, but it should be editable per payment in the payment list...
-- somebody might say, hey, we'll charge my credit card this month instead of
-- this card or whatever."
--
-- Null means "whatever the membership uses", which is the answer for almost
-- every row. Storing the membership's card on all twelve would mean changing
-- the membership card later silently missed the payments already laid out.
-- ===========================================================================

alter table public.membership_installments
  add column if not exists payment_method_id text;

comment on column public.membership_installments.payment_method_id is
  'Stripe payment method for THIS payment only. Null means use the membership default.';

-- Same idea one level up: the card the membership bills to by default.
alter table public.memberships
  add column if not exists payment_method_id text;

comment on column public.memberships.payment_method_id is
  'Stripe payment method this membership bills to. Null means the payer''s default card.';

select
  (select count(*) from information_schema.columns where table_schema='public'
    and table_name='membership_installments' and column_name='payment_method_id') as installment_col,
  (select count(*) from information_schema.columns where table_schema='public'
    and table_name='memberships' and column_name='payment_method_id') as membership_col;
