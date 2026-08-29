-- ===========================================================================
-- Owner, 2026-08-28: "They paid so go ahead and put them all on for me...
-- no invoice ill do it when if i want."
-- ---------------------------------------------------------------------------
-- The 12 cash testers onto the testing list: signup rows only. paid TRUE
-- (cash, collected by the owner), sale_id NULL and fee NULL - no invoice,
-- no ledger claim; he invoices himself if he ever wants to. source 'staff'.
-- rank and name are copied from the contact at insert, same as every other
-- import. Idempotent on (contact_id, session).
--
-- Cubs, Friday:   Jessie Bares, Sunny Bares, Scarlett Randall, Iliza Randall
-- Sat 11:00:      Scott Randall, Lincoln Randall, Evelyn/June/Belle/Noah/
--                 Witten Du Toit, Kaleb Smith
--
-- Run:  supabase db query --linked -f sql/cash-twelve-add.sql
-- ===========================================================================

insert into public.testing_signups
  (testing_date_id, contact_id, student_name, rank, source, paid,
   sale_id, program, family_position, fee_cents)
select v.session_id::uuid, v.cid::uuid,
       trim(c.first_name || ' ' || c.last_name),
       c.rank, 'staff'::public.signup_source, true,
       null, case when c.rank ilike 'cub%' then 'Cubs' else 'TKD' end,
       null, null
  from (values
    -- Cubs, Friday
    ('769e8af4-9696-4187-b05d-2adf27716c6e','e57ae446-5088-4505-938e-f60716e51f8e'),  -- Jessie Bares
    ('5891451e-2cbb-45fe-b579-a0ee62b1c6a9','e57ae446-5088-4505-938e-f60716e51f8e'),  -- Sunny Bares
    ('99b078ed-ae5d-43a1-a2f3-700f8e2c651f','e57ae446-5088-4505-938e-f60716e51f8e'),  -- Scarlett Randall
    ('5594d96c-7498-45a6-a0a4-e96a61149c35','e57ae446-5088-4505-938e-f60716e51f8e'),  -- Iliza Randall
    -- Saturday 11:00
    ('63dcee6b-5938-44cd-b12f-606a6259a47a','44ca9088-ba5b-49dc-8617-0f7789eaa3ef'),  -- Scott Randall
    ('726083e7-aed3-4a58-8199-1e815758d07e','44ca9088-ba5b-49dc-8617-0f7789eaa3ef'),  -- Lincoln Randall
    ('05f56809-6f3b-4036-92af-fbe04f0f41a1','44ca9088-ba5b-49dc-8617-0f7789eaa3ef'),  -- Evelyn Du Toit
    ('8738cf55-1cd8-41a5-9524-9c24403f2653','44ca9088-ba5b-49dc-8617-0f7789eaa3ef'),  -- June Du Toit
    ('11e7478c-a2d8-4441-ab6e-5464d813e6e5','44ca9088-ba5b-49dc-8617-0f7789eaa3ef'),  -- Belle Du Toit
    ('47f1b055-e1a1-4382-9085-9b1d841a99eb','44ca9088-ba5b-49dc-8617-0f7789eaa3ef'),  -- Noah Du Toit
    ('cfbcb41d-31be-4fe3-be95-0db1ae7aaf61','44ca9088-ba5b-49dc-8617-0f7789eaa3ef'),  -- Witten Du Toit
    ('c5398bb6-02bb-4283-aec7-b105e2269e98','44ca9088-ba5b-49dc-8617-0f7789eaa3ef')   -- Kaleb Smith
  ) as v(cid, session_id)
  join public.contacts c on c.id = v.cid::uuid
 where not exists (
   select 1 from public.testing_signups t
    where t.contact_id = v.cid::uuid
      and t.testing_date_id = v.session_id::uuid
 );

-- Verify: full census by session, and the event total.
select coalesce(td.label,'TOTAL') as session,
       count(*) as signups,
       count(*) filter (where ts.paid) as paid,
       count(*) filter (where ts.contact_id is null) as unlinked
  from public.testing_signups ts
  join public.testing_dates td on td.id = ts.testing_date_id
 group by rollup(td.label, td.sort_order)
having td.sort_order is not null or td.label is null
 order by td.sort_order nulls last;
