-- ===========================================================================
-- Deduplicate the catalog before the new checkout pages read it
-- ---------------------------------------------------------------------------
-- "Beginner uniform" and "Sparring gear package" each exist twice, same as
-- "Testing fee" did (deduped 2026-08-19). Every one of the new membership
-- pages lists gear by name, so a duplicate row means the same item appears
-- twice on a public page and splits in every report.
--
-- Keeps the row that is actually referenced by sale lines; failing that, the
-- oldest by id. Prices are identical across each pair, so nothing changes for
-- a buyer either way.
-- ===========================================================================

with dupes as (
  select name from public.products
   where active is true
   group by name having count(*) > 1
),
ranked as (
  select p.id, p.name,
         row_number() over (
           partition by p.name
           order by (select count(*) from public.pos_sale_lines l where l.product_id = p.id) desc,
                    p.id
         ) as rn
    from public.products p
    join dupes d on d.name = p.name
   where p.active is true
)
update public.products
   set active = false
 where id in (select id from ranked where rn > 1);

select name, count(*) as active_rows, min(price_cents) as price_cents
  from public.products where active is true
 group by name having count(*) > 1;
