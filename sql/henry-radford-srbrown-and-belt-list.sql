-- Owner, 2026-08-31 (belt order): Henry and Radford Tarry to Senior Brown,
-- then every tester with current rank and belt size for the order list.
update public.contacts
   set rank = 'Senior Brown Belt'
 where id in ('1bf7b417-dc8a-4245-bde0-8a554c54de61',
              'f2f224f4-0bf5-4c8e-b63e-33728fe0d82d')
   and rank = 'Brown Belt';

select trim(c.first_name || ' ' || c.last_name) as student,
       c.rank,
       coalesce(c.belt_size, '') as belt_size,
       td.label as session
  from public.testing_signups ts
  join public.testing_dates td on td.id = ts.testing_date_id
  join public.contacts c on c.id = ts.contact_id
 order by c.rank, c.last_name, c.first_name;
