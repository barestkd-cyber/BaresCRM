select s.belt, s.stripe_key, s.source, coalesce(s.origin,'-') as origin,
       trim(c.first_name||' '||c.last_name) as student
  from public.student_stripes s
  left join public.contacts c on c.id = s.student_id
 order by s.belt, s.stripe_key;
