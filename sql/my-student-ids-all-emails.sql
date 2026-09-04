-- ===========================================================================
-- A parent should find EVERY one of their students, whichever of their
-- addresses they sign in with.
-- ---------------------------------------------------------------------------
-- Tim Apple has three addresses on file, and student_guardians carries its own
-- copy of an email on each LINK. Liva's link says tdapple@me.com while Lua's
-- and Tim's say sgtapple444@gmail.com, so whichever address he used, one child
-- was missing (reported 2026-09-03).
--
-- The resolver read only that denormalised link email. It now also matches
-- through guardian_emails, which is the real list of a guardian's addresses,
-- so the link's own copy stops being the thing that decides. UNION dedupes.
-- ===========================================================================
create or replace function public.my_student_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- the address recorded on the link itself
  select sg.student_id
    from student_guardians sg
   where lower(sg.email) = lower(auth.jwt() ->> 'email')
  union
  -- any address on file for that guardian
  select sg.student_id
    from student_guardians sg
    join guardian_emails ge on ge.guardian_id = sg.guardian_id
   where lower(ge.email) = lower(auth.jwt() ->> 'email')
$function$;

-- Same rule for reading the links directly, or the app's fallback path would
-- still see only some of a parent's children.
drop policy if exists student_guardians_parent_select on public.student_guardians;
create policy student_guardians_parent_select on public.student_guardians for select
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email',''))
    or exists (select 1 from public.guardian_emails ge
                where ge.guardian_id = student_guardians.guardian_id
                  and lower(ge.email) = lower(coalesce(auth.jwt() ->> 'email','')))
  );

-- Prove it: what each of Tim's three addresses now resolves to.
with addr(email) as (values ('tim@apples.email'),('sgtapple444@gmail.com'),('tdapple@me.com'))
select a.email,
       (select string_agg(trim(c.first_name||' '||c.last_name), ', ' order by c.first_name)
          from public.student_guardians sg
          join public.contacts c on c.id = sg.student_id
         where lower(sg.email) = lower(a.email)
            or exists (select 1 from public.guardian_emails ge
                        where ge.guardian_id = sg.guardian_id
                          and lower(ge.email) = lower(a.email))
       ) as students_found
  from addr a;
