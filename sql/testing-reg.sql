-- Everything that could hold a testing registration.
select 'testing_signups' as src, count(*) as rows from testing_signups
union all
select 'event_registrations', count(*) from event_registrations
union all
select 'testing_groups (live)', count(*) from testing_groups where active
union all
select 'testing_groups (all)', count(*) from testing_groups;
