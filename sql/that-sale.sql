select s.id, s.sale_date, s.status, s.subtotal_cents, s.admin_fee_cents, s.total_cents,
       s.buyer_contact_id, s.stripe_email, s.notes, s.created_at,
       c.first_name||' '||c.last_name as buyer, c.email as buyer_email, c.phone as buyer_phone
from pos_sales s left join contacts c on c.id = s.buyer_contact_id
where s.id = '4446c75d-9e8e-4fec-82e1-2198b0988e5c';
