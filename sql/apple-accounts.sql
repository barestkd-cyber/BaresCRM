select u.email, u.created_at::date::text as signed_up,
       coalesce(u.last_sign_in_at::date::text,'never') as last_sign_in
  from auth.users u
 where u.email in ('tim@apples.email','sgtapple444@gmail.com','tdapple@me.com');
