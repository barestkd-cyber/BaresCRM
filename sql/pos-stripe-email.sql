-- ============================================================================
-- BaresTKD — capture the email the payer types at Stripe checkout
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor, AFTER pos-receipt-email.sql.
-- Safe to re-run.
--
-- THE PROBLEM THIS FIXES: a walk-in sale has no buyer_contact_id, so
-- send-receipt had nobody to mail and skipped with "walk-in sale, nobody to
-- email". The customer paid and got nothing, and neither did the owner.
--
-- Stripe Checkout always collects an email. Recording it here means:
--   * the receipt has somewhere to go even with no CRM profile behind the sale;
--   * when the payer uses a DIFFERENT address than the one on their profile,
--     the CRM can ask before adopting it. The webhook never edits a contact
--     on its own — an address typed at a checkout page is not proof of
--     identity, and silently overwriting a member's email would quietly
--     redirect every future receipt.
-- ============================================================================

alter table public.pos_sales add column if not exists stripe_email text;

comment on column public.pos_sales.stripe_email is
  'Email the payer entered at Stripe checkout. Recorded as-is; never written back to contacts without staff confirmation in the CRM.';

-- Finding sales whose payer used an address that is not on the profile.
create index if not exists pos_sales_stripe_email_idx
  on public.pos_sales(stripe_email)
  where stripe_email is not null;

-- ─── ROLLBACK (commented) ───────────────────────────────────────────────────
-- drop index if exists pos_sales_stripe_email_idx;
-- alter table public.pos_sales drop column if exists stripe_email;
