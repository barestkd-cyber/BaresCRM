select left(to_jsonb(x)::text, 400) as row
  from pos_sale_lines x
 where x.sale_id in (select id from pos_sales where created_at >= '2026-08-24 05:00:00+00' and total_cents > 0)
 limit 2;
