-- ===========================================================================
-- The rest, in two kinds
-- ---------------------------------------------------------------------------
-- ADULT STUDENTS whose "guardian" row is their own address. Betsy Thrash is
-- 57, Travis Splinter 63, David Smith 64; the row exists because every
-- checkout writes one, not because they have a guardian. Naming it after
-- themselves is simply true.
--
-- ADDRESSES THAT CARRY A WHOLE NAME. teaguejust@ is Justin Teague, named as
-- the dad on both Teague boys' rows. bodifordbreanna@ is Breanna Bodiford.
-- These read a first name AND a surname out of the address, which is a
-- stronger claim than the first-name rule used earlier.
--
-- Names propagate to siblings afterwards: chris.rabon@ names Christopher on
-- his own row and on his daughter Elizana's, sgtapple444@ names Tim on his
-- own and on Lua's.
--
-- Still left alone deliberately: whiggins1980@ and antdawson88@ carry an
-- initial or a nickname and no first name; leertarry@ could be the ten-year-
-- old Lee Tarry Jr or his father Lee Tarry; dcwatkins04@ is contested between
-- Michelle and Dave. Guessing any of those writes the wrong human onto a
-- child's record.
-- ===========================================================================

update public.student_guardians set name = v.name
from (values
  -- adult students, their own address
  ('madisonnewsom804@gmail.com',      'Madison Newsom'),
  ('florencepatricklarano@yahoo.com', 'Patrick Larano'),
  ('jeremyleehernandez@gmail.com',    'Jeremy Hernandez'),
  ('betsythrash@yahoo.com',           'Betsy Thrash'),
  ('bthrash@tylertexas.com',          'Betsy Thrash'),
  ('zach0893@gmail.com',              'Zachary Lackey'),
  ('splintert.ts@gmail.com',          'Travis Splinter'),
  ('dsmithnbtx@gmail.com',            'David Smith'),
  ('cortes1237@gmail.com',            'Fabian Cortes'),
  ('ozzyt@ymail.com',                 'Troy Osborne'),
  ('chris.rabon@live.com',            'Christopher Rabon'),
  ('sgtapple444@gmail.com',           'Tim Apple'),
  -- the address spells out a whole name
  ('teaguejust@gmail.com',            'Justin Teague'),
  ('beccaspray@icloud.com',           'Becca Spray'),
  ('ashleymachicekrph@gmail.com',     'Ashley Machicek'),
  ('tessawingfield8415@gmail.com',    'Tessa Wingfield'),
  ('bodifordbreanna@gmail.com',       'Breanna Bodiford'),
  ('haneenhazimeh91@gmail.com',       'Haneen Hazimeh'),
  ('natalieevalle@yahoo.com',         'Natalie Valle')
) as v(email, name)
where lower(public.student_guardians.email) = v.email
  and public.student_guardians.name is null;

-- and carry every one of those to the siblings sharing the address
with named as (
  select lower(email) as email, min(name) as name
  from public.student_guardians
  where email is not null and name is not null and name <> ''
  group by lower(email) having count(distinct name) = 1
)
update public.student_guardians g set name = n.name
from named n where lower(g.email) = n.email and g.name is null;

select count(*) filter (where name is not null and name <> '') as named,
       count(*) as total,
       count(*) filter (where name is null and email is not null) as still_blank
from public.student_guardians;
