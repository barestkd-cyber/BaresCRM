-- Read-only: every FK into pos_sales and what it does on delete, plus how
-- many rows each holds against the Kubit duplicate (8578258b).
select conrelid::regclass::text as holder,
       conname,
       pg_get_constraintdef(oid) as def
  from pg_constraint
 where confrelid = 'public.pos_sales'::regclass
 order by 1;
