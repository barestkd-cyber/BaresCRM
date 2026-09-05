select 'contacts' as tbl,
       count(*) filter (where stripe_customer_id is not null) as with_customer,
       count(*) as total
  from public.contacts
union all
select 'guardians',
       count(*) filter (where stripe_customer_id is not null),
       count(*)
  from public.guardians;
