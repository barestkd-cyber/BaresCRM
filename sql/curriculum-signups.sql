-- Who created an account or signed in yesterday and today, and whether their
-- address actually resolves to a student (the "empty profile" failure).
select 'NEW' as probe,
       u.email as a,
       u.created_at::date::text as b,
       coalesce(u.last_sign_in_at::date::text,'never') as c,
       case when exists (
              select 1 from public.student_guardians sg
               where lower(sg.email) = lower(u.email))
         or exists (
              select 1 from public.guardian_emails ge
               where lower(ge.email) = lower(u.email))
         or exists (
              select 1 from public.contacts c2
               where lower(c2.email) = lower(u.email))
         then 'linked' else 'NO STUDENT' end as d
  from auth.users u
 where u.created_at >= now() - interval '2 days'
union all
select 'SIGNIN', u.email, u.created_at::date::text,
       u.last_sign_in_at::text,
       case when exists (
              select 1 from public.student_guardians sg
               where lower(sg.email) = lower(u.email))
         or exists (
              select 1 from public.guardian_emails ge
               where lower(ge.email) = lower(u.email))
         then 'linked' else 'NO STUDENT' end
  from auth.users u
 where u.last_sign_in_at >= now() - interval '2 days'
   and u.created_at < now() - interval '2 days'
 order by 1, 3 desc, 2;
