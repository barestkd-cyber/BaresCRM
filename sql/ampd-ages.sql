-- Read-only. Who is actually enrolled in AMP'D and Leadership, with ages,
-- to ground the divisions cells in the Phase-1 backfill table.
select e.program,
       c.first_name || ' ' || c.last_name as student,
       date_part('year', age((now() at time zone 'America/Chicago')::date, c.dob))::int as age
  from enrollments e
  join contacts c on c.id = e.student_id
 where e.status = 'active'
   and e.program in ('AMP''D', 'Leadership')
 order by e.program, age;
