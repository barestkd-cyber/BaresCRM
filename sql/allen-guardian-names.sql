-- ===========================================================================
-- The two Allen guardian rows the automatic pass could not settle
-- ---------------------------------------------------------------------------
-- Emerson carries no spark_id, so the spark-keyed pass skipped her row
-- entirely. Her export row is the one that names both parents: Mom "Kristie
-- Allen", Dad "Carlton Allen".
--
-- carltonallen89@gmail.com is already confirmed as Carlton on LUTHER's row by
-- the automatic pass, and it is the same address on Emerson's row, so this is
-- the same person, not an inference.
--
-- kallen@uttyler.edu resolves to Kristie Allen: initial and surname both
-- agree, and she is the only other parent either child has. This is positive
-- evidence rather than the absence of a rival, which is the distinction that
-- kept Nicolas Cooke's row blank - there the address said "bill" while the
-- only named parent was Linda.
-- ===========================================================================

update public.student_guardians g set name = 'Carlton Allen'
from public.contacts c
where c.id = g.student_id and c.first_name = 'Emerson' and c.last_name = 'Allen'
  and lower(g.email) = 'carltonallen89@gmail.com' and g.name is null;

update public.student_guardians g set name = 'Kristie Allen'
from public.contacts c
where c.id = g.student_id and c.first_name = 'Luther' and c.last_name = 'Allen'
  and lower(g.email) = 'kallen@uttyler.edu' and g.name is null;

select c.first_name as student, coalesce(g.name,'(no name)') as guardian, g.label, g.email
from contacts c join student_guardians g on g.student_id = c.id
where c.last_name = 'Allen' and c.first_name in ('Luther','Emerson')
order by c.first_name, g.label;
