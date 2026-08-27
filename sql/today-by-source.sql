select coalesce(s.staff_email,'-') as source,
       s.status::text,
       count(*) as sales,
       max((s.created_at at time zone 'America/Chicago')::timestamp(0))::text as latest
  from pos_sales s
 where s.created_at >= '2026-08-27 05:00:00+00'
 group by 1,2 order by 4 desc;
