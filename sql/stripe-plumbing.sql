select
  (select count(*) from students) as students_rows,
  (select count(*) from contacts) as contacts_rows,
  (select count(*) from students s join contacts c on c.id = s.id) as ids_that_match,
  (select count(*) from student_stripes) as stripe_rows,
  (select count(*) from student_stripes st join contacts c on c.id = st.student_id) as stripes_on_a_contact,
  (select count(*) from student_stripes st join students s on s.id = st.student_id) as stripes_on_a_student;
