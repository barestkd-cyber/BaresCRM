select conrelid::regclass::text || '.' || (select string_agg(a.attname,',')
         from unnest(conkey) k join pg_attribute a on a.attrelid=conrelid and a.attnum=k) as fk,
       case confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL'
                        when 'a' then 'NO ACTION <-- blocks' else confdeltype::text end as on_delete
  from pg_constraint where confrelid='public.memberships'::regclass and contype='f'
union all
select 'ROWS: agreements on Johnny''s membership',
       (select count(*)::text from agreements a
         join memberships m on m.id = a.membership_id
         join pos_sales s on s.id = m.sale_id
        where left(s.id::text,8)='8578258b')
union all
select 'ROWS: membership_agreements on that sale',
       (select count(*)::text from membership_agreements ma
         join pos_sales s on s.id = ma.sale_id where left(s.id::text,8)='8578258b');
