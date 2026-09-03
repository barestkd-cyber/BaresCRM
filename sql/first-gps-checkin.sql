select a.class_date::text as on_date, a.class_label, a.source,
       a.status, a.recorded_by,
       trim(c.first_name||' '||c.last_name) as student
  from public.attendance a
  left join public.contacts c on c.id = a.student_id
 where a.source in ('parent','parent_gps')
 order by a.class_date desc;
