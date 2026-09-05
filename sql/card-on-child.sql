-- Of the contacts carrying a Stripe customer, which are CHILDREN (they have a
-- guardian linked)? A card on a child's record is the family card filed in the
-- wrong place.
select trim(c.first_name||' '||c.last_name) as contact,
       c.stripe_customer_id as card_on_contact,
       coalesce(c.dob::text,'(no dob)') as dob,
       coalesce((select string_agg(coalesce(g.name,'(nameless)')||
                  case when g.stripe_customer_id is not null then ' [has own card]' else '' end, ', ')
                   from public.student_guardians sg
                   join public.guardians g on g.id = sg.guardian_id
                  where sg.student_id = c.id), '(no guardian - adult)') as guardians
  from public.contacts c
 where c.stripe_customer_id is not null
 order by 4, 1;
