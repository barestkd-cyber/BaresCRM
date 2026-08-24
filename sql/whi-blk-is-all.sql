-- WHI-BLK was a second spelling of "everyone" (owner: "whi-blk is same as
-- all"). The one class carrying it becomes 'All', matching Forms and Sparring,
-- and WHI-BLK leaves the dropdown and the filter table in the same commit.
update schedule_template
   set belt = 'All'
 where day = 2 and "time" = '10:15' and belt = 'WHI-BLK'
returning day, "time", label, belt;
