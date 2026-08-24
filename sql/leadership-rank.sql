-- Leadership is Orange through Black (owner, 2026-08-24). New range ORG-BLK;
-- the CRM's attendance filter learns it in the same commit.
update schedule_template
   set belt = 'ORG-BLK'
 where day = 1 and "time" = '5:45' and label = 'Leadership'
returning day, "time", label, belt, program;
