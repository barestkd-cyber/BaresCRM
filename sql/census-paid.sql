select ts.student_name, ts.paid,
       (ts.created_at at time zone 'America/Chicago')::date as day,
       s.status::text as invoice
  from testing_signups ts
  left join pos_sales s on s.id = ts.sale_id
 where ts.created_at >= '2026-08-24 05:00:00+00'
 order by ts.created_at;
