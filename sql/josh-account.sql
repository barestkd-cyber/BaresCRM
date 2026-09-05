select u.email,
       u.created_at::text as created,
       coalesce(u.last_sign_in_at::text,'never') as last_sign_in,
       coalesce(u.confirmed_at::text,'not confirmed') as confirmed
  from auth.users u
 where u.email ilike '%nannen%' or u.email ilike '%josh%'
 order by u.created_at desc;
