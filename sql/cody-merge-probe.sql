-- Read-only: both Cody Mogles and everything hanging off each, before the
-- merge and the removal of the phantom 8/26 membership.
with codys as (
  select id from public.contacts
   where first_name ilike 'cody' and last_name ilike 'mogle'
)
select 'CONTACT' as probe, c.id::text as a,
       c.first_name || ' ' || c.last_name as b,
       coalesce(c.rank,'(no rank)') || ' · ' || c.segment::text as c2,
       c.created_at::date::text as d
  from public.contacts c where c.id in (select id from codys)
union all
select 'MEMBERSHIP', m.id::text, coalesce(m.program,''),
       m.status::text || ' · ' || coalesce(m.plan_code,''),
       m.created_at::date::text
  from public.memberships m where m.contact_id in (select id from codys)
union all
select 'SALE', s.id::text, s.status,
       (s.total_cents/100.0)::text, s.sale_date::text
  from public.pos_sales s
 where s.buyer_contact_id in (select id from codys)
union all
select 'LINE', l.sale_id::text, l.label,
       coalesce(l.membership_id::text,'no mem link'), ''
  from public.pos_sale_lines l
 where l.student_contact_id in (select id from codys)
union all
select 'AGREEMENT', a.id::text, coalesce(a.document_title,''),
       coalesce(a.membership_id::text,'no mem link'),
       coalesce(a.signed_at::date::text,'unsigned')
  from public.membership_agreements a
 where a.contact_id in (select id from codys)
union all
select 'ENROLLMENT', e.id::text, e.program, coalesce(e.status,''), ''
  from public.enrollments e where e.student_id in (select id from codys)
union all
select 'GUARDIAN', sg.guardian_id::text, coalesce(g.name,'(nameless)'),
       coalesce(sg.label,''), sg.student_id::text
  from public.student_guardians sg
  left join public.guardians g on g.id = sg.guardian_id
 where sg.student_id in (select id from codys)
union all
select 'SIGNUP', t.id::text, t.student_name, t.paid::text, ''
  from public.testing_signups t where t.contact_id in (select id from codys)
 order by 1, 5 nulls last, 4;
