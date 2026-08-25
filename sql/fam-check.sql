select 'lua_links' as t, sg.guardian_id::text as a, count(*)::text as b
  from student_guardians sg
  join contacts c on c.id = sg.student_id
 where c.first_name = 'Lua' and c.last_name = 'Apple'
 group by sg.guardian_id
union all
select 'signup_order', ts.student_name, ts.family_position::text
  from testing_signups ts
 where ts.created_at >= '2026-08-24 05:00:00+00'
 order by 1, 3;
