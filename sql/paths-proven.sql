-- Which checkout paths have actually taken real money. The note carries the
-- source, so this is the honest answer to "has this code ever run for real".
select coalesce(p.note,'(no note)') as path,
       count(*) as payments,
       sum(p.amount_cents)/100.0 as dollars,
       max(s.sale_date) as last_used
from pos_payments p
join pos_sales s on s.id = p.sale_id
where p.method = 'card' and p.amount_cents > 0
group by 1 order by 2 desc;
