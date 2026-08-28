select ts.student_name,
       case when ts.contact_id is null then 'NOT LINKED to a profile'
            else (select c.first_name||' '||c.last_name||' ('||coalesce(c.rank,'no rank')||')'
                    from contacts c where c.id = ts.contact_id) end as linked_to,
       ts.paid, coalesce(td.label,'-') as test_group
  from testing_signups ts
  left join testing_dates td on td.id = ts.testing_date_id
 where ts.student_name ilike '%nannen%'
 order by ts.created_at;
