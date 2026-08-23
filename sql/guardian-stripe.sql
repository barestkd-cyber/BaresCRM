-- ===========================================================================
-- A guardian's own Stripe customer
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-23: "nothing's broken right now in Stripe, it's doing the
-- right thing. I just need to make sure it doesn't get muddied up when I'm
-- adding cards to profiles, and that it associates a card with an email
-- address with a parent."
--
-- Today a Stripe customer is filed against a CONTACT, and for a paying parent
-- that contact is whichever child their email happened to match. Carlton's
-- cards are filed under his seven-year-old daughter. That has worked because
-- every card so far arrived through a checkout that knew who was paying.
--
-- It stops working the moment a card is added from a profile: sending an
-- update link from Luther's page would mint a SECOND customer called "Luther
-- Allen" and put the card there, leaving one man with two piles of cards that
-- never merge.
--
-- So the customer belongs on the guardian. The email is the key, exactly as
-- it is for the family default: a Stripe customer created at checkout carries
-- the paying adult's address, and so does their guardian record.
--
-- NOTHING IS MOVED IN STRIPE. Cards cannot be safely moved between customers
-- and there is no need: this only records which existing customer is whose.
-- The copy on contacts stays where it is and simply stops being what anything
-- reads.
-- ===========================================================================

alter table public.guardians
  add column if not exists stripe_customer_id text;

create unique index if not exists guardians_stripe_customer_idx
  on public.guardians (stripe_customer_id) where stripe_customer_id is not null;

comment on column public.guardians.stripe_customer_id is
  'The Stripe customer holding this person''s cards. Adopted by email match the first time their cards are listed.';

select count(*) as guardians,
       count(stripe_customer_id) as with_a_stripe_customer
from public.guardians;
