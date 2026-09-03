-- Read-only: is attendance actually being captured, by whom, and how recently?
select 'BYSOURCE' as probe, coalesce(source,'(null)') as a,
       count(*)::text as b,
       min(class_date)::text as c,
       max(class_date)::text as d
  from public.attendance group by source
union all
select 'RECENT30', class_date::text, count(*)::text,
       count(distinct student_id)::text, count(distinct class_label)::text
  from public.attendance
 where class_date > (now() at time zone 'America/Chicago')::date - 30
 group by class_date
union all
select 'TOTAL', count(*)::text, count(distinct student_id)::text,
       count(distinct class_label)::text, max(class_date)::text
  from public.attendance
 order by 1, 2 desc;
