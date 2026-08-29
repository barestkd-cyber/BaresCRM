-- ===========================================================================
-- Owner, 2026-08-28: "apply them" - the fourteen rank corrections from his
-- 2026-08-27 dictation (plus today's Scott/Lincoln and Henry/Radford-to-
-- Brown rulings), now going into the CRM. Black-degree ranks untouched
-- until he has asked those students directly.
-- Guarded on the expected current rank, so a re-run or an already-corrected
-- profile is a no-op instead of a clobber.
-- Run:  supabase db query --linked -f sql/rank-pass-0828.sql
-- ===========================================================================
update public.contacts c
   set rank = v.to_rank
  from (values
    ('5aa63d35-0371-403b-9f38-3e7d29bcae31','Yellow Belt','Senior Yellow Belt'),      -- Samuel Ortiz
    ('732dbbff-f4a6-47e6-8190-b5d97ba6816d','Yellow Belt','Senior Yellow Belt'),      -- Lee Tarry
    ('05f56809-6f3b-4036-92af-fbe04f0f41a1','Yellow Belt','Senior Yellow Belt'),      -- Evelyn Du Toit
    ('e141dea3-949b-4821-83dc-3b980f3c8878','Orange Belt','Senior Orange Belt'),      -- John Cater
    ('9d3cf5c9-6a1b-459d-9e3f-e6d9b8a01329','Orange Belt','Senior Orange Belt'),      -- Andrew Foster
    ('4165b72e-851a-459e-b924-3c4f5e4e15b2','Orange Belt','Senior Orange Belt'),      -- Isabella Foster
    ('79e9e377-3063-4a7a-9381-99ce44640e8e','Green Belt','Senior Green Belt'),        -- Travis Splinter
    ('1bf7b417-dc8a-4245-bde0-8a554c54de61','Senior Blue Belt','Brown Belt'),         -- Henry Tarry
    ('f2f224f4-0bf5-4c8e-b63e-33728fe0d82d','Senior Blue Belt','Brown Belt'),         -- Radford Tarry Jr.
    ('fb78e2a9-2563-447d-be7c-cc3221afe844','Brown Belt','Senior Brown Belt'),        -- Ian Wilson
    ('1524a225-cb39-46ea-8342-8f6d08b1b674','Brown Belt','Red Belt'),                 -- Zoey Osborne
    ('fd5c36b9-de53-4d4e-8b91-d70545ab2478','Senior Red Belt','Probationary Black Belt'), -- Savannah Wilson
    ('63dcee6b-5938-44cd-b12f-606a6259a47a','Senior Yellow Belt','Orange Belt'),      -- Scott Randall
    ('726083e7-aed3-4a58-8199-1e815758d07e','Purple Belt','Senior Purple Belt')       -- Lincoln Randall
  ) as v(cid, from_rank, to_rank)
 where c.id = v.cid::uuid
   and c.rank = v.from_rank;

select first_name || ' ' || last_name as who, rank
  from public.contacts
 where id in (
   '5aa63d35-0371-403b-9f38-3e7d29bcae31','732dbbff-f4a6-47e6-8190-b5d97ba6816d',
   '05f56809-6f3b-4036-92af-fbe04f0f41a1','e141dea3-949b-4821-83dc-3b980f3c8878',
   '9d3cf5c9-6a1b-459d-9e3f-e6d9b8a01329','4165b72e-851a-459e-b924-3c4f5e4e15b2',
   '79e9e377-3063-4a7a-9381-99ce44640e8e','1bf7b417-dc8a-4245-bde0-8a554c54de61',
   'f2f224f4-0bf5-4c8e-b63e-33728fe0d82d','fb78e2a9-2563-447d-be7c-cc3221afe844',
   '1524a225-cb39-46ea-8342-8f6d08b1b674','fd5c36b9-de53-4d4e-8b91-d70545ab2478',
   '63dcee6b-5938-44cd-b12f-606a6259a47a','726083e7-aed3-4a58-8199-1e815758d07e')
 order by last_name, first_name;
