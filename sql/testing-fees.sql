select label, program,
       coalesce(fee_cents,0)/100.0 as first_seat,
       coalesce(fee_addl_cents,0)/100.0 as each_additional,
       test_date, start_time
  from testing_dates order by sort_order;
