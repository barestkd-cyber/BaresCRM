-- ===========================================================================
-- One canonical spelling for every rank (owner rulings, 2026-09-04).
-- ---------------------------------------------------------------------------
--   * ONE stored form, the formal spelling. "Sr." is a rendering choice in the
--     CRM and testing app, never a second value in the data - two stored
--     spellings is what made Jun-Gun find no curriculum and forced the cert
--     tool to fuzzy-match ranks.
--   * Every black rank carries "Black Belt".
--   * Level 2 is written "Lvl 2." everywhere, certificates included.
--
-- Five values change, touching four people. Everything else already matches.
-- ===========================================================================
update public.contacts c
   set rank = v.to_rank
  from (values
    ('1st Degree Decided Level 2',            '1st Degree Decided Black Belt Lvl 2.'),
    ('1st Degree Senior Level 2',             '1st Degree Senior Black Belt Lvl 2.'),
    ('2nd Degree Black Belt Level 2',         '2nd Degree Black Belt Lvl 2.'),
    ('2nd Degree Decided Black Belt Level 2', '2nd Degree Decided Black Belt Lvl 2.'),
    ('2nd Degree Senior Black Belt Level 2',  '2nd Degree Senior Black Belt Lvl 2.')
  ) as v(from_rank, to_rank)
 where c.rank = v.from_rank;

-- The same five strings appear on testing signups, which are the record of
-- what someone held on the day. Move them together or the census disagrees
-- with the profile.
update public.testing_signups t
   set rank = v.to_rank
  from (values
    ('1st Degree Decided Level 2',            '1st Degree Decided Black Belt Lvl 2.'),
    ('1st Degree Senior Level 2',             '1st Degree Senior Black Belt Lvl 2.'),
    ('2nd Degree Black Belt Level 2',         '2nd Degree Black Belt Lvl 2.'),
    ('2nd Degree Decided Black Belt Level 2', '2nd Degree Decided Black Belt Lvl 2.'),
    ('2nd Degree Senior Black Belt Level 2',  '2nd Degree Senior Black Belt Lvl 2.')
  ) as v(from_rank, to_rank)
 where t.rank = v.from_rank;

-- student_stripes.belt names a rank too, and a renamed rank would orphan a
-- student's stripes at that belt.
update public.student_stripes s
   set belt = v.to_rank
  from (values
    ('1st Degree Decided Level 2',            '1st Degree Decided Black Belt Lvl 2.'),
    ('1st Degree Senior Level 2',             '1st Degree Senior Black Belt Lvl 2.'),
    ('2nd Degree Black Belt Level 2',         '2nd Degree Black Belt Lvl 2.'),
    ('2nd Degree Decided Black Belt Level 2', '2nd Degree Decided Black Belt Lvl 2.'),
    ('2nd Degree Senior Black Belt Level 2',  '2nd Degree Senior Black Belt Lvl 2.')
  ) as v(from_rank, to_rank)
 where s.belt = v.from_rank;

select 'contacts' as tbl, rank, count(*) as n from public.contacts
 where rank ilike '%Lvl 2.%' or rank ilike '%Level 2%' group by 1,2
union all
select 'testing_signups', rank, count(*) from public.testing_signups
 where rank ilike '%Lvl 2.%' or rank ilike '%Level 2%' group by 1,2
union all
select 'student_stripes', belt, count(*) from public.student_stripes
 where belt ilike '%Lvl 2.%' or belt ilike '%Level 2%' group by 1,2
 order by 1,2;
