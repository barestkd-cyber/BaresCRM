-- last_sign_in_at only moves on a FRESH password sign-in. A session that is
-- still alive refreshes silently, so someone can use the app daily and never
-- update that column. auth.sessions is where real activity shows.
select u.email,
       s.updated_at::text as last_active,
       s.created_at::date::text as session_started
  from auth.sessions s
  join auth.users u on u.id = s.user_id
 where s.updated_at >= now() - interval '3 days'
 order by s.updated_at desc;
