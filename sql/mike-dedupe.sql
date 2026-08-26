-- Two "Mike Mohrbach" guardians: Race's (2026-08-23, carries his email and
-- phone) and mine (2026-08-26, carries contact_id back to Mike's own contact
-- record). Race approved removing one. Keep HIS - it holds the real contact
-- details - after moving the contact_id link onto it, so nothing is lost.
update guardians
   set contact_id = 'f1aa69bc-e124-4118-8a58-65eaa39b3c28'
 where id = 'cac82d9a-7e59-4cf6-9635-2eb9ab90f01b'
   and contact_id is null;

delete from student_guardians where guardian_id = '69795f4a-fe66-4a2b-b24a-e403bc098433';

delete from guardians g
 where g.id = '69795f4a-fe66-4a2b-b24a-e403bc098433'
   and not exists (select 1 from guardian_emails ge where ge.guardian_id = g.id)
   and coalesce(array_length(g.phones,1),0) = 0;

select 'Rebecca guardians' as t,
       coalesce(string_agg(g.name||' ('||coalesce(g.relation,'-')||') '||
         coalesce((select string_agg(ge.email,', ') from guardian_emails ge where ge.guardian_id=g.id),'-')
         ||' linked='||case when g.contact_id is null then 'no' else 'yes' end, ' | '),'none') as v
  from student_guardians sg join guardians g on g.id=sg.guardian_id
  join contacts c on c.id=sg.student_id
 where c.first_name='Rebecca' and c.last_name='Mohrbach'
union all
select 'Mike guardian rows', count(*)::text from guardians where name ilike '%mohrbach%';
