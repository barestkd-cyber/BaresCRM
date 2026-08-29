-- The missing policy behind "im back to not being able to delete an unpaid
-- invoice" (Kubit, 2026-08-28). posDeleteInvoice releases the line's
-- membership_id BEFORE deleting the membership - but pos_sale_lines only
-- had INSERT and SELECT policies, so RLS filtered that release to zero rows
-- silently, and the membership delete then failed on the line's FK. The
-- 2026-08-22 deadlock fix was right; this is the permission it needed.
create policy pos_lines_staff_update on public.pos_sale_lines
  for update using (is_staff()) with check (is_staff());

select policyname, cmd from pg_policies
 where schemaname='public' and tablename='pos_sale_lines' order by cmd;
