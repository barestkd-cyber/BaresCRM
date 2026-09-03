-- ===========================================================================
-- TEST RIG for the curriculum parent check-in geofence (owner, 2026-09-02).
-- ---------------------------------------------------------------------------
-- Race signs in to the curriculum app as rocketlauncher500@gmail.com (auth
-- account already exists, last sign-in 2026-07-30) and tries to check a kid
-- in from the lobby and from home. The fence has NEVER run in production -
-- zero parent/parent_gps rows in 298 attendance records - so this is its
-- first real exercise.
--
-- Uses the existing JUNK contact "gigigigig bibibib" (affa5794). No real
-- family is touched. Two rows are needed for the panel to appear at all:
--   1. student_guardians keyed on the EMAIL - my_student_ids() resolves the
--      signed-in user to their kids through this, guardian_id stays null
--      because the lookup is by email, not by guardian row.
--   2. an ACTIVE Juniors enrollment - the panel only lists classes whose
--      program the student is enrolled in. Juniors meets 3x Wednesday
--      (4:15 BR-BLK, 4:45 WHI-BLU, 10:15 All), so there is always a button.
--
-- NOTE: an active enrollment makes this junk student appear on the Juniors
-- roster in the CRM and kiosk until the teardown at the bottom is run.
-- ===========================================================================

insert into public.student_guardians (student_id, email, name, label)
select 'affa5794-18e7-4945-9f48-33708b92dc95', 'rocketlauncher500@gmail.com',
       'Race (geofence test)', 'parent'
 where not exists (
   select 1 from public.student_guardians
    where student_id = 'affa5794-18e7-4945-9f48-33708b92dc95'
      and lower(email) = 'rocketlauncher500@gmail.com');

insert into public.enrollments (student_id, program, status, started_on)
select 'affa5794-18e7-4945-9f48-33708b92dc95', 'Juniors', 'active', current_date
 where not exists (
   select 1 from public.enrollments
    where student_id = 'affa5794-18e7-4945-9f48-33708b92dc95'
      and program = 'Juniors');

-- Verify the rig, and show what the app will offer today.
select 'LINK' as probe, sg.email as a, coalesce(sg.label,'') as b,
       coalesce(s.name,'?') as c
  from public.student_guardians sg
  left join public.students s on s.id = sg.student_id
 where lower(sg.email) = 'rocketlauncher500@gmail.com'
union all
select 'ENROLL', e.program, e.status, e.started_on::text
  from public.enrollments e
 where e.student_id = 'affa5794-18e7-4945-9f48-33708b92dc95'
union all
select 'TODAY', coalesce(st.label,''), coalesce(st.time,''), coalesce(st.belt,'')
  from public.schedule_template st
 where st.day = 2 and st.prog_css = 'prog-juniors'
 order by 1,2;

-- ── TEARDOWN, when the test is done ────────────────────────────────────────
-- delete from public.attendance where student_id='affa5794-18e7-4945-9f48-33708b92dc95';
-- delete from public.enrollments where student_id='affa5794-18e7-4945-9f48-33708b92dc95';
-- delete from public.student_guardians where student_id='affa5794-18e7-4945-9f48-33708b92dc95'
--   and lower(email)='rocketlauncher500@gmail.com';
