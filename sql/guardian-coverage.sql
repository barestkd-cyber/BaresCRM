-- Now that staff can read them: who has a guardian and who does not.
with kids as (
  select c.id, c.first_name||' '||c.last_name as who, c.dob, c.segment,
         date_part('year', age(c.dob))::int as yrs
  from contacts c
  where c.dob is not null and date_part('year', age(c.dob)) < 18
)
select
  (select count(*) from kids) as minors,
  (select count(*) from kids k where exists (select 1 from student_guardians g where g.student_id = k.id)) as minors_with_guardian,
  (select count(*) from kids k where not exists (select 1 from student_guardians g where g.student_id = k.id)) as minors_without,
  (select count(*) from contacts where dob is null) as contacts_no_dob,
  (select count(*) from student_guardians) as guardian_rows,
  (select count(*) from student_guardians where name is null or name = '') as guardian_rows_no_name,
  (select count(*) from student_guardians where phone is null or phone = '') as guardian_rows_no_phone;
