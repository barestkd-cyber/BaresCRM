-- Owner ruling 2026-08-25: "no one should be able to generate their own
-- unpaid invoice from an online registration page."
--
-- 1. The hourly sweep: a web-checkout sale still pending_payment after 24
--    hours was abandoned; mark it so, and remove its never-paid census rows
--    (a registration that was never paid for was never a registration).
select cron.unschedule('sweep-abandoned-checkouts')
 where exists (select 1 from cron.job where jobname = 'sweep-abandoned-checkouts');
select cron.schedule(
  'sweep-abandoned-checkouts',
  '30 * * * *',
  $$
  with gone as (
    update public.pos_sales
       set status = 'abandoned'
     where status = 'pending_payment'
       and staff_email like '%-checkout@website'
       and created_at < now() - interval '24 hours'
    returning id
  )
  delete from public.testing_signups ts
   using gone g
   where ts.sale_id = g.id and ts.paid = false;
  $$
);

-- 2. Under the same ruling, the one existing orphan: Ray Allen's abandoned
--    3:53 PM attempt (he completed a fresh registration at 4:02). The unpaid
--    invoice comes off Oliver's profile and the duplicate census row goes.
update pos_sales set status = 'abandoned'
 where left(id::text, 8) = 'e7d79ec5' and status = 'unpaid';
delete from testing_signups ts
 using pos_sales s
 where s.id = ts.sale_id and left(s.id::text, 8) = 'e7d79ec5' and ts.paid = false;

select jobname, schedule from cron.job where jobname = 'sweep-abandoned-checkouts';
