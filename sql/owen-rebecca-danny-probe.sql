-- Read-only. Ids for Owen Skinner and Rebecca Mohrbach, and every contact
-- that could be Danny Hardin (any segment - he was not in active/trial).
select 'NAMED' as probe, id::text, first_name || ' ' || last_name as who,
       coalesce(rank,'') as rank, segment::text, coalesce(dob::text,'') as dob
  from public.contacts
 where (first_name ilike 'owen' and last_name ilike 'skinner')
    or (first_name ilike 'rebecca' and last_name ilike 'mohrbach')
union all
select 'DANNY?', id::text, first_name || ' ' || last_name,
       coalesce(rank,''), segment::text, coalesce(dob::text,'')
  from public.contacts
 where last_name ilike '%hardin%' or first_name ilike 'dann%'
 order by 1, 3;
