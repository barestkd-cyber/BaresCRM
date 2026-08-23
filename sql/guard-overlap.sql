select
  (select count(distinct student_id) from student_guardians) as students_with_guardians,
  (select count(distinct g.student_id) from student_guardians g
     join contacts c on c.id = g.student_id where c.spark_id is not null) as of_those_from_spark,
  (select count(distinct g.student_id) from student_guardians g
     join contacts c on c.id = g.student_id where c.spark_id is null) as of_those_not_spark,
  (select count(*) from student_guardians g
     left join contacts c on c.id = g.student_id where c.id is null) as orphan_rows,
  (select count(*) from contacts where spark_id is not null) as spark_contacts;
