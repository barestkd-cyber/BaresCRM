select label, test_date::text as on_date, coalesce(public_from::text,'(null)') as public_from
  from public.testing_dates order by test_date;
