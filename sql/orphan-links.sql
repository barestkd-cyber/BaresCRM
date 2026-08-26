select count(*) filter (where sg.guardian_id is null) as links_with_no_person,
       count(*) as total_links,
       coalesce(string_agg(distinct c.first_name||' '||c.last_name, ', ')
         filter (where sg.guardian_id is null), '-') as affected_students
  from student_guardians sg
  left join contacts c on c.id = sg.student_id;
