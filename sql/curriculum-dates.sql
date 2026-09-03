select 'CAL' as probe, coalesce(title,'(untitled)') as a, event_date::text as b,
       coalesce(type,'') || case when blocks_classes then '  [closes classes]' else '' end as c
  from public.calendar_events
 where event_date >= current_date - 14
union all
select 'ANNOUNCE', left(coalesce(text,''),60), created_at::date::text,
       case when coalesce(active,true) then 'ACTIVE' else 'off' end
  from public.announcements
 order by 1, 3;
