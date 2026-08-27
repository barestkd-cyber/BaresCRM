-- 1. The hourly sweep also stands down what an abandoned checkout left behind.
--    Marking the SALE abandoned was never enough: the pending membership and
--    pending roster place stayed pending forever, and the contact stayed on
--    whatever segment it was created with.
select cron.unschedule('sweep-abandoned-checkouts')
 where exists (select 1 from cron.job where jobname='sweep-abandoned-checkouts');
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
  ),
  m as (
    update public.memberships mm set status = 'cancelled'
      from gone g where mm.sale_id = g.id and mm.status = 'pending'
    returning 1
  ),
  e as (
    delete from public.enrollments ee
     using gone g where ee.sale_id = g.id and ee.status = 'pending'
    returning 1
  )
  delete from public.testing_signups ts
   using gone g
   where ts.sale_id = g.id and ts.paid = false;
  $$
);

-- 2. Cody Mogle, who filled the Cubs form at 18:44 today and never paid. He is
--    a lead who showed real intent, not an active student.
update contacts set segment = 'lead'
 where first_name='Cody' and last_name='Mogle' and segment::text = 'active';
update memberships m set status = 'cancelled'
  from contacts c where c.id = m.contact_id
   and c.first_name='Cody' and c.last_name='Mogle' and m.status::text = 'pending';
delete from enrollments e using contacts c
 where c.id = e.student_id and c.first_name='Cody' and c.last_name='Mogle' and e.status = 'pending';

select c.first_name||' '||c.last_name as who, c.segment::text as segment,
       coalesce((select m.status::text from memberships m where m.contact_id=c.id),'-') as membership,
       coalesce((select string_agg(e.program||' '||e.status,', ') from enrollments e where e.student_id=c.id),'none') as rosters,
       coalesce((select s.status::text from pos_sales s where s.buyer_contact_id=c.id),'-') as invoice
  from contacts c where c.first_name='Cody' and c.last_name='Mogle';
