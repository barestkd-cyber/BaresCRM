select 'CONTACT' as probe, trim(first_name||' '||last_name) as who,
       coalesce(stripe_customer_id,'(none)') as stripe, coalesce(email,'') as email,
       segment::text as seg
  from public.contacts where last_name ilike '%mogle%'
union all
select 'WHO HAS CARDS ON CONTACTS', trim(c.first_name||' '||c.last_name),
       c.stripe_customer_id, coalesce(c.email,''), c.segment::text
  from public.contacts c where c.stripe_customer_id is not null
 order by 1, 2;
