-- Removes the Ghost Probe enrollments I created while proving the
-- decline-guard and pending-until-paid fixes. None were paid; no money moved.
delete from public.membership_agreements
 where contact_id in (select id from public.contacts where email = 'ghost-probe@example.com');
delete from public.enrollments
 where student_id in (select id from public.contacts where email = 'ghost-probe@example.com');
delete from public.pos_sale_lines
 where sale_id in (select id from public.pos_sales
                    where buyer_contact_id in (select id from public.contacts where email = 'ghost-probe@example.com'));
delete from public.memberships
 where contact_id in (select id from public.contacts where email = 'ghost-probe@example.com');
delete from public.pos_sales
 where buyer_contact_id in (select id from public.contacts where email = 'ghost-probe@example.com')
   and status <> 'paid';
delete from public.student_guardians
 where student_id in (select id from public.contacts where email = 'ghost-probe@example.com');
delete from public.student_contacts
 where student_id in (select id from public.contacts where email = 'ghost-probe@example.com')
;
delete from public.contacts where email = 'ghost-probe@example.com';

select (select count(*) from public.contacts where email='ghost-probe@example.com') as probes_left,
       (select count(*) from public.pos_sales where status <> 'paid') as unpaid_invoices,
       (select count(*) from public.pos_sales) as sales,
       (select coalesce(sum(amount_cents),0) from public.pos_payments) as collected_cents;
