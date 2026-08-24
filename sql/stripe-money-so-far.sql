-- Read-only. Every Stripe-processed payment on the ledger, by studio-time day,
-- so the owner knows what total to expect on the payout side of the dashboard.
select (p.occurred_at at time zone 'America/Chicago')::date as day,
       count(*) as payments,
       round(sum(p.amount_cents)/100.0, 2) as gross_dollars
  from pos_payments p
 where p.stripe_object_id is not null
   and p.amount_cents > 0
 group by 1
 order by 1;
