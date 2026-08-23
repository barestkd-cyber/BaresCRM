-- Everything that touched the till today, paid or not, in case a second
-- attempt half-landed.
select s.id, s.created_at, s.status, s.subtotal_cents, s.admin_fee_cents, s.total_cents,
       c.first_name||' '||c.last_name as buyer, s.receipt_email, s.notes,
       (select count(*) from pos_sale_lines l where l.sale_id = s.id) as lines,
       (select count(*) from testing_signups t where t.sale_id = s.id) as signups,
       (select coalesce(sum(p.amount_cents),0) from pos_payments p where p.sale_id = s.id) as paid_cents
from pos_sales s left join contacts c on c.id = s.buyer_contact_id
where s.created_at >= '2026-08-22'
order by s.created_at;
