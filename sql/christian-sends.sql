-- Read-only: everything created for Christian Brown today, and every trace
-- of an email actually leaving - the invoice email stamp on the sale, and
-- the agreement invite row.
select 'MEMBERSHIP' as probe, m.id::text as a, coalesce(m.program,'') as b,
       m.status::text as c, m.created_at::text as d
  from public.memberships m
 where m.contact_id = '1b235c45-05cb-455b-9e08-24756a5a31a2'
union all
select 'SALE', s.id::text, s.status,
       (s.total_cents/100.0)::text || ' · receipt_sent ' || coalesce(s.receipt_sent_at::text,'NEVER'),
       s.created_at::text
  from public.pos_sales s
 where s.buyer_contact_id = '1b235c45-05cb-455b-9e08-24756a5a31a2'
union all
select 'AGREEMENT', a.id::text, coalesce(a.document_title,''),
       a.status || ' · signed_at ' || coalesce(a.signed_at::text,'-'),
       a.created_at::text
  from public.membership_agreements a
 where a.contact_id = '1b235c45-05cb-455b-9e08-24756a5a31a2'
union all
select 'INVITE', i.id::text,
       coalesce(i.sent_to,''),
       coalesce(i.document_title,'') || ' · signed_at ' || coalesce(i.signed_at::text,'-')
         || ' · expires ' || i.expires_at::date,
       i.created_at::text
  from public.agreement_invites i
 where i.contact_id = '1b235c45-05cb-455b-9e08-24756a5a31a2'
 order by 1, 5;
