select 'testing_signups' as src, count(*)::text as n from testing_signups
union all select 'testing_sessions', count(*)::text from testing_sessions
union all select 'testing_dates', count(*)::text from testing_dates
union all select 'testing_history', count(*)::text from testing_history
union all select 'testing_draft', count(*)::text from testing_draft
union all select 'event_registrations', count(*)::text from event_registrations;
