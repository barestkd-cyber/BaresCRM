select 'GUARDIAN' as probe, coalesce(g.name,'(nameless)') as a, ge.email as b,
       coalesce((select string_agg(trim(k.first_name||' '||k.last_name), ', ')
                   from public.student_guardians sg
                   join public.contacts k on k.id=sg.student_id
                  where sg.guardian_id=g.id),'(no students)') as c
  from public.guardian_emails ge join public.guardians g on g.id=ge.guardian_id
 where ge.email ilike 'shop3116%'
union all
select 'CONTACT', trim(first_name||' '||last_name), coalesce(email,''), segment::text
  from public.contacts where email ilike 'shop3116%' or last_name ilike '%eagleton%'
union all
select 'LINES', l.label, coalesce(l.student_contact_id::text,'(no student)'),
       (l.line_total_cents/100.0)::text
  from public.pos_sale_lines l
 where l.sale_id = 'c6704a0a-3586-4fcb-acaa-d3d2bca56022'
 order by 1,2;
