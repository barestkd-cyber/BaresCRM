-- Everyone on the active roster who is NOT testing this cycle. Read-only.
-- Testing = holds a signup on one of the four August-2026 sessions, OR is on
-- the owner's hand list of cash/walk-on/family testers who never went
-- through a checkout (13 names, excluded by normalized name).
with testers as (
  select contact_id from public.testing_signups
   where testing_date_id in (
     'e57ae446-5088-4505-938e-f60716e51f8e',  -- Cubs Fri
     'c2c67a21-9c58-4f33-a280-9e38ca320889',  -- Sat 9:30
     '44ca9088-ba5b-49dc-8617-0f7789eaa3ef',  -- Sat 11:00
     'fffdd041-ef0b-4079-a04e-ad87c1a60e64')  -- Late Tue
     and contact_id is not null
),
handlist(n) as (values
  ('jessiebares'),('sunnybares'),('scarlettrandall'),('ilizarandall'),
  ('dannyhardin'),('scottrandall'),('lincolnrandall'),
  ('evelyndutoit'),('junedutoit'),('belledutoit'),('noahdutoit'),
  ('wittendutoit'),('kalebsmith')
)
select c.first_name || ' ' || c.last_name as student,
       coalesce(c.rank,'(no rank)') as rank,
       c.segment::text as segment
  from public.contacts c
 where c.segment in ('active','trial')
   and c.id not in (select contact_id from testers)
   and regexp_replace(lower(c.first_name || c.last_name), '[^a-z]', '', 'g')
       not in (select n from handlist)
 order by (c.rank ilike 'cub%') desc, c.rank, c.last_name, c.first_name;
