-- Read-only. Why won't the Kubit unpaid invoice delete: every row that
-- holds onto it, plus the delete policies that gate the browser.
with ks as (
  select s.id, s.status, s.total_cents
    from public.pos_sales s
    join public.contacts c on c.id = s.buyer_contact_id
   where c.last_name ilike 'kubit'
)
select 'SALE' as probe, ks.id::text as a, ks.status as b,
       ks.total_cents::text as c, '' as d
  from ks
union all
select 'PAYMENT', p.sale_id::text, p.method, p.amount_cents::text, p.kind
  from public.pos_payments p where p.sale_id in (select id from ks)
union all
select 'LINE', l.sale_id::text, l.label,
       coalesce(l.membership_id::text,'no membership link'),
       coalesce(l.student_contact_id::text,'')
  from public.pos_sale_lines l where l.sale_id in (select id from ks)
union all
select 'MEMBERSHIP', m.sale_id::text, m.id::text, coalesce(m.status::text,''), coalesce(m.program,'')
  from public.memberships m where m.sale_id in (select id from ks)
union all
select 'INSTALLMENT', i.sale_id::text, i.id::text, coalesce(i.status::text,''), ''
  from public.membership_installments i where i.sale_id in (select id from ks)
union all
select 'SIGNUP', t.sale_id::text, t.student_name, t.paid::text, ''
  from public.testing_signups t where t.sale_id in (select id from ks)
union all
select 'EVENTREG', r.sale_id::text, r.id::text, '', ''
  from public.event_registrations r where r.sale_id in (select id from ks)
union all
select 'POLICY', tablename, policyname || ' (' || cmd || ')',
       coalesce(qual,''), ''
  from pg_policies
 where schemaname='public'
   and tablename in ('pos_sales','pos_sale_lines','memberships','testing_signups')
   and cmd in ('DELETE','UPDATE','ALL')
 order by 1, 2;
