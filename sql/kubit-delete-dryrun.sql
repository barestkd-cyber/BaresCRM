-- Dry run of deleting the Kubit duplicate (8578258b), mirroring the CRM's
-- posDeleteInvoice order. BOTH paths raise, so the whole thing ALWAYS rolls
-- back - nothing is changed, we only learn the first blocker's message.
do $$
begin
  delete from public.enrollments        where sale_id = '8578258b-474f-4b2b-8ecc-45689a9c6379';
  delete from public.event_registrations where sale_id = '8578258b-474f-4b2b-8ecc-45689a9c6379';
  delete from public.testing_signups    where sale_id = '8578258b-474f-4b2b-8ecc-45689a9c6379';
  update public.pos_sale_lines set membership_id = null
                                        where sale_id = '8578258b-474f-4b2b-8ecc-45689a9c6379';
  delete from public.memberships        where sale_id = '8578258b-474f-4b2b-8ecc-45689a9c6379';
  delete from public.pos_sales          where id      = '8578258b-474f-4b2b-8ecc-45689a9c6379';
  raise exception 'WOULD SUCCEED - clean delete, rolled back on purpose';
exception when others then
  raise exception 'RESULT: %', sqlerrm;
end $$;
