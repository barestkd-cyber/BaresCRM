-- Real studio hours, taken from the website's own openingHoursSpecification
-- (barestkd-site/index.html), which is what the public and Google already see.
--   Mon 2:30 PM - 8:00 PM
--   Tue 2:00 PM - 8:30 PM
--   Wed 9:30-11:00 AM  and  2:00 PM - 6:30 PM
--   Thu 2:30 PM - 8:00 PM
--   Sat 9:30 AM - 12:00 PM
--
-- Owner, 2026-08-20: "Don't include the Wednesday morning hours since I'll be
-- in class those hours." So Wednesday opens at 2:00 PM for booking purposes.
--
-- Saturday opens 9:30 and the first class IS 9:30, so there is no before-class
-- window at all: Saturday will correctly offer nothing. Flagged to him rather
-- than quietly fudging an earlier open time.
update public.settings
   set private_open_hours = 'Mon 2:30 PM, Tue 2:00 PM, Wed 2:00 PM, Thu 2:30 PM, Sat 9:30 AM'
 where id = true;

select private_open_hours, private_blocked_slots from public.settings limit 1;
