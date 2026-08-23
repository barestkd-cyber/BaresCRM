-- ===========================================================================
-- The children whose phone the Spark pass could not place
-- ---------------------------------------------------------------------------
-- These 13 came from website signups rather than the Spark export, so the
-- email-to-phone pairing that placed the other 74 did not exist for them.
--
-- The rule here is narrower and needs no guessing: a MINOR with exactly ONE
-- guardian, and that guardian has no phone at all. A four-year-old's number
-- is his mother's, and there is only one candidate mother.
--
-- Johnny Kubit and Scottie Jackson are deliberately left alone: each has two
-- guardians and one of them already has a different number on file, so which
-- adult this belongs to is a real question rather than an obvious one.
--
-- Numbers are normalised to digits on the way over. "903-705-3319" and
-- "19037055581" are the same shape of thing as the rest and should sort and
-- match like them.
-- ===========================================================================

with one_each as (
  select c.id as child, c.phone,
         (select sg.guardian_id from student_guardians sg where sg.student_id = c.id) as guardian
  from contacts c
  where c.phone is not null
    and c.dob is not null and date_part('year', age(c.dob)) < 18
    and (select count(*) from student_guardians sg where sg.student_id = c.id) = 1
),
placeable as (
  select o.child, o.guardian,
         regexp_replace(o.phone, '[^0-9]', '', 'g') as digits
  from one_each o
  join guardians g on g.id = o.guardian
  where coalesce(array_length(g.phones, 1), 0) = 0
)
update guardians g
set phones = array[ (select p.digits from placeable p where p.guardian = g.id limit 1) ]
where g.id in (select guardian from placeable);

update contacts c
set phone = null,
    tags = array_remove(coalesce(c.tags, '{}'), 'phone-was-a-guardians')
           || array['phone-was-a-guardians: ' || c.phone]
where c.phone is not null
  and c.dob is not null and date_part('year', age(c.dob)) < 18
  and (select count(*) from student_guardians sg where sg.student_id = c.id) = 1
  and exists (
    select 1 from student_guardians sg join guardians g on g.id = sg.guardian_id
    where sg.student_id = c.id
      and regexp_replace(c.phone, '[^0-9]', '', 'g') = any(g.phones)
  );

select (select count(*) from guardians where array_length(phones,1) > 0) as guardians_with_a_phone,
       (select count(*) from contacts c where c.phone is not null
          and c.dob is not null and date_part('year', age(c.dob)) < 18) as minors_still_holding_one;
