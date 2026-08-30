-- Read-only: what status signed agreements actually carry, and the recent
-- rows behind "i cant view membership agreement signed from the profile".
select 'BYSTATUS' as probe, coalesce(status,'(null)') as a,
       count(*)::text as b,
       count(*) filter (where signed_at is not null)::text as c,
       '' as d
  from public.membership_agreements
 group by status
union all
select 'DEFAULT', coalesce(column_default,'(none)'), '', '', ''
  from information_schema.columns
 where table_schema='public' and table_name='membership_agreements'
   and column_name='status'
union all
select 'RECENT', coalesce(c.first_name||' '||c.last_name,'?'),
       coalesce(a.status,'(null)'),
       coalesce(a.signed_at::date::text,'unsigned'),
       coalesce(a.membership_id::text,'NO membership link')
  from public.membership_agreements a
  left join public.contacts c on c.id = a.contact_id
 where a.created_at > '2026-08-27'
 order by 1, 4 desc;
