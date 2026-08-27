-- Existing children carrying a parent's email or phone on their own contact,
-- from the same bug. A record is only cleared when that exact address or
-- number already sits on one of THEIR guardians - proof it is the parent's,
-- not a coincidence - so nobody's own details are ever removed.
update contacts c
   set email = null
 where coalesce(c.email,'') <> ''
   and exists (select 1 from student_guardians sg
                 join guardian_emails ge on ge.guardian_id = sg.guardian_id
                where sg.student_id = c.id and lower(ge.email) = lower(c.email))
   and coalesce(date_part('year', age((now() at time zone 'America/Chicago')::date, c.dob)), 0) < 18;

update contacts c
   set phone = null
 where coalesce(c.phone,'') <> ''
   and exists (select 1 from student_guardians sg
                 join guardians g on g.id = sg.guardian_id
                where sg.student_id = c.id
                  and regexp_replace(coalesce(array_to_string(g.phones,','),''),'\D','','g')
                      like '%' || regexp_replace(c.phone,'\D','','g') || '%'
                  and regexp_replace(c.phone,'\D','','g') <> '')
   and coalesce(date_part('year', age((now() at time zone 'America/Chicago')::date, c.dob)), 0) < 18;

-- And the Stripe customer that landed on Cody: it is his mother's card, so it
-- moves to her guardian record and comes off the child.
update guardians g
   set stripe_customer_id = 'cus_V98ms3khso3T0Z'
 where g.name = 'Michelle Mogle' and g.stripe_customer_id is null;
update contacts set stripe_customer_id = null
 where first_name='Cody' and last_name='Mogle' and stripe_customer_id = 'cus_V98ms3khso3T0Z';

select 'minors still holding a guardian email' as t, count(*)::text as v
  from contacts c
 where coalesce(c.email,'') <> ''
   and exists (select 1 from student_guardians sg join guardian_emails ge on ge.guardian_id=sg.guardian_id
                where sg.student_id=c.id and lower(ge.email)=lower(c.email))
union all
select 'Cody customer', coalesce((select coalesce(stripe_customer_id,'none') from contacts
   where first_name='Cody' and last_name='Mogle'),'-')
union all
select 'Michelle customer', coalesce((select coalesce(stripe_customer_id,'none') from guardians
   where name='Michelle Mogle'),'-');
