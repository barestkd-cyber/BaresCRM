-- ===========================================================================
-- Guardian names the owner confirmed, 2026-08-22/23
-- ---------------------------------------------------------------------------
-- Eight are first-initial-plus-surname against a parent with no rival named
-- on the row. That is positive evidence, the same shape as Kristie Allen, and
-- the opposite of the Cooke trap where the address said "bill" while the only
-- named parent was Linda.
--
-- Two he answered from knowledge the data does not carry:
--   j.nicole.nannen@ is Nicole's. Spark has "Joshua Nannen" typed in the Mom
--     column for Liam, which is why the automatic pass could not settle it.
--   kjullrich11@ and kjhardin12@ are both Katie Hardin. Ullrich is her former
--     name, so the same person holds two addresses under two surnames - which
--     no name-matching rule could ever have worked out.
--
-- Surnames follow the CRM's spelling of the family, so a guardian's name
-- matches their child's.
-- ===========================================================================

update public.student_guardians set name = v.name
from (values
  ('svhwhite@gmail.com',          'Sarah White'),
  ('tnewsom@emaengineer.com',     'Tonya Newsom'),
  ('tbeard_prov31@yahoo.com',     'Tennille Gentry'),
  ('m_mogle@icloud.com',          'Michelle Mogle'),
  ('ksroot1@hotmail.com',         'Katie Root'),
  ('rrschall2015@gmail.com',      'Robert Schall'),
  ('mdriggle1006@hotmail.com',    'Matt Riggle'),
  ('tdapple@me.com',              'Tim Apple'),
  ('j.nicole.nannen@gmail.com',   'Nicole Nannen'),
  ('kjullrich11@yahoo.com',       'Katie Hardin'),
  ('kjhardin12@gmail.com',        'Katie Hardin')
) as v(email, name)
where lower(public.student_guardians.email) = v.email
  and public.student_guardians.name is null;

select count(*) filter (where name is not null and name <> '') as with_name,
       count(*) as total,
       count(*) filter (where name is null and email is not null) as still_blank
from public.student_guardians;
