-- The database's own guard against deleting an invoice with money on it never
-- worked. It compared a payment's sale_id to the payment's OWN id
-- (p.sale_id = p.id), which is never true, so the EXISTS was always false and
-- the NOT always passed. Only the CRM hiding the Delete button has been
-- stopping it; anything reaching the database another way - a script, a future
-- feature - had no net under it at all.
--
-- Correlate to the row being deleted, which is what was meant.
drop policy if exists pos_sales_staff_delete on pos_sales;
create policy pos_sales_staff_delete on pos_sales
  for delete to authenticated
  using (
    is_staff()
    and status = any (array['unpaid','closed'])
    and not exists (select 1 from pos_payments p where p.sale_id = pos_sales.id)
  );

select policyname, qual as rule from pg_policies
 where schemaname='public' and tablename='pos_sales' and cmd='DELETE';
