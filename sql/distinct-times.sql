-- Every distinct class time in the schedule, to prove an AM/PM rule against
-- real data rather than guessing.
select coalesce(time,'(null)') as class_time, count(*) as slots,
       string_agg(distinct label, ', ') as classes
  from public.schedule_template group by time order by 1;
