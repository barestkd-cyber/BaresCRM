-- Does the corrected expression actually see the money? The OLD form
-- (p.sale_id = p.id) should find nothing anywhere; the NEW form should flag
-- every invoice that has a payment row.
select s.status::text as status,
       count(*) as invoices,
       count(*) filter (where exists (select 1 from pos_payments p where p.sale_id = s.id)) as new_form_blocks,
       count(*) filter (where exists (select 1 from pos_payments p where p.sale_id = p.id))  as old_form_blocks
  from pos_sales s
 group by 1 order by 1;
