select 'sales near 16:45' as t,
       coalesce(string_agg(left(s.id::text,8)||' '||s.status::text||' $'||(s.total_cents/100.0)::text
         ||' '||coalesce(s.payer_name,'-')||' <'||coalesce(s.payer_email,'-')||'> @'
         ||(s.created_at at time zone 'America/Chicago')::timestamp(0)::text, ' | ' order by s.created_at),'none') as v
  from pos_sales s
 where s.created_at between '2026-08-27 21:00:00+00' and '2026-08-27 22:30:00+00'
union all
select 'testing signups near then',
       coalesce((select string_agg(ts.student_name||' paid='||ts.paid::text,', ')
          from testing_signups ts
         where ts.created_at between '2026-08-27 21:00:00+00' and '2026-08-27 22:30:00+00'),'none')
union all
select 'contacts created near then',
       coalesce((select string_agg(c.first_name||' '||c.last_name||' ('||c.segment::text||')',', ')
          from contacts c
         where c.created_at between '2026-08-27 21:00:00+00' and '2026-08-27 22:30:00+00'),'none');
