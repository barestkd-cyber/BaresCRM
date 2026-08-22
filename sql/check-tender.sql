select con.conname, pg_get_constraintdef(con.oid) as def
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname='public' and rel.relname in ('pos_sales','pos_payments')
  and pg_get_constraintdef(con.oid) ilike '%method%';
