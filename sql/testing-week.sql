select 'session' as t, left(to_jsonb(x)::text, 400) as row from testing_sessions x
union all
select 'date', left(to_jsonb(x)::text, 400) from testing_dates x;
