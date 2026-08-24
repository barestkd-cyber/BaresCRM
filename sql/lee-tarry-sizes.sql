-- Lee Tarry's gear sizes, given at the desk 2026-08-23.
-- Belt 4, kick 9/10.
update contacts
   set belt_size = '4',
       kick_size = '9/10'
 where lower(first_name) = 'lee'
   and lower(last_name)  = 'tarry'
returning id, first_name, last_name, rank, belt_size, kick_size;
