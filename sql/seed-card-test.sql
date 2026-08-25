-- A one-dollar product so the card path can be rehearsed with real money and
-- refunded, without bending a real catalog item. Bottom of the display order.
insert into products (sku, name, active, taxable, price_cents, display_order)
select 'card_path_test', 'Card path test ($1)', true, false, 100, 999
 where not exists (select 1 from products where sku = 'card_path_test');
select name, price_cents, taxable from products where sku = 'card_path_test';
