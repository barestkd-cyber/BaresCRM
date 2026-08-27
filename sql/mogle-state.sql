select 'contact' as t,
       (select c.id::text||' seg='||c.segment::text||' src='||coalesce(c.source,'-')
             ||' created='||(c.created_at at time zone 'America/Chicago')::timestamp(0)::text
          from contacts c where c.first_name='Cody' and c.last_name='Mogle') as v
union all
select 'sale', (select left(s.id::text,8)||' '||s.status::text||' $'||(s.total_cents/100.0)::text
             ||' made '||(s.created_at at time zone 'America/Chicago')::timestamp(0)::text
          from pos_sales s join contacts c on c.id=s.buyer_contact_id
         where c.first_name='Cody' and c.last_name='Mogle')
union all
select 'membership', (select left(m.id::text,8)||' status='||m.status::text||' '||coalesce(m.program,'-')
          from memberships m join contacts c on c.id=m.contact_id
         where c.first_name='Cody' and c.last_name='Mogle')
union all
select 'enrollments', coalesce((select string_agg(e.program||' '||e.status,', ')
          from enrollments e join contacts c on c.id=e.student_id
         where c.first_name='Cody' and c.last_name='Mogle'),'none')
union all
select 'agreement', coalesce((select ma.status||' signed='||coalesce(ma.signed_at::date::text,'no')
          from membership_agreements ma join contacts c on c.id=ma.contact_id
         where c.first_name='Cody' and c.last_name='Mogle'),'none')
union all
select 'sweep job', (select schedule from cron.job where jobname='sweep-abandoned-checkouts');
