-- Who the receipts now resolve to for the children who lost a borrowed address
select c.first_name||' '||c.last_name as who,
       coalesce((select string_agg(l.email||' ('||l.why||')', ', ')
                   from public.contact_send_list(c.id) l), '(nobody)') as goes_to
from contacts c
where c.tags is not null and array_to_string(c.tags,',') like '%email-was-a-guardians%'
order by c.first_name;
