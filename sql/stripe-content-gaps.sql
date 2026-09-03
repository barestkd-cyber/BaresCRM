-- What rotating curriculum actually has content, and how much.
select scope, category, coalesce(form_name,'(school-wide)') as keyed_on,
       jsonb_array_length(content) as blocks,
       left(replace(content::text, E'\n', ' '), 60) as preview
  from public.cycle_curriculum
 order by scope, category, keyed_on;
