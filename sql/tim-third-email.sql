-- Tim typed a third address at checkout (tim@apples.email); put it on his
-- guardian row with the other two so every surface knows it (owner: "add
-- tims stupid email to his profile lmao").
insert into guardian_emails (id, guardian_id, email)
select gen_random_uuid(), g.id, 'tim@apples.email'
  from guardians g
 where g.name = 'Tim Apple'
   and not exists (select 1 from guardian_emails ge
                    where ge.guardian_id = g.id and lower(ge.email) = 'tim@apples.email');
select g.name, string_agg(ge.email, ' · ' order by ge.email) as emails
  from guardians g join guardian_emails ge on ge.guardian_id = g.id
 where g.name = 'Tim Apple' group by g.name;
