-- ============================================================================
-- BaresTKD — Parent self check-in policies
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Lets a logged-in parent/guardian
-- (resolved via my_student_ids() -> student_guardians by email) check their
-- OWN kids into class from the curriculum app, see those check-ins, and undo
-- a same-day check-in (any source, including kiosk). Staff policies are
-- untouched; permissive policies OR together.
-- Safe to re-run.
-- ============================================================================

-- Parents see their kids' attendance
drop policy if exists attendance_parent_select on attendance;
create policy attendance_parent_select on attendance for select
  using (student_id in (select my_student_ids()));

-- Parents check their kids in (parent sources only)
drop policy if exists attendance_parent_insert on attendance;
create policy attendance_parent_insert on attendance for insert
  with check (student_id in (select my_student_ids())
              and source in ('parent','parent_gps'));

-- Parents undo a SAME-DAY check-in for their kids (any source, per Mr. Bares).
-- "Same day" is studio-local time: bare current_date is UTC and would close
-- the undo window around 6-7 PM Texas time.
drop policy if exists attendance_parent_delete on attendance;
create policy attendance_parent_delete on attendance for delete
  using (student_id in (select my_student_ids())
         and class_date = (now() at time zone 'America/Chicago')::date);

-- Parents read their kids' class eligibility (which programs they attend)
drop policy if exists enrollments_parent_select on enrollments;
create policy enrollments_parent_select on enrollments for select
  using (student_id in (select my_student_ids()));

-- Parents read their own guardian links (kid list on the profile screen)
drop policy if exists student_guardians_parent_select on student_guardians;
create policy student_guardians_parent_select on student_guardians for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));

-- ============================================================================
-- ROLLBACK (commented)
-- ============================================================================
-- drop policy if exists attendance_parent_select        on attendance;
-- drop policy if exists attendance_parent_insert        on attendance;
-- drop policy if exists attendance_parent_delete        on attendance;
-- drop policy if exists enrollments_parent_select       on enrollments;
-- drop policy if exists student_guardians_parent_select on student_guardians;
