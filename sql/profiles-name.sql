select p.name, p.role, u.email
  from public.profiles p join auth.users u on u.id = p.id
 where u.email ilike '%rocketlauncher%' or u.email ilike '%barestkd%';
