-- Who else was hit by this? Guardians whose links disagree about the address,
-- which is exactly the shape that hid Liva.
select coalesce(g.name,'(nameless)') as guardian,
       count(distinct sg.email) as distinct_link_emails,
       count(distinct sg.student_id) as students,
       string_agg(distinct trim(c.first_name||' '||c.last_name), ', ') as who
  from public.student_guardians sg
  join public.guardians g on g.id = sg.guardian_id
  join public.contacts c on c.id = sg.student_id
 group by g.id, g.name
having count(distinct sg.email) > 1
 order by 2 desc, 1;
