-- ===========================================================================
-- Owner, 2026-08-28: "add owen (late testing) and rebecca and danny to the
-- testing list. create an invoice for each and just leave it under their
-- profile as unpaid."
-- ---------------------------------------------------------------------------
-- Three testers, each getting:
--   * an UNPAID desk invoice (status 'unpaid' - the collect-later drawer
--     shape, NOT pending_payment, so the abandoned-checkout sweep never
--     touches it and it shows as owed on the profile)
--   * a pos_sale_lines row carrying the student, labelled exactly like the
--     website's testing lines so receipts and the owner email read the same
--   * a testing_signups row (source 'staff', paid false, sale_id linked) so
--     the testing app's Load-from-CRM sees them now, and the webhook's
--     reconcilePaidSale flips paid when the invoice is settled by card
-- Fees are the standard ladder: Late $70 flat, standard seat $60, Cubs $50.
-- No tax (testing is untaxed), no admin fee (desk invoice).
-- Idempotent: each block skips if the signup already exists.
--
--   Owen Skinner    81eef582  Brown Belt      -> Late Testing  $70
--   Rebecca Mohrbach 42efb2ce Purple Belt     -> Sat 11:00     $60
--   Danny Hardin    002503b8  Cub Red Belt    -> Cubs Friday   $50
--
-- Run:  supabase db query --linked -f sql/owen-rebecca-danny-add.sql
-- ===========================================================================

-- Owen Skinner -> Late Testing (Tue Sept 1), $70 flat
with sale as (
  insert into public.pos_sales (id, buyer_contact_id, sale_date, staff_email, brand,
    tender_method, status, subtotal_cents, discount_cents, admin_fee_cents, tax_cents,
    total_cents, notes)
  select gen_random_uuid(), '81eef582-d1a3-49c6-a0f9-f431a4a1071e', current_date,
    'barestkd@gmail.com', 'btkd', null, 'unpaid', 7000, 0, 0, 0, 7000,
    'Belt testing signup at the desk - unpaid (owner, 2026-08-28)'
  where not exists (select 1 from public.testing_signups
    where contact_id = '81eef582-d1a3-49c6-a0f9-f431a4a1071e'
      and testing_date_id = 'fffdd041-ef0b-4079-a04e-ad87c1a60e64')
  returning id
), line as (
  insert into public.pos_sale_lines (sale_id, kind, label, qty, unit_cents,
    discount_cents, taxable, line_total_cents, student_contact_id, product_id,
    membership_row, membership_id)
  select sale.id, 'event', 'Belt testing - Owen Skinner (Late Testing)', 1, 7000,
    0, false, 7000, '81eef582-d1a3-49c6-a0f9-f431a4a1071e', null, null, null
  from sale returning sale_id
)
insert into public.testing_signups (testing_date_id, contact_id, student_name, rank,
  source, paid, sale_id, program, family_position, fee_cents)
select 'fffdd041-ef0b-4079-a04e-ad87c1a60e64', '81eef582-d1a3-49c6-a0f9-f431a4a1071e',
  'Owen Skinner', 'Brown Belt', 'staff', false, sale.id, 'TKD', 1, 7000
from sale;

-- Rebecca Mohrbach -> Saturday 11:00, $60 standard seat
with sale as (
  insert into public.pos_sales (id, buyer_contact_id, sale_date, staff_email, brand,
    tender_method, status, subtotal_cents, discount_cents, admin_fee_cents, tax_cents,
    total_cents, notes)
  select gen_random_uuid(), '42efb2ce-24a3-424e-b60f-2bf144dcfbc4', current_date,
    'barestkd@gmail.com', 'btkd', null, 'unpaid', 6000, 0, 0, 0, 6000,
    'Belt testing signup at the desk - unpaid (owner, 2026-08-28)'
  where not exists (select 1 from public.testing_signups
    where contact_id = '42efb2ce-24a3-424e-b60f-2bf144dcfbc4'
      and testing_date_id = '44ca9088-ba5b-49dc-8617-0f7789eaa3ef')
  returning id
), line as (
  insert into public.pos_sale_lines (sale_id, kind, label, qty, unit_cents,
    discount_cents, taxable, line_total_cents, student_contact_id, product_id,
    membership_row, membership_id)
  select sale.id, 'event',
    'Belt testing - Rebecca Mohrbach (Juniors Green Belt and up, and all Teens and Adults)',
    1, 6000, 0, false, 6000, '42efb2ce-24a3-424e-b60f-2bf144dcfbc4', null, null, null
  from sale returning sale_id
)
insert into public.testing_signups (testing_date_id, contact_id, student_name, rank,
  source, paid, sale_id, program, family_position, fee_cents)
select '44ca9088-ba5b-49dc-8617-0f7789eaa3ef', '42efb2ce-24a3-424e-b60f-2bf144dcfbc4',
  'Rebecca Mohrbach', 'Purple Belt', 'staff', false, sale.id, 'TKD', 1, 6000
from sale;

-- Danny Hardin -> Cubs (Fri), $50 Cubs seat
with sale as (
  insert into public.pos_sales (id, buyer_contact_id, sale_date, staff_email, brand,
    tender_method, status, subtotal_cents, discount_cents, admin_fee_cents, tax_cents,
    total_cents, notes)
  select gen_random_uuid(), '002503b8-b64c-486d-b5e5-b1f3fde7e1f1', current_date,
    'barestkd@gmail.com', 'btkd', null, 'unpaid', 5000, 0, 0, 0, 5000,
    'Belt testing signup at the desk - unpaid (owner, 2026-08-28)'
  where not exists (select 1 from public.testing_signups
    where contact_id = '002503b8-b64c-486d-b5e5-b1f3fde7e1f1'
      and testing_date_id = 'e57ae446-5088-4505-938e-f60716e51f8e')
  returning id
), line as (
  insert into public.pos_sale_lines (sale_id, kind, label, qty, unit_cents,
    discount_cents, taxable, line_total_cents, student_contact_id, product_id,
    membership_row, membership_id)
  select sale.id, 'event', 'Belt testing - Danny Hardin (Cubs)', 1, 5000,
    0, false, 5000, '002503b8-b64c-486d-b5e5-b1f3fde7e1f1', null, null, null
  from sale returning sale_id
)
insert into public.testing_signups (testing_date_id, contact_id, student_name, rank,
  source, paid, sale_id, program, family_position, fee_cents)
select 'e57ae446-5088-4505-938e-f60716e51f8e', '002503b8-b64c-486d-b5e5-b1f3fde7e1f1',
  'Danny Hardin', 'Cub Red Belt', 'staff', false, sale.id, 'Cubs', 1, 5000
from sale;

-- Verify: the three, with their invoice state.
select ts.student_name, td.label as session, ts.rank, ts.paid,
       s.status as invoice_status, s.total_cents
  from public.testing_signups ts
  join public.testing_dates td on td.id = ts.testing_date_id
  left join public.pos_sales s on s.id = ts.sale_id
 where ts.source = 'staff'
 order by ts.student_name;
