-- Anything NOT NULL without a default would make the roster insert fail on the
-- first click. The insert supplies: id, student_id, program, status, started_on.
select column_name, is_nullable, coalesce(column_default,'(no default)') as dflt
  from information_schema.columns
 where table_schema='public' and table_name='enrollments'
 order by ordinal_position;
