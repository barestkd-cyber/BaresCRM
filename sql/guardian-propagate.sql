-- ===========================================================================
-- One address, one person: carry a known name across every row that shares it
-- ---------------------------------------------------------------------------
-- The export named parents per STUDENT, so a family's address got a name on
-- whichever child's row it happened to match and stayed blank on the
-- siblings. Colette Toit is named on Belle's row and blank on Evelyn's, June's
-- and Noah's, for the same address and the same woman.
--
-- Nothing is inferred here. If dutoitcolette@ is Colette on one row it is
-- Colette on all of them, because it is the same mailbox.
--
-- Guarded against an address that somehow carries two different names: only
-- addresses resolving to exactly ONE name are propagated.
-- ===========================================================================

with named as (
  select lower(email) as email, min(name) as name
  from public.student_guardians
  where email is not null and name is not null and name <> ''
  group by lower(email)
  having count(distinct name) = 1
)
update public.student_guardians g
set name = n.name
from named n
where lower(g.email) = n.email and g.name is null;

select count(*) filter (where name is not null and name <> '') as named,
       count(*) as total,
       count(*) filter (where name is null and email is not null) as still_blank
from public.student_guardians;
