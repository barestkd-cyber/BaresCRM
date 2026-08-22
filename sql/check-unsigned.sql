select c.first_name||' '||c.last_name as who, m.program, m.started_on, m.status
from memberships m
join contacts c on c.id = m.contact_id
left join membership_agreements a
  on a.membership_id = m.id and a.status = 'signed'
where m.status = 'active' and a.id is null
order by m.created_at;
