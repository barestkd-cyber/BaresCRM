-- Read-only probe before importing the 20 Spark-paid testers into
-- testing_signups. One UNION so the CLI returns everything in a single set:
-- session ids, live table shape, name->contact matches, and any signup rows
-- already held by these families (census said zero overlap; verify).

select 'A_SESSION' as probe, id::text as a, label as b, test_date::text as c,
       coalesce(start_time,'') as d, '' as e
  from public.testing_dates

union all
select 'B_COLUMN', column_name, data_type, is_nullable, '', ''
  from information_schema.columns
 where table_schema = 'public' and table_name = 'testing_signups'

union all
select 'C_CONSTRAINT', conname, pg_get_constraintdef(oid), '', '', ''
  from pg_constraint
 where conrelid = 'public.testing_signups'::regclass
   and contype in ('c','u')

union all
select 'D_MATCH', s.first_name || ' ' || s.last_name,
       count(c.id)::text, coalesce(min(c.id::text),''),
       coalesce(min(c.rank),''), coalesce(min(c.segment::text),'')
  from (values
    ('Wyatt','Osborne'),('Zoey','Osborne'),('Davis','Fretty'),
    ('John','Cater'),('Sophie','Cater'),('Samuel','Root'),
    ('Morgan','Mogle'),('Samuel','Ortiz'),('Travis','Splinter'),
    ('Andrew','Foster'),('Isabella','Foster'),
    ('Henry','Tarry'),('Lee','Tarry'),('Adonai','Arellano'),
    ('Ezra','Lackey'),('Zachary','Lackey'),
    ('Dustin','Wilson'),('Ian','Wilson'),('Savannah','Wilson')
  ) as s(first_name, last_name)
  left join public.contacts c
    on c.first_name ilike s.first_name and c.last_name ilike s.last_name
 group by s.first_name, s.last_name

union all
select 'E_RADFORD', id::text, first_name || ' ' || last_name,
       coalesce(rank,''), coalesce(segment::text,''), ''
  from public.contacts
 where last_name ilike 'tarry jr%'

union all
select 'F_EXISTING', ts.student_name, coalesce(td.label,''),
       coalesce(ts.source::text,''), ts.paid::text, coalesce(ts.contact_id::text,'')
  from public.testing_signups ts
  left join public.testing_dates td on td.id = ts.testing_date_id
 where ts.student_name ilike any (array[
   '%osborne%','%fretty%','%cater%','%root%','%mogle%','%ortiz%',
   '%splinter%','%foster%','%tarry%','%arellano%','%lackey%','%wilson%'
 ])

union all
select 'G_SOURCE_ENUM', e.enumlabel, '', '', '', ''
  from pg_enum e
  join pg_type t on t.oid = e.enumtypid
 where t.typname = 'signup_source'

order by 1, 2;
