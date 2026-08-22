-- Who Stripe knows about, and whether we have ever taken a card payment from
-- them. A stripe_customer_id alone does not prove a card is saved; a recorded
-- card payment very nearly does.
select c.first_name||' '||c.last_name as who,
       c.email,
       (select count(*) from pos_payments p
          join pos_sales s on s.id = p.sale_id
         where s.buyer_contact_id = c.id and p.method = 'card') as card_payments,
       (select max(s.sale_date) from pos_payments p
          join pos_sales s on s.id = p.sale_id
         where s.buyer_contact_id = c.id and p.method = 'card') as last_card
from contacts c
where c.stripe_customer_id is not null
order by 3 desc, 1;
