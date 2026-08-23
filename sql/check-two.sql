select c.first_name||' '||c.last_name as child,
       (select string_agg(coalesce(g.name,'(unnamed)')||' '||coalesce(array_to_string(g.phones,'/'),'none'), ' | ')
          from student_guardians sg join guardians g on g.id = sg.guardian_id
         where sg.student_id = c.id) as guardians
from contacts c
where c.first_name in ('Johnny','Scottie') and c.last_name in ('Kubit','Jackson');
