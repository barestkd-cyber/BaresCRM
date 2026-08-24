-- Phase 1 of the schedule-programs migration (approved 2026-08-24).
--
-- The schedule starts SAYING what each class is, instead of encoding it in a
-- CSS colour name. Two additive columns and a 23-row backfill; label, belt,
-- prog_css, the website, events, memberships and enrollments are untouched.
--
--   program    what art/program the class is
--   divisions  who attends (Juniors / Teens/Adults); NULL where the program
--              IS the audience (Cubs, Little Kickers)
--
-- Backfill approved by Race from the review table:
--   AMP'D = Juniors + Teens/Adults ("could be anybody")
--   MON 6:45 written as it is NOW (becomes Jiu Jitsu on Sept 14)
--   Leadership = Juniors + Teens/Adults (his cell to correct any time)

alter table schedule_template add column if not exists program text;
alter table schedule_template add column if not exists divisions text[];

update schedule_template s
   set program = v.program,
       divisions = v.divisions
  from (values
    -- day, time, program, divisions
    (0, '4:30',  'AMP''D',         array['Juniors','Teens/Adults']),
    (0, '5:00',  'Taekwondo',      array['Juniors']),
    (0, '5:45',  'Kickboxing',     array['Teens/Adults']),
    (0, '6:45',  'Taekwondo',      array['Teens/Adults']),
    (1, '4:00',  'Cubs',           null),
    (1, '4:30',  'Taekwondo',      array['Juniors']),
    (1, '5:15',  'AMP''D',         array['Juniors','Teens/Adults']),
    (1, '5:45',  'Leadership',     array['Juniors','Teens/Adults']),
    (1, '6:15',  'Taekwondo',      array['Juniors']),
    (1, '7:15',  'Taekwondo',      array['Teens/Adults']),
    (2, '9:30',  'Little Kickers', null),
    (2, '10:15', 'Taekwondo',      array['Juniors','Teens/Adults']),
    (2, '4:15',  'Taekwondo',      array['Juniors']),
    (2, '4:45',  'Taekwondo',      array['Juniors']),
    (2, '5:30',  'Cubs',           null),
    (3, '4:30',  'Cubs',           null),
    (3, '5:00',  'AMP''D',         array['Juniors','Teens/Adults']),
    (3, '5:30',  'Taekwondo',      array['Juniors','Teens/Adults']),
    (3, '6:15',  'Taekwondo',      array['Juniors','Teens/Adults']),
    (3, '7:00',  'Jiu Jitsu',      array['Teens/Adults']),
    (5, '9:30',  'Cubs',           null),
    (5, '10:00', 'Taekwondo',      array['Juniors']),
    (5, '11:00', 'Taekwondo',      array['Teens/Adults'])
  ) as v(day, "time", program, divisions)
 where s.day = v.day and s."time" = v."time";

-- The proof: every row placed, none missed, none invented.
select day, "time", label, program, array_to_string(divisions, ' + ') as divisions
  from schedule_template
 order by day, time_h, time_m;
