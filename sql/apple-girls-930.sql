-- Race, 2026-08-27: Lua and Liva Apple test at 9:30, not the 11:00 they
-- registered for. (Annaleigh stays at 11:00 on purpose - she tests with her
-- sister Emmalyn; families are not split unnecessarily.)
update testing_signups ts
   set testing_date_id = (select id from testing_dates
                           where label = 'Juniors, White through Orange Belt')
 where ts.student_name in ('Lua Apple','Liva Apple')
   and ts.testing_date_id = (select id from testing_dates
                              where label = 'Juniors Green Belt and up, and all Teens and Adults');

select ts.student_name, td.label as test_group, td.start_time
  from testing_signups ts join testing_dates td on td.id = ts.testing_date_id
 where ts.student_name in ('Lua Apple','Liva Apple','Annaleigh Boitnott','Emmalyn Boitnott')
 order by td.sort_order, ts.student_name;
