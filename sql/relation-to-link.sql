-- A relationship is between TWO people, so it belongs on the LINK, not on the
-- person (Race, 2026-08-26). Lindsay Tarry is Lee's Spouse AND Radford's Mom;
-- one field on her record can only say one of those, and it was saying Spouse
-- on her children's profiles.
--
-- student_guardians.label becomes that per-link relationship. Its current
-- contents are legacy Spark import values - primary / secondary / parent /
-- guardian - which describe rank or nothing, not a relationship, and are NOT
-- what marks the primary contact (households.primary_guardian_id does that).
--
-- guardians.relation stays as the fallback for house-level guardians, who are
-- attached to a roof rather than to any one child.
update student_guardians sg
   set label = g.relation
  from guardians g
 where g.id = sg.guardian_id
   and coalesce(g.relation,'') <> ''
   and lower(coalesce(sg.label,'')) in ('', 'primary', 'secondary', 'parent', 'guardian');

-- Legacy values with no relationship behind them say nothing rather than
-- claiming a rank the app no longer uses.
update student_guardians
   set label = null
 where lower(coalesce(label,'')) in ('primary', 'secondary', 'parent', 'guardian');

select coalesce(nullif(label,''),'(none)') as link_label, count(*) as links
  from student_guardians group by 1 order by 2 desc;
