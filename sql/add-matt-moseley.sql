-- Matt Moseley, Harrison's dad (Race, 2026-08-27). He did not exist as a
-- guardian at all - Harrison had only Stephanie - so the person is created,
-- linked, given the address, and allowed into the parent portal.
-- Spark names him as Harrison's dad, which matches.

-- 1. The person.
insert into guardians (name, relation)
select 'Matt Moseley', 'Dad'
 where not exists (select 1 from guardians where name = 'Matt Moseley');

-- 2. His address. guardian_emails is UNIQUE on lower(email) globally, so the
--    guard is global too.
insert into guardian_emails (guardian_id, email)
select g.id, 'mattmoseley@protonmail.com'
  from guardians g
 where g.name = 'Matt Moseley'
   and not exists (select 1 from guardian_emails where lower(email) = 'mattmoseley@protonmail.com');

-- 3. Linked to Harrison. The legacy email column on the link is NOT NULL.
insert into student_guardians (student_id, guardian_id, label, email)
select c.id, g.id, 'Dad', 'mattmoseley@protonmail.com'
  from contacts c, guardians g
 where c.first_name ilike 'harrison' and c.last_name ilike 'moseley'
   and g.name = 'Matt Moseley'
   and not exists (select 1 from student_guardians x
                    where x.student_id = c.id and x.guardian_id = g.id);

-- 4. Allowed into the parent portal.
insert into allowed_emails (email, name)
select 'mattmoseley@protonmail.com', 'Matt Moseley'
 where not exists (select 1 from allowed_emails where lower(email) = 'mattmoseley@protonmail.com');

select 'Harrison guardians' as t,
       coalesce((select string_agg(g.name||' ('||coalesce(g.relation,'-')||') <'
           || coalesce((select string_agg(ge.email,', ') from guardian_emails ge where ge.guardian_id=g.id),'none')||'>', ' | ')
          from student_guardians sg join guardians g on g.id=sg.guardian_id
          join contacts c on c.id=sg.student_id
         where c.first_name ilike 'harrison' and c.last_name ilike 'moseley'),'none') as v
union all
select 'portal access',
       coalesce((select 'yes, as '||coalesce(name,'(no name)') from allowed_emails
                  where lower(email)='mattmoseley@protonmail.com'),'NO');
