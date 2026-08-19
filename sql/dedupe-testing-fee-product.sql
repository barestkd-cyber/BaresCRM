-- ===========================================================================
-- Remove the duplicate "Testing fee" product row.
--
-- The catalog carried TWO active "Testing fee" rows, both $60, so the POS
-- product list showed it twice and any report grouping by product split the
-- number in half. Neither row had a single pos_sale_line pointing at it
-- (verified before running), so this is a clean removal with no history to
-- preserve.
--
-- Keeps the row with the deliberate display_order (20) and drops the one that
-- fell back to the default (100).
--
-- Owner direction 2026-08-19: "yes delete testing fee. should be under
-- +events." The SECOND half of that is not done here. Moving the testing fee
-- out of Products and into Events needs an events row, and events.date is NOT
-- NULL, so it cannot be created until Race gives the next testing's date. The
-- surviving product row stays ACTIVE until that event exists, so the desk does
-- not lose the ability to take a testing payment in the meantime.
--
-- Run:  supabase db query --linked -f sql/dedupe-testing-fee-product.sql
-- ===========================================================================

with doomed as (
  select id
    from public.products
   where name = 'Testing fee'
     and display_order = 100
     and not exists (
           select 1 from public.pos_sale_lines l where l.product_id = products.id
         )
),
gone as (
  delete from public.products
   where id in (select id from doomed)
  returning id
)
select (select count(*) from gone) as deleted,
       (select count(*) from public.products where name = 'Testing fee') as remaining,
       (select string_agg(price_cents::text, ', ') from public.products where name = 'Testing fee') as remaining_price_cents;
