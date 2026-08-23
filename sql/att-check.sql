-- Do the CRM's own attendance records agree that most of these people
-- stopped coming? The export's "last seen" is only as fresh as the export.
select
  (select count(*) from contacts where spark_id is not null) as spark_people,
  (select count(distinct student_id) from attendance
     where class_date >= (current_date - 30)) as seen_last_30d,
  (select count(distinct student_id) from attendance
     where class_date >= (current_date - 180)) as seen_last_180d,
  (select max(class_date)::text from attendance) as latest_attendance,
  (select count(*) from attendance) as attendance_rows;
