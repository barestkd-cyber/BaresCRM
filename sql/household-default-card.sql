-- ===========================================================================
-- The family's default card
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-23: "primary contact's card is the family default if there
-- are multiple on file unless set otherwise by me."
--
-- So this column is the OVERRIDE, not the answer. Left null, the default is
-- derived from whoever the household's primary contact is, which means one
-- decision he has already made does two jobs. Set, it wins - the Allens are
-- exactly the case where mum is who you ring and dad's card pays.
--
-- Stripe's own per-customer default is a different thing and stays what it
-- is: it decides which card Stripe reaches for within ONE customer, and knows
-- nothing about families.
--
-- Linking a guardian to a Stripe customer goes through the address. A card
-- belongs to a contact's Stripe customer, but that customer was created with
-- the PAYING ADULT's email at checkout, so Carlton's guardian record and
-- Carlton's Stripe customer share carltonallen89@ even though the customer
-- hangs off his daughter's contact.
-- ===========================================================================

alter table public.households
  add column if not exists default_payment_method text;

comment on column public.households.default_payment_method is
  'Override for the family default card. Null means use the primary contact''s.';

select h.name,
       (select g.name from guardians g where g.id = h.primary_guardian_id) as primary_contact,
       coalesce(h.default_payment_method, '(derived from the primary contact)') as family_card
from households h;
