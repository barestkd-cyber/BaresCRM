select p.kind, p.amount_cents/100.0 as amt, p.method,
       (p.occurred_at at time zone 'America/Chicago')::date as day,
       s.status as invoice_now, coalesce(p.note,'') as note
  from pos_payments p join pos_sales s on s.id = p.sale_id
 where p.sale_id in (select sale_id from pos_payments
                      where amount_cents in (133, -133))
 order by p.occurred_at;
