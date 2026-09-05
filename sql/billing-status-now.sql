-- Read-only: the recurring-billing machinery's CURRENT live state.
select 'ENGINE' as probe,
       (select billing_engine_live::text from public.settings limit 1) as a,
       '' as b, '' as c
union all
select 'CRON', jobname, schedule, active::text
  from cron.job where jobname in ('charge-due','daily-report','sweep-abandoned')
union all
select 'MEMBERSHIPS', coalesce(billing_frequency,'(null)'),
       count(*)::text,
       count(*) filter (where status = 'active')::text
  from public.memberships
 group by billing_frequency
union all
select 'INSTALLMENTS', status::text, count(*)::text, ''
  from public.membership_installments
 group by status
 order by 1, 2;
