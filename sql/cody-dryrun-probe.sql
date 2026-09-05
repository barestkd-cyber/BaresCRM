-- Engine must be OFF before this. A scheduled installment dated today makes
-- the dry run walk the charging path and report who it WOULD charge, which is
-- the only way to see the new guardian fallback resolve. Removed immediately.
select billing_engine_live from public.settings limit 1;

insert into public.membership_installments (membership_id, contact_id, seq, due_on, amount_cents, status)
select '68172229-9e20-41e3-9b6c-48d228fc20ab', 'a32e5fbb-b9a6-49a2-85e9-9f1eb83e3f44',
       999, current_date, 2795, 'scheduled'
 where (select billing_engine_live from public.settings limit 1) = false;

select id::text, seq, due_on::text, status from public.membership_installments
 where membership_id = '68172229-9e20-41e3-9b6c-48d228fc20ab';
