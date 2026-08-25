-- Who a Spark blast would MISS, with the best reachable email for each:
-- their own, else their guardians'.
select c.segment::text as seg,
       c.first_name || ' ' || c.last_name as who,
       coalesce(c.source,'') as came_from,
       coalesce(nullif(c.email,''),
         (select string_agg(distinct ge.email, ', ')
            from student_guardians sg
            join guardians g on g.id = sg.guardian_id
            join guardian_emails ge on ge.guardian_id = g.id
           where sg.student_id = c.id), '(no email anywhere)') as reach
  from contacts c
 where c.spark_id is null
   and c.segment::text in ('active','trial','Active','Trial')
 order by c.segment::text, c.last_name, c.first_name;
