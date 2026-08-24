-- Lindsay is Lee Tarry's wife (owner). Tag her Spouse so his profile reads
-- "Family and contacts" instead of calling her his guardian.
update guardians g
   set relation = 'Spouse'
 where g.name ilike 'lindsay%'
   and g.id in (select guardian_id from student_guardians
                 where student_id = '732dbbff-f4a6-47e6-8190-b5d97ba6816d')
returning g.id, g.name, g.relation;
