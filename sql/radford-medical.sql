-- First real medical note, so Race can see the block render (2026-08-26).
update contacts
   set medical_concerns = 'Hip mobility concerns: alter side kicks and round kicks.'
 where first_name ilike '%radford%' or (first_name ilike 'lee%' and last_name ilike 'tarry jr%')
returning first_name || ' ' || last_name as who, medical_concerns;
