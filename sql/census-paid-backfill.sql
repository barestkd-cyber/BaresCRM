-- The census paid flag only flipped when the BROWSER finalize won the race;
-- the webhook backstop flipped the sale and never told the census. Make the
-- flag agree with the ledger it summarizes.
update testing_signups ts
   set paid = true
  from pos_sales s
 where s.id = ts.sale_id and s.status = 'paid' and ts.paid = false;
select ts.paid, count(*) from testing_signups ts
 where ts.created_at >= '2026-08-24 05:00:00+00' group by 1;
