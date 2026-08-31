-- Owner, 2026-08-31: Victoria Newsom's dictated size was corrected 3 -> 4
-- mid-dictation; I stored the pre-correction value.
update public.contacts set belt_size = '4'
 where first_name ilike 'Victoria' and last_name ilike 'Newsom' and belt_size = '3';
select first_name || ' ' || last_name as who, belt_size
  from public.contacts where first_name ilike 'Victoria' and last_name ilike 'Newsom';
