select ts.student_name, left(ts.sale_id::text,8) as sale, ts.paid,
       td.label as test_group
  from testing_signups ts
  left join testing_dates td on td.id = ts.testing_date_id
 where ts.student_name ilike '%oliver%allen%' or ts.contact_id in
       (select id from contacts where first_name='Oliver' and last_name='Allen')
 order by ts.created_at;
