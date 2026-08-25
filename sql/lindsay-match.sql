select 'guardian_email holds it' as t,
       coalesce(g.name, '(nobody)') as v
  from guardian_emails ge join guardians g on g.id = ge.guardian_id
 where lower(ge.email) = 'lindsay.louis26@gmail.com'
union all
select 'guardian named Louis', g.name || ' · cust=' || coalesce(g.stripe_customer_id,'none')
  from guardians g where g.name ilike '%louis%'
union all
select 'legacy link email', sg.email || ' -> ' || c.first_name || ' ' || c.last_name
  from student_guardians sg join contacts c on c.id = sg.student_id
 where lower(sg.email) like '%louis%'
union all
select 'guardians of Cade', coalesce(g.name,'NONE AT ALL')
  from contacts c
  left join student_guardians sg on sg.student_id = c.id
  left join guardians g on g.id = sg.guardian_id
 where c.first_name='Cade' and c.last_name='Louis';
