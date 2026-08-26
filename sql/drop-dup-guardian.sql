-- Race approved 2026-08-26: remove the duplicate guardian row on Sam Watkins.
-- It is the unnamed twin of "Dave Watkins" (same phone, same student); its one
-- email was already moved onto his named record, so this row now holds nothing
-- that is not on the record it duplicates.
--
-- Guarded three ways: this exact id, no name, and no emails left on it.
delete from student_guardians
 where guardian_id = '0093097b-3fe4-4f22-ad04-31ad7d775c74';

delete from guardians g
 where g.id = '0093097b-3fe4-4f22-ad04-31ad7d775c74'
   and coalesce(g.name,'') = ''
   and not exists (select 1 from guardian_emails ge where ge.guardian_id = g.id);

select c.first_name || ' ' || c.last_name as student,
       coalesce(string_agg(g.name || ' <' ||
         coalesce((select string_agg(ge.email,', ') from guardian_emails ge where ge.guardian_id=g.id),'-')
         || '>', ' | '), 'none') as guardians
  from contacts c
  left join student_guardians sg on sg.student_id = c.id
  left join guardians g on g.id = sg.guardian_id
 where c.first_name='Sam' and c.last_name='Watkins'
 group by 1;
