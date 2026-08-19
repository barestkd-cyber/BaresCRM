-- ===========================================================================
-- A SAMPLE testing registration, so Race can see the real emails
-- ---------------------------------------------------------------------------
-- Written straight into the ledger, deliberately WITHOUT touching Stripe:
-- Stripe went live 2026-08-18 and running a real charge to preview an email
-- would be taking actual money.
--
-- Everything else matches exactly what testing-checkout writes, so the emails
-- that come out are the genuine article rather than a mockup: same customer
-- note, same calendar link, same invoice token, same line and signup rows.
--
-- One Cub (Friday, seat 1, $50) and one Junior (Saturday, seat 2, $50), which
-- is the family case Race asked to see: two students, two different days, one
-- payment. Card fee 2.9% + 30c on $100 = $3.20. Testing is untaxed.
--
-- The surname is "Sample" so these rows are unmistakable and easy to remove.
-- Delete with sql/testing-sample-receipt-cleanup.sql when done.
-- ===========================================================================

with cub as (
  select id, test_date, start_time, label from public.testing_dates where label = 'Cubs'
), jr as (
  select id, test_date, start_time, label from public.testing_dates
   where label = 'Juniors, White through Orange Belt'
), sale as (
  insert into public.pos_sales (
    id, buyer_contact_id, sale_date, staff_email, brand,
    tender_method, status, subtotal_cents, discount_cents, admin_fee_cents,
    tax_cents, total_cents, confirmed_at, receipt_email, calendar_url,
    customer_note, notes
  )
  select
    gen_random_uuid(), null, (now() at time zone 'America/Chicago')::date,
    'testing-checkout@website', 'btkd',
    'card', 'paid', 10000, 0, 320, 0, 10320, now(),
    'rocketlauncher500@gmail.com',
    -- Earliest testing wins the button: the Cubs slot on Friday.
    'https://calendar.google.com/calendar/render?action=TEMPLATE'
      || '&text=' || replace(replace('Belt testing at Bares Taekwondo Fitness',' ','+'),'&','%26')
      || '&dates=20260828T173000/20260828T190000'
      || '&ctz=America%2FChicago'
      || '&location=1901+Deerbrook+Dr%2C+Tyler%2C+TX+75703'
      || '&details=Arrive+at+least+5+minutes+early%2C+in+full+uniform%2C+with+all+required+gear.+Family+and+friends+are+welcome+to+watch.',
    'You''re registered for belt testing.' || chr(10) || chr(10)
      || '  Ava Sample (Cub Orange Belt) - Cubs, Friday, August 28 at 5:30 PM' || chr(10)
      || '  Owen Sample (Orange Belt) - Juniors, White through Orange Belt, Saturday, August 29 at 9:30 AM' || chr(10) || chr(10)
      || '1901 Deerbrook Dr, Tyler' || chr(10) || chr(10)
      || 'Please arrive at least 5 minutes early, in full uniform, with all required gear.' || chr(10)
      || 'Family and friends are welcome to come and watch.' || chr(10) || chr(10)
      || 'Questions? Call 903-561-2966 or just reply to this email.',
    'SAMPLE registration for email preview, 2 students, paid by Jamie Sample'
  returning id, view_token
), lines as (
  insert into public.pos_sale_lines (
    sale_id, kind, label, qty, unit_cents, discount_cents, taxable, line_total_cents
  )
  select s.id, 'event', v.lbl, 1, v.cents, 0, false, v.cents
    from sale s, (values
      ('Belt testing - Ava Sample (Cubs)', 5000),
      ('Belt testing - Owen Sample (Juniors, White through Orange Belt)', 5000)
    ) as v(lbl, cents)
  returning sale_id
), signups as (
  insert into public.testing_signups (
    testing_date_id, contact_id, student_name, rank, source, paid,
    sale_id, program, family_position, fee_cents
  )
  select v.tdid, null, v.nm, v.rk, 'link', true, s.id, v.prog, v.pos, v.cents
    from sale s,
         (select (select id from cub) as tdid, 'Ava Sample' as nm, 'Cub Orange Belt' as rk,
                 'Cubs' as prog, 1 as pos, 5000 as cents
          union all
          select (select id from jr), 'Owen Sample', 'Orange Belt', 'TKD', 2, 5000) as v
  returning sale_id
), pay as (
  insert into public.pos_payments (sale_id, kind, amount_cents, method, note)
  select s.id, 'charge', 10320, 'card', 'SAMPLE - no Stripe charge, preview only' from sale s
  returning sale_id
)
select s.id as sale_id, s.view_token,
       'https://www.barestkd.fit/invoice/?t=' || s.view_token as invoice_url,
       (select count(*) from lines) as line_rows,
       (select count(*) from signups) as signup_rows,
       (select count(*) from pay) as payment_rows
  from sale s;
