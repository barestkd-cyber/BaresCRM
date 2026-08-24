-- Read-only. The WED 9:30 Little Kickers row in full, so class plan's baked
-- snapshot (which is missing it) can be completed accurately.
select day, "time", time_h, time_m, label, belt, prog_css, default_instructor, duration
  from schedule_template
 where day = 2 and "time" = '9:30';
