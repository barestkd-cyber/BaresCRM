-- Remove the Cubs test enrollment used to prove payments work after the key
-- fix. Unpaid, no payment rows. Deleted in FK order so nothing is orphaned,
-- and the contact goes too: a fake student must not sit on the roster.
do $$
declare v_sale uuid := '81e84fa2-d5c1-4c5f-9980-dbd0823a5e22';
        v_contact uuid;
begin
  select buyer_contact_id into v_contact from public.pos_sales where id = v_sale;

  delete from public.membership_agreements where sale_id = v_sale;
  delete from public.pos_sale_lines        where sale_id = v_sale;
  delete from public.enrollments           where sale_id = v_sale;
  delete from public.memberships           where sale_id = v_sale;
  delete from public.pos_payments          where sale_id = v_sale;
  delete from public.pos_sales             where id      = v_sale;

  if v_contact is not null then
    delete from public.student_guardians where student_id = v_contact;
    delete from public.student_contacts  where student_id = v_contact;
    delete from public.enrollments       where student_id = v_contact;
    delete from public.contacts          where id = v_contact;
  end if;
end $$;

select (select count(*) from public.pos_sales) as sales_left,
       (select count(*) from public.contacts where last_name = 'Sample') as sample_contacts_left,
       (select count(*) from public.enrollments where status = 'active') as active_enrollments;
