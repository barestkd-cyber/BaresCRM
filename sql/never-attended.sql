select c.first_name || ' ' || c.last_name as who,
       coalesce(c.joined_on::text, c.entered_on::text, '-') as joined,
       coalesce(c.source,'-') as source
  from contacts c
 where c.segment::text = 'active'
   and not exists (select 1 from attendance a where a.student_id = c.id)
 order by coalesce(c.joined_on, c.entered_on) desc nulls last;
