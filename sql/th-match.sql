-- How many of the roster will find their testing history under their name,
-- and how many names in the testing records match nobody.
select
  (select count(*) from contacts c
     where exists (select 1 from testing_history t
                   where lower(trim(t.student_name)) = lower(trim(c.first_name||' '||c.last_name)))) as roster_with_history,
  (select count(distinct lower(trim(student_name))) from testing_history) as names_in_history,
  (select count(distinct lower(trim(t.student_name))) from testing_history t
     where not exists (select 1 from contacts c
                       where lower(trim(c.first_name||' '||c.last_name)) = lower(trim(t.student_name)))) as names_matching_nobody;
