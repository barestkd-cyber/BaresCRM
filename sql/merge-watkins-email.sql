-- Sam Watkins had TWO guardian rows for the same man: "Dave Watkins" holding
-- david@davewatkins.net, and an unnamed row holding dcwatkins04@gmail.com -
-- same phone on both. Move the address onto his named record so both of his
-- emails sit on one person. Non-destructive: the duplicate row still stands
-- and is reported for Race to approve removing.
update guardian_emails
   set guardian_id = 'b62399e1-ed3c-4d9e-90a4-b4b93b206ebc'
 where lower(email) = 'dcwatkins04@gmail.com';

select g.name,
       coalesce((select string_agg(ge.email,', ' order by ge.email)
                   from guardian_emails ge where ge.guardian_id=g.id),'-') as emails
  from guardians g where g.id = 'b62399e1-ed3c-4d9e-90a4-b4b93b206ebc';
