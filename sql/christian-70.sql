-- Owner, 2026-09-05: "Christian is a woman, and she's due seventy dollars.
-- So change her membership to that and set it to recur."
--
-- The plan's catalogue rate is $99; hers is an override at $70. Memberships
-- hold a frozen price on purpose, so this does not touch the catalogue or
-- anyone else on specialty_kickboxing.
--
-- Her membership started 2026-08-31 and that first $70 is invoiced and still
-- unpaid, so recurring picks up one month later: 2026-09-30, then monthly.
update public.memberships
   set final_recurring_cents = 7000,
       next_bill_on = date '2026-09-30'
 where id = 'f51be735-4773-4f96-b514-9bb8ed83453c';

select trim(c.first_name||' '||c.last_name) as student,
       m.program, m.billing_frequency,
       (m.final_recurring_cents/100.0) as recurring,
       m.started_on::text as started,
       m.next_bill_on::text as next_bill,
       coalesce(c.stripe_customer_id,'NO CARD ON FILE') as card
  from public.memberships m join public.contacts c on c.id=m.contact_id
 where m.id = 'f51be735-4773-4f96-b514-9bb8ed83453c';
