-- Every payment since Sunday studio time, with its invoice and receipt state.
select (p.occurred_at at time zone 'America/Chicago')::timestamp(0) as at_ct,
       p.amount_cents/100.0 as amt,
       p.method, p.kind,
       coalesce(c.first_name || ' ' || c.last_name, '(walk-in)') as buyer,
       s.status as inv_status,
       case when s.receipt_sent_at is null then 'NO RECEIPT' else 'receipt sent' end as receipt,
       coalesce((select string_agg(l.label, ' + ') from pos_sale_lines l where l.sale_id = s.id), '(no lines)') as items
  from pos_payments p
  join pos_sales s on s.id = p.sale_id
  left join contacts c on c.id = s.buyer_contact_id
 where p.occurred_at >= '2026-08-24 05:00:00+00'
 order by p.occurred_at;
