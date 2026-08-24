-- Read-only. What gender values the contacts table actually holds, so the
-- editor's dropdown offers the spellings already in the data.
select coalesce(gender, '(null)') as gender, count(*) as people
  from contacts
 group by 1 order by 2 desc;
