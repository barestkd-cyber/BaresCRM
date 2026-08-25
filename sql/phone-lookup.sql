-- Who does a phone number belong to? Digits-only compare on both sides, so
-- formatting in the stored value cannot hide a match. Checks participants,
-- guardians, and the emergency-contact list.
with q as (select '9035922239' as digits)
select 'contact' as kind,
       c.first_name || ' ' || c.last_name as who,
       c.phone as stored, c.segment::text as extra, c.rank as extra2
  from contacts c, q
 where regexp_replace(coalesce(c.phone,''), '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'guardian',
       g.name,
       p.nr, g.relation, null
  from guardians g
       cross join lateral unnest(coalesce(g.phones, array[]::text[])) as p(nr),
       q
 where regexp_replace(coalesce(p.nr,''), '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'student_contact',
       sc.name || ' (for ' || c2.first_name || ' ' || c2.last_name || ')',
       sc.phone, sc.kind::text, sc.relationship
  from student_contacts sc
  join contacts c2 on c2.id = sc.student_id, q
 where regexp_replace(coalesce(sc.phone,''), '\D', '', 'g') like '%' || q.digits || '%';
