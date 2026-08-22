-- 2026-08-21: the $1.33 desk test invoice was refunded in Stripe before the
-- "a refund that leaves a balance returns the invoice to unpaid" rule existed
-- (see ECOSYSTEM §15). Put that one row under the rule. Idempotent: only a
-- paid invoice with a short ledger flips.
update public.pos_sales s
   set status = 'unpaid', receipt_sent_at = null
 where s.id = '20b133e6-39bb-4291-ad9c-8f26bd2c9c89'
   and s.status = 'paid'
   and (select coalesce(sum(amount_cents), 0) from public.pos_payments p where p.sale_id = s.id) < s.total_cents;

select id, status, total_cents, receipt_sent_at from public.pos_sales where id = '20b133e6-39bb-4291-ad9c-8f26bd2c9c89';
