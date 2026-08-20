-- ===========================================================================
-- One Stripe payment, one ledger row. Enforced by the database.
-- ---------------------------------------------------------------------------
-- 2026-08-20: Lacy Musslewhite enrolled Scottie Jackson in Little Kickers.
-- Her card was charged ONCE ($112.46, pi_3U6WZOF4LnItdhPi1dnTtlgh), but the
-- ledger recorded it TWICE, 15 milliseconds apart:
--
--   09:03:52.725  the stripe-webhook backstop
--   09:03:52.740  lk-checkout's own finalize step
--
-- Both are correct to watch for the payment. Both ran the same guard - SELECT
-- for an existing row with this stripe_object_id, INSERT if absent - and both
-- read "absent", because neither had committed yet. A check-then-write is not
-- safe against a race no matter how carefully it is written; only the database
-- can settle it.
--
-- STRIPE_PLAN §4 specified `stripe_object_id text unique` on this table. It
-- was never created: the table has a unique constraint on stripe_event_id but
-- not on stripe_object_id, so nothing refused the second row. That is the real
-- bug; the racing code merely exposed it.
--
-- The customer was never over-charged. What was wrong was our books: her
-- invoice read $224.92 collected against a $112.46 total, and the day's
-- revenue was overstated by the same amount.
--
-- Run:  supabase db query --linked -f sql/fix-duplicate-payment-rows.sql
-- ===========================================================================

-- 1 ─ show what is about to be removed, so it is on the record
select 'BEFORE' as stage, p.id, p.sale_id, p.amount_cents, p.stripe_object_id,
       coalesce(p.stripe_event_id, '(none)') as event_id, p.note
  from public.pos_payments p
 where p.stripe_object_id in (
   select stripe_object_id from public.pos_payments
    where stripe_object_id is not null
    group by stripe_object_id having count(*) > 1
 )
 order by p.stripe_object_id, p.occurred_at;

-- 2 ─ keep the FIRST row per Stripe object, drop the rest. The survivor is the
--     webhook's, which carries the Stripe event id and is the better record.
delete from public.pos_payments p
 where p.stripe_object_id is not null
   and exists (
     select 1 from public.pos_payments q
      where q.stripe_object_id = p.stripe_object_id
        and (q.occurred_at < p.occurred_at
             or (q.occurred_at = p.occurred_at and q.id < p.id))
   );

-- 3 ─ make it impossible from here on. Partial, because cash and check
--     payments legitimately have no Stripe object and there are many of them.
create unique index if not exists pos_payments_stripe_object_uidx
  on public.pos_payments (stripe_object_id)
  where stripe_object_id is not null;

-- 4 ─ verify: every sale's payments should now sum to at most its total
select 'AFTER' as stage,
       s.id, c.first_name || ' ' || coalesce(c.last_name,'') as who,
       s.total_cents, s.status,
       (select count(*) from public.pos_payments p where p.sale_id = s.id) as rows,
       (select coalesce(sum(p.amount_cents),0) from public.pos_payments p where p.sale_id = s.id) as paid_cents
  from public.pos_sales s
  left join public.contacts c on c.id = s.buyer_contact_id
 order by s.created_at desc;
