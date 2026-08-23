select h.name as household,
       string_agg(c.first_name||' '||c.last_name, ', ' order by c.first_name) as members
from households h
left join household_members m on m.household_id = h.id
left join contacts c on c.id = m.contact_id
group by h.id, h.name;
