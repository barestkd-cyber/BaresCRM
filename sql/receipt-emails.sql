select left(s.id::text,8) as sale,
       s.total_cents/100.0 as amt,
       coalesce(s.receipt_email,'(NULL - column or value missing)') as receipt_email,
       coalesce(s.stripe_email,'(null)') as stripe_email
  from pos_sales s
 where s.created_at >= '2026-08-24 05:00:00+00' and s.total_cents > 0
 order by s.created_at;
