-- Every rank string actually stored on a person, and how many hold it.
select coalesce(nullif(trim(rank),''),'(no rank)') as rank, count(*) as people
  from public.contacts
 where segment in ('active','trial')
 group by 1 order by 2 desc, 1;
