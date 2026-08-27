-- Race: Patrick is his own guardian, Craig Hughes secondary.
--
-- Patrick already IS his own guardian with his own email. What was missing is
-- ORDER: the profile ranks guardians by households.primary_guardian_id, and
-- Patrick was in no household, so he and Craig sorted arbitrarily - Craig could
-- lead. A household of one is the existing mechanism for saying who to ring
-- first, so he gets one with himself marked primary.
insert into households (name, primary_guardian_id)
select 'Larano',
       (select g.id from student_guardians sg join guardians g on g.id=sg.guardian_id
          join contacts c on c.id=sg.student_id
         where c.first_name='Patrick' and c.last_name='Larano' and g.name='Patrick Larano' limit 1)
 where not exists (
   select 1 from household_members hm join contacts c on c.id=hm.contact_id
    where c.first_name='Patrick' and c.last_name='Larano');

insert into household_members (household_id, contact_id)
select h.id, c.id
  from households h, contacts c
 where h.name='Larano' and c.first_name='Patrick' and c.last_name='Larano'
   and not exists (select 1 from household_members x
                    where x.household_id=h.id and x.contact_id=c.id);

-- His own address on his own contact row, which had none.
update contacts set email = 'florencepatricklarano@yahoo.com'
 where first_name='Patrick' and last_name='Larano' and coalesce(email,'')='';

select h.name as household,
       coalesce(g.name,'(none)') as primary_contact,
       (select string_agg(c2.first_name||' '||c2.last_name,', ')
          from household_members hm2 join contacts c2 on c2.id=hm2.contact_id
         where hm2.household_id=h.id) as members
  from households h left join guardians g on g.id=h.primary_guardian_id
 where h.name='Larano';
