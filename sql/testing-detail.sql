select test_date, start_time, label, program, applies_to, signup_by,
       fee_cents, fee_addl_cents, cycle_ref
from testing_dates order by test_date, start_time;
