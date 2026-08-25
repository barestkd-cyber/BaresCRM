select 'signup_row' as t, left(to_jsonb(x)::text, 500) as detail
  from testing_signups x
 where x.created_at >= '2026-08-24 05:00:00+00'
 limit 2
union all
select 'payment_note', coalesce(p.note,'(none)')
  from pos_payments p
 where p.occurred_at >= '2026-08-24 05:00:00+00' and p.amount_cents > 0
union all
select 'kid_contact', c.first_name || ' ' || c.last_name || ' · email=' || coalesce(c.email,'NONE')
       || ' · guardian_emails=' || coalesce((select string_agg(ge.email, ',')
            from student_guardians sg join guardian_emails ge on ge.guardian_id = sg.guardian_id
           where sg.student_id = c.id), 'NONE')
  from contacts c
 where c.id in (select ts.contact_id from testing_signups ts
                 where ts.created_at >= '2026-08-24 05:00:00+00' and ts.contact_id is not null);
