select 'CYCLE' as probe,
       coalesce(name,'(unnamed)') as a,
       coalesce(start_date::text,'?') || ' + ' || coalesce(weeks::text,'?') || 'wk' as b,
       'active=' || is_active::text || '  half=' || coalesce(rotation_half,'-') as c,
       'beg=' || coalesce(form_beginner,'-') || ' | int=' || coalesce(form_inter,'-') || ' | adv=' || coalesce(form_adv,'-') as d,
       'awards=' || coalesce(awards_date::text,'-') || '  next=' || coalesce(following_cycle_begins::text,'-') as e
  from public.cycle_data
union all
select 'TESTDATES', label, test_date::text, coalesce(start_time,''), coalesce(program,''), ''
  from public.testing_dates
 order by 1, 3;
