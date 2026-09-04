select u.email,
       u.created_at::date::text as signed_up,
       coalesce(u.last_sign_in_at::date::text,'never') as last_sign_in,
       case when u.encrypted_password is null or u.encrypted_password = '' then 'NO PASSWORD SET' else 'has password' end as pw,
       coalesce(u.email_confirmed_at::date::text,'not confirmed') as confirmed
  from auth.users u
 where u.email ilike '%tnewsom%' or u.email ilike '%newsom%';
