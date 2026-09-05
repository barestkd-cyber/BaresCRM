delete from public.membership_installments
 where id = '5e565a02-3960-4006-bf1a-f23dfab122fe' and seq = 999 and status = 'scheduled';

select (select count(*) from public.membership_installments
         where membership_id='68172229-9e20-41e3-9b6c-48d228fc20ab') as cody_installments,
       (select next_bill_on::text from public.memberships
         where id='68172229-9e20-41e3-9b6c-48d228fc20ab') as first_bill,
       (select billing_engine_live from public.settings limit 1) as engine_live;
