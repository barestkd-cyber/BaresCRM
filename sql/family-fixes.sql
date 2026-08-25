-- Three family fixes, owner-approved 2026-08-25. (Second run: the link table
-- keeps a legacy NOT NULL email column, so the insert carries one now.)

delete from student_guardians a
 where a.guardian_id = '4f2f0259-f453-4bcf-b651-573972d56eae'
   and a.student_id = (select id from contacts where first_name='Lua' and last_name='Apple')
   and a.ctid <> (select min(b.ctid) from student_guardians b
                   where b.guardian_id = a.guardian_id and b.student_id = a.student_id);

insert into student_guardians (student_id, guardian_id, label, email)
select c.id, g.id, 'Guardian',
       coalesce((select ge.email from guardian_emails ge where ge.guardian_id=g.id limit 1), '')
  from contacts c, guardians g
 where c.first_name='Madison' and c.last_name='Newsom'
   and g.name='Tonya Newsom'
   and not exists (select 1 from student_guardians x
                    where x.student_id=c.id and x.guardian_id=g.id);

update guardians set stripe_customer_id = 'cus_V8MOpy3AtGB5VS'
 where name = 'Tonya Newsom' and stripe_customer_id is null;
update guardians set stripe_customer_id = 'cus_V8NATxx6gg3J7q'
 where name = 'Tim Apple' and stripe_customer_id is null;
-- Tessa's old customer, kept here for the record: cus_V8GkNWtPV7rEru.
update guardians set stripe_customer_id = 'cus_V8MKb9tMHfrlyJ'
 where name = 'Tessa Wingfield' and stripe_customer_id = 'cus_V8GkNWtPV7rEru';

select g.name, coalesce(g.relation,'') as rel, coalesce(g.stripe_customer_id,'NULL') as customer,
       (select count(*) from student_guardians sg where sg.guardian_id=g.id) as kids
  from guardians g
 where g.name in ('Tessa Wingfield','Tonya Newsom','Tim Apple')
 order by g.name;
