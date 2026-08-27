-- Only payment_method.attached payloads carry brand+last4, and they key on the
-- CUSTOMER, not the payment. So match a payment to the card attached to that
-- sale's customer nearest in time - in these flows the card is attached in the
-- same second it is charged. Anything with no such event stays null rather
-- than being guessed at.
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
update pos_payments p
   set card_brand = best.brand, card_last4 = best.last4
  from best where best.pay_id = p.id;

select coalesce(card_brand,'—') as brand, coalesce(card_last4,'—') as last4,
       count(*) as payments, round(sum(amount_cents)/100.0,2) as dollars
  from pos_payments where amount_cents > 0 group by 1,2 order by 3 desc;
