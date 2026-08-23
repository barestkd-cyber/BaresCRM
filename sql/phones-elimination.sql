-- ===========================================================================
-- The last two, by elimination
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-23: "how can you not tell whose number is whose on the
-- Kubit, Jackson?" He is right and my rule was wrong, not the data.
--
-- I required a child to have exactly ONE guardian. What actually matters is
-- exactly one guardian WITHOUT a number. Johnny Kubit has Hillary Fort with
-- no phone and Jack with 4199800363, so Johnny's 8177910354 can only be
-- Hillary's. Scottie Jackson has Matt Jackson on 9035208590 already, so
-- 9032629678 is Lacy Musslewhite's.
--
-- Counting the wrong thing left two children holding a parent's number and
-- called it ambiguity.
-- ===========================================================================

with need as (
  select c.id as child,
         regexp_replace(c.phone, '[^0-9]', '', 'g') as digits,
         (select sg.guardian_id
            from student_guardians sg join guardians g on g.id = sg.guardian_id
           where sg.student_id = c.id and coalesce(array_length(g.phones,1),0) = 0
           limit 1) as guardian,
         (select count(*)
            from student_guardians sg join guardians g on g.id = sg.guardian_id
           where sg.student_id = c.id and coalesce(array_length(g.phones,1),0) = 0) as blanks
  from contacts c
  where c.phone is not null
    and c.dob is not null and date_part('year', age(c.dob)) < 18
),
placeable as (select * from need where blanks = 1 and guardian is not null)
update guardians g
set phones = array[ (select p.digits from placeable p where p.guardian = g.id limit 1) ]
where g.id in (select guardian from placeable);

update contacts c
set phone = null,
    tags = coalesce(c.tags, '{}') || array['phone-was-a-guardians: ' || c.phone]
where c.phone is not null
  and c.dob is not null and date_part('year', age(c.dob)) < 18
  and exists (
    select 1 from student_guardians sg join guardians g on g.id = sg.guardian_id
    where sg.student_id = c.id
      and regexp_replace(c.phone, '[^0-9]', '', 'g') = any(g.phones)
  );

select (select count(*) from guardians where array_length(phones,1) > 0) as guardians_with_a_phone,
       (select count(*) from contacts c where c.phone is not null
          and c.dob is not null and date_part('year', age(c.dob)) < 18) as minors_still_holding_one;
