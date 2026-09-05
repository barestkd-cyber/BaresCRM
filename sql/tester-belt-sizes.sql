select trim(c.first_name||' '||c.last_name) as student,
       coalesce(c.rank,'') as rank,
       coalesce(nullif(trim(c.belt_size),''),'—') as belt_size
  from public.testing_signups ts
  join public.contacts c on c.id = ts.contact_id
 group by 1,2,3
 order by 3, 1;
