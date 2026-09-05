select 'MEMBERSHIP' as probe, m.id::text as a,
       coalesce(m.program,'')||' · '||coalesce(m.plan_code,'') as b,
       m.status::text||' · '||coalesce(m.billing_frequency,'(no frequency)') as c,
       'rec='||coalesce((m.final_recurring_cents/100.0)::text,'-')||'  next='||coalesce(m.next_bill_on::text,'(none)') as d,
       'payer='||coalesce(m.payer_contact_id::text,'(self)')||'  pm='||coalesce(m.payment_method_id,'(NO CARD)') as e
  from public.memberships m
 where m.contact_id = 'a32e5fbb-b9a6-49a2-85e9-9f1eb83e3f44'
union all
select 'INSTALLMENTS', count(*)::text, coalesce(string_agg(distinct status::text,', '),'none'), '', '', ''
  from public.membership_installments i
 where i.membership_id in (select id from public.memberships where contact_id='a32e5fbb-b9a6-49a2-85e9-9f1eb83e3f44')
union all
select 'STUDENT', c.id::text, trim(c.first_name||' '||c.last_name),
       coalesce(c.stripe_customer_id,'(no stripe customer)'), coalesce(c.email,'(no email)'), ''
  from public.contacts c where c.id = 'a32e5fbb-b9a6-49a2-85e9-9f1eb83e3f44'
union all
select 'GUARDIAN', g.id::text, coalesce(g.name,''),
       coalesce(g.stripe_customer_id,'(no stripe customer)'),
       coalesce((select string_agg(ge.email,', ') from public.guardian_emails ge where ge.guardian_id=g.id),''), ''
  from public.guardians g
  join public.student_guardians sg on sg.guardian_id = g.id
 where sg.student_id = 'a32e5fbb-b9a6-49a2-85e9-9f1eb83e3f44'
union all
select 'ENGINE', (select billing_engine_live::text from public.settings limit 1), '', '', '', ''
 order by 1, 2;
