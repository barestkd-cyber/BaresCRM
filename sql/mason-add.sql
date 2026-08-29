-- Owner, 2026-08-28: "mason should be testing. Add him to the list. no
-- invoice." Saturday 11:00 with every other black belt. Signup only: no
-- sale, no fee, paid=false (nothing was said about money - flip on his
-- word). Inserts only on an exactly-one contact match, idempotent.
with m as (
  select id, first_name, last_name, rank
    from public.contacts
   where first_name ilike 'mason' and last_name ilike 'soultanov'
)
insert into public.testing_signups
  (testing_date_id, contact_id, student_name, rank, source, paid,
   sale_id, program, family_position, fee_cents)
select '44ca9088-ba5b-49dc-8617-0f7789eaa3ef', m.id,
       trim(m.first_name || ' ' || m.last_name), m.rank,
       'staff'::public.signup_source, false, null, 'TKD', null, null
  from m
 where (select count(*) from m) = 1
   and not exists (
     select 1 from public.testing_signups t
      where t.contact_id = m.id
        and t.testing_date_id = '44ca9088-ba5b-49dc-8617-0f7789eaa3ef'
   );

select ts.student_name, ts.rank, td.label, ts.paid
  from public.testing_signups ts
  join public.testing_dates td on td.id = ts.testing_date_id
 where ts.student_name ilike 'mason%';
