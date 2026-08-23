-- Contacts whose own email is in fact a guardian's address. For an adult who
-- IS that guardian it is correct. For a child it is a parent's address wearing
-- the child's name, which is what made Emerson read as having her own.
select c.first_name||' '||c.last_name as who,
       coalesce(date_part('year', age(c.dob))::int, -1) as yrs,
       c.email,
       (select string_agg(coalesce(g.name,'(unnamed)'), ', ') from guardian_emails ge
          join guardians g on g.id = ge.guardian_id
         where lower(ge.email) = lower(c.email)) as belongs_to
from contacts c
where c.email is not null
  and exists (select 1 from guardian_emails ge where lower(ge.email) = lower(c.email))
order by yrs;
