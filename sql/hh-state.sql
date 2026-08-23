select h.id as household_id, h.name,
       c.first_name||' '||c.last_name as member, c.email
from households h
join household_members m on m.household_id = h.id
join contacts c on c.id = m.contact_id
where c.last_name ilike 'allen'
order by h.id, c.first_name;
