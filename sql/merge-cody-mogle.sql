-- Merge the duplicate Cody Mogle and remove the phantom 8/26 membership
-- (owner, 2026-08-30: "merge both codys and then take off that membership
-- from 8 26").
--
--   KEEP  a32e5fbb  created 8/29 - the real enrollment: paid sale, ACTIVE
--                   membership, Friday's signed agreement, Michelle linked
--   MERGE c9239fb1  created 8/26 - the failed-attempts lead: abandoned sale,
--                   CANCELLED membership, the 8/26 signed agreement, and a
--                   second guardian (Alexander mogle)
--
-- Same generic FK-walk as merge-johnny-kubit.sql, plus two Cody-specifics:
--   * Michelle links BOTH records, so her link on the loser is dropped
--     before the walk rather than repointed into a duplicate.
--   * The 8/26 membership (c54617e5, already cancelled) is DELETED after
--     the merge: its line releases first, its installments go with it, and
--     its signed agreement survives with membership_id nulled - the paper
--     is history that really happened, the membership is not.
do $$
declare
  keep uuid := 'a32e5fbb-b9a6-49a2-85e9-9f1eb83e3f44';
  gone uuid := 'c9239fb1-2588-4bb7-b4c3-06165a749788';
  ghost_mem uuid := 'c54617e5-adb4-4d22-abe1-1885e3cc6fc3';
  t record;
  moved int;
begin
  -- A guardian already on the keeper must not arrive twice.
  delete from student_guardians sg
   where sg.student_id = gone
     and exists (select 1 from student_guardians k
                  where k.student_id = keep and k.guardian_id = sg.guardian_id);

  for t in
    select conrelid::regclass::text as tbl,
           (select a.attname from unnest(conkey) k
              join pg_attribute a on a.attrelid = conrelid and a.attnum = k limit 1) as col
      from pg_constraint
     where confrelid = 'public.contacts'::regclass and contype = 'f'
  loop
    execute format('update %s set %I = $1 where %I = $2', t.tbl, t.col, t.col)
      using keep, gone;
    get diagnostics moved = row_count;
    if moved > 0 then
      raise notice 'moved % row(s): %.%', moved, t.tbl, t.col;
    end if;
  end loop;

  delete from contacts where id = gone;

  -- The phantom membership, in FK order: line lets go, schedule goes,
  -- membership goes. Its agreement's membership_id is ON DELETE SET NULL.
  update pos_sale_lines set membership_id = null where membership_id = ghost_mem;
  delete from membership_installments where membership_id = ghost_mem;
  delete from memberships where id = ghost_mem;
end $$;

select c.id::text as surviving_id,
       c.first_name || ' ' || c.last_name as who,
       c.segment::text as segment,
       (select count(*) from student_guardians sg where sg.student_id = c.id) as guardians,
       (select count(*) from pos_sales s where s.buyer_contact_id = c.id) as sales,
       (select count(*) from memberships m where m.contact_id = c.id) as memberships,
       (select count(*) from enrollments e where e.student_id = c.id) as rosters,
       (select count(*) from membership_agreements ma where ma.contact_id = c.id) as agreements
  from contacts c
 where c.first_name ilike 'cody' and c.last_name ilike 'mogle';
