-- Merge the duplicate Johnny Kubit (Race, 2026-08-26: "they went back and
-- signed the link and so they created a duplicate").
--
--   KEEP  e427d210  created 8/18 - the original, and where the guardians
--                   (Hillary Fort, Jack) are already attached
--   MERGE 701d0976  created 8/26 - carries the PAID sale, its membership,
--                   the Little Kickers roster place, and the signed agreement
--
-- Everything on the newer record is repointed at the keeper BEFORE it is
-- deleted, because most of these foreign keys are ON DELETE CASCADE: deleting
-- the husk first would destroy the paid sale's membership, the roster place
-- and the signed agreement outright.
--
-- The newer record also carries the CORRECT date of birth. 2026-10-04 on the
-- old row was a transposition typed at the first checkout - a date six weeks
-- in the future. The parent typed 2023-10-26 the second time, which fits a
-- two-year-old in Little Kickers. That is their correction, not a guess.
do $$
declare
  keep uuid := 'e427d210-07b8-430c-9452-57ed79273818';
  gone uuid := '701d0976-6186-4332-90a2-3dcc98f47bec';
  t record;
  moved int;
begin
  -- Every column in the schema that points at a contact, repointed generically
  -- so nothing is missed by hand-listing.
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

  -- Their own correction to the birthday.
  update contacts c
     set dob = '2023-10-26'::date
   where c.id = keep;

  delete from contacts where id = gone;
end $$;

select c.id::text as surviving_id,
       c.first_name || ' ' || c.last_name as who,
       c.dob::text as dob,
       c.segment::text as segment,
       (select count(*) from student_guardians sg where sg.student_id = c.id) as guardians,
       (select count(*) from pos_sales s where s.buyer_contact_id = c.id) as sales,
       (select count(*) from memberships m where m.contact_id = c.id) as memberships,
       (select count(*) from enrollments e where e.student_id = c.id) as rosters,
       (select count(*) from membership_agreements ma where ma.contact_id = c.id) as agreements
  from contacts c where c.last_name ilike '%kubit%';
