-- A second student on the test account, so the swipe between students can
-- actually be seen (owner, 2026-09-03: "add a second next to gigigi").
-- Junk data on purpose, same as the first. Senior Brown so its belt looks
-- clearly different from the first kid's White Belt.
insert into public.contacts (id, first_name, last_name, rank, segment, brand)
select '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f', 'bobobob', 'kikikik',
       'Senior Brown Belt', 'trial', 'btkd'
 where not exists (select 1 from public.contacts
                    where id = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f');

insert into public.student_guardians (student_id, email, name, label)
select '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f', 'rocketlauncher500@gmail.com',
       'Race (geofence test)', 'parent'
 where not exists (select 1 from public.student_guardians
                    where student_id = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
                      and lower(email) = 'rocketlauncher500@gmail.com');

insert into public.enrollments (student_id, program, status, started_on)
select '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f', 'Juniors', 'active', current_date
 where not exists (select 1 from public.enrollments
                    where student_id = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
                      and program = 'Juniors');

select trim(c.first_name||' '||c.last_name) as student, c.rank,
       (select count(*) from public.enrollments e
         where e.student_id=c.id and e.status='active') as active_enrollments
  from public.contacts c
  join public.student_guardians sg on sg.student_id = c.id
 where lower(sg.email) = 'rocketlauncher500@gmail.com'
 order by c.first_name;

-- TEARDOWN for both test kids is in sql/geofence-testrig.sql; this one adds:
-- delete from public.enrollments where student_id='7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
-- delete from public.student_guardians where student_id='7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
-- delete from public.contacts where id='7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
