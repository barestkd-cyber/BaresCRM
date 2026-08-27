select (s.created_at at time zone 'America/Chicago')::timestamp(0)::text as when_ct,
       left(s.id::text,8) as sale, s.status::text as status,
       (s.total_cents/100.0)::text as amt,
       coalesce(s.payer_name,'-') as payer,
       coalesce(s.payer_email,'-') as payer_email,
       coalesce(s.staff_email,'-') as source,
       coalesce(s.receipt_sent_at::text,'NOT SENT') as receipt
  from pos_sales s
 where s.created_at > now() - interval '4 days'
 order by s.created_at desc;
