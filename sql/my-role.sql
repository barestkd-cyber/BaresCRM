-- Do the people who use the CRM hold a role the stripe policies accept?
select coalesce(p.role,'(none)') as role, count(*) as people,
       case when coalesce(p.role,'') in ('admin','instructor') then 'can log stripes'
            else 'CANNOT log stripes' end as verdict
from profiles p group by p.role order by 2 desc;
