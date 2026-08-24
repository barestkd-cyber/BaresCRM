-- The enrollment vocabulary actually in use, and the programs classes gate on.
select 'program' as kind, program as value, status, count(*) as rows
  from enrollments group by 1,2,3
union all
select 'schedule prog_css', prog_css, null, count(*)
  from schedule_template group by 1,2,3
 order by 1, 4 desc, 2;
