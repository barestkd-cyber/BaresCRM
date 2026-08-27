select conrelid::regclass::text as tbl,
       (select string_agg(a.attname,',') from unnest(conkey) k
          join pg_attribute a on a.attrelid=conrelid and a.attnum=k) as col,
       case confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL' else 'NO ACTION' end as on_del
  from pg_constraint where confrelid='public.contacts'::regclass and contype='f'
 order by 1;
