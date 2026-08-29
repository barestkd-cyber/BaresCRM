-- ===========================================================================
-- Import the 20 August-2026 testers who registered and paid through SPARK
-- into testing_signups, so the CRM census (and the testing app, once it
-- reads the CRM) holds the whole event.
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-28: "put those on the spark csv on the testing list with no
-- recorded payment in our crm."
--
--   * source 'spark', sale_id NULL: registered here, but their money lives in
--     Spark. No pos_sales row, no pos_payments row, nothing on any ledger.
--   * paid TRUE: the seat is settled (Spark collected it). Anything that ever
--     surfaces unpaid signups must not dun these families.
--   * rank is copied from contacts at insert time, same census snapshot the
--     website checkout takes. The owner's 2026-08-27 rank dictation is
--     LIST-ONLY until he verifies, so contacts is the honest current value.
--   * family_position and fee_cents transcribed from the Spark invoice
--     export (report (11).csv, pulled 2026-08-27).
--   * Sessions are the owner's placements of 2026-08-27, ids probed live:
--       9:30  c2c67a21   Sophie/Samuel O/John/Andrew/Isabella/Samuel R
--       11:00 44ca9088   the rest of the Saturday seventeen
--       Cubs  e57ae446   Morgan, Ezra
--       Late  fffdd041   Adonai
--   * Idempotent on (contact_id, testing_date_id): the table has no unique
--     constraint, so the guard is in the insert. All 20 contacts matched
--     exactly one active contact in the probe; the join makes a vanished
--     contact skip rather than insert a nameless row.
--
-- Run:  supabase db query --linked -f sql/spark-testing-import.sql
--       (after sql/spark-source-enum.sql, which adds the enum value)
-- ===========================================================================

insert into public.testing_signups
  (testing_date_id, contact_id, student_name, rank, source, paid,
   sale_id, program, family_position, fee_cents)
select v.session_id::uuid, v.cid::uuid,
       trim(c.first_name || ' ' || c.last_name),
       c.rank, 'spark'::public.signup_source, true,
       null, v.prog, v.pos, v.fee
  from (values
    -- Saturday 9:30
    ('c4dd1c3b-18ce-4cad-9c06-cc4286f43c65','c2c67a21-9c58-4f33-a280-9e38ca320889',2,5000,'TKD'),  -- Sophie Cater
    ('5aa63d35-0371-403b-9f38-3e7d29bcae31','c2c67a21-9c58-4f33-a280-9e38ca320889',1,6000,'TKD'),  -- Samuel Ortiz
    ('e141dea3-949b-4821-83dc-3b980f3c8878','c2c67a21-9c58-4f33-a280-9e38ca320889',1,6000,'TKD'),  -- John Cater
    ('9d3cf5c9-6a1b-459d-9e3f-e6d9b8a01329','c2c67a21-9c58-4f33-a280-9e38ca320889',2,5000,'TKD'),  -- Andrew Foster
    ('4165b72e-851a-459e-b924-3c4f5e4e15b2','c2c67a21-9c58-4f33-a280-9e38ca320889',1,6000,'TKD'),  -- Isabella Foster
    ('5077d005-6848-414b-841d-c5805f594f02','c2c67a21-9c58-4f33-a280-9e38ca320889',1,6000,'TKD'),  -- Samuel Root
    -- Saturday 11:00
    ('732dbbff-f4a6-47e6-8190-b5d97ba6816d','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',1,6000,'TKD'),  -- Lee Tarry
    ('1bf7b417-dc8a-4245-bde0-8a554c54de61','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',2,5000,'TKD'),  -- Henry Tarry
    ('f2f224f4-0bf5-4c8e-b63e-33728fe0d82d','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',3,3000,'TKD'),  -- Radford Tarry Jr.
    ('9d818111-7d0b-48c6-a753-9692f018b068','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',1,6000,'TKD'),  -- Zachary Lackey
    ('6cf8fd69-a1a3-431a-a69d-07ff268ffe0e','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',1,6000,'TKD'),  -- Davis Fretty
    ('79e9e377-3063-4a7a-9381-99ce44640e8e','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',1,6000,'TKD'),  -- Travis Splinter
    ('e05c8176-1b28-4982-b49d-09534cf270c7','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',2,5000,'TKD'),  -- Wyatt Osborne
    ('1524a225-cb39-46ea-8342-8f6d08b1b674','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',1,6000,'TKD'),  -- Zoey Osborne
    ('fb78e2a9-2563-447d-be7c-cc3221afe844','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',2,5000,'TKD'),  -- Ian Wilson
    ('fd5c36b9-de53-4d4e-8b91-d70545ab2478','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',1,6000,'TKD'),  -- Savannah Wilson
    ('a1dcccd2-d2e3-42d2-b977-af4a0e05d0d6','44ca9088-ba5b-49dc-8617-0f7789eaa3ef',3,3000,'TKD'),  -- Dustin Wilson
    -- Cubs, Friday
    ('a8720c92-234d-4dc0-931a-22145b556fed','e57ae446-5088-4505-938e-f60716e51f8e',1,5000,'Cubs'), -- Morgan Mogle
    ('58571142-d12f-407d-9712-ac64ef866762','e57ae446-5088-4505-938e-f60716e51f8e',1,5000,'Cubs'), -- Ezra Lackey
    -- Late, Tuesday Sept 1
    ('08ef360a-3248-4b19-be7d-e8aac8b71c36','fffdd041-ef0b-4079-a04e-ad87c1a60e64',1,7000,'Cubs')  -- Adonai Arellano
  ) as v(cid, session_id, pos, fee, prog)
  join public.contacts c on c.id = v.cid::uuid
 where not exists (
   select 1 from public.testing_signups t
    where t.contact_id = v.cid::uuid
      and t.testing_date_id = v.session_id::uuid
 );

-- Verify: the whole census by session, spark rows called out.
select td.label,
       count(*) as signups,
       count(*) filter (where ts.source = 'spark') as via_spark,
       count(*) filter (where ts.paid) as paid,
       count(*) filter (where ts.contact_id is null) as unlinked
  from public.testing_signups ts
  join public.testing_dates td on td.id = ts.testing_date_id
 group by td.label, td.sort_order
 order by td.sort_order;
