-- Today's four payments predate the checkouts learning to record the card.
-- Same method as the earlier backfill: only payment_method.attached payloads
-- carry the digits and they key on the CUSTOMER, so each payment takes the
-- card attached to its sale's customer nearest in time. No event, no guess.
with attached as (
  select substring(e.payload::text from '"customer":\s*"(cus_[A-Za-z0-9]+)"') as cus,
         substring(e.payload::text from '"brand":\s*"([a-zA-Z ]+)"')          as brand,
         substring(e.payload::text from '"last4":\s*"([0-9]{4})"')            as last4,
         e.received_at
    from payment_events e
   where e.type = 'payment_method.attached'
),
best as (
  select distinct on (p.id) p.id as pay_id, a.brand, a.last4
    from pos_payments p
    join pos_sales s on s.id = p.sale_id
    join attached a on a.cus = s.stripe_customer_id
   where p.card_last4 is null and p.amount_cents > 0 and a.last4 is not null
   order by p.id, abs(extract(epoch from (a.received_at - p.occurred_at)))
)
update pos_payments p set card_brand = best.brand, card_last4 = best.last4
  from best where best.pay_id = p.id;

select coalesce(s.payer_name,'-') as payer,
       coalesce(p.card_brand,'STILL BLANK') as brand,
       coalesce(p.card_last4,'-') as last4,
       (p.occurred_at at time zone 'America/Chicago')::timestamp(0)::text as paid_at
  from pos_payments p join pos_sales s on s.id = p.sale_id
 where p.occurred_at >= '2026-08-27 05:00:00+00'
 order by p.occurred_at;
