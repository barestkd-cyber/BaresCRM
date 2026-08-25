select 'email match: ' || e.addr as probe,
       coalesce(c.first_name || ' ' || c.last_name, '(NO CONTACT HAS THIS EMAIL)') as who,
       coalesce(c.created_at::text, '') as created
  from (values ('tessawingfield8415@gmail.com'), ('tnewsom@emaengineer.com'), ('tim@apples.email')) e(addr)
  left join contacts c on lower(c.email) = e.addr
union all
select 'name: ' || n.nm,
       c.first_name || ' ' || c.last_name || ' · email=' || coalesce(c.email, 'NONE') || ' · seg=' || c.segment::text,
       c.created_at::text
  from (values ('Wingfield'), ('Newsom'), ('Apple')) n(nm)
  join contacts c on c.last_name ilike n.nm
 order by 1;
