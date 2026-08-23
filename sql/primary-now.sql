select h.name, h.primary_guardian_id,
       (select g.name from guardians g where g.id = h.primary_guardian_id) as primary_is
from households h;
