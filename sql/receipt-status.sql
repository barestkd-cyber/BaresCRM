select coalesce(c.first_name || ' ' || c.last_name, s.payer_name, '?') as who,
       s.total_cents/100.0 as amt,
       coalesce(s.receipt_email, s.stripe_email, '-') as sent_to,
       case when s.receipt_sent_at is not null
            then 'RECEIPT SENT ' || (s.receipt_sent_at at time zone 'America/Chicago')::timestamp(0)::text
            else 'NOT YET SENT' end as receipt,
       case when s.calendar_url is not null then 'has calendar link' else 'no calendar link' end as cal
  from pos_sales s
  left join contacts c on c.id = s.buyer_contact_id
 where s.created_at >= '2026-08-24 05:00:00+00' and s.total_cents > 0
 order by s.created_at;
