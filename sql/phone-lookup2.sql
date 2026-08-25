-- The stragglers: private-lesson bookings, the LEGACY phone column left on
-- student_guardians from before guardians became people, and the leadership
-- signup key/value store (free text, so just substring the digits).
with q as (select '9035922239' as digits)
select 'private_lesson' as kind,
       coalesce(pl.student_name, '(no name)') as who,
       pl.phone as stored
  from private_lessons pl, q
 where regexp_replace(coalesce(pl.phone,''), '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'legacy student_guardians',
       coalesce(sg.label,'') || ' -> ' || c.first_name || ' ' || c.last_name,
       sg.phone
  from student_guardians sg
  join contacts c on c.id = sg.student_id, q
 where regexp_replace(coalesce(sg.phone,''), '\D', '', 'g') like '%' || q.digits || '%'
union all
select 'leadership signup blob', r.key, left(r.value, 120)
  from roster r, q
 where regexp_replace(coalesce(r.value,''), '\D', '', 'g') like '%' || q.digits || '%';
