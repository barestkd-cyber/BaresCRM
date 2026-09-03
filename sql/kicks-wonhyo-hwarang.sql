-- Kicks, dictated by Race 2026-09-03. Twist kick confirmed as Won-Hyo, not
-- Hwa-Rang. Neither form is up this cycle (Do-San / Jun-Gun / Choong-Moo),
-- so this is banked for when those rotations come round again - which is the
-- point of keying curriculum to the form rather than to a cycle.
insert into public.cycle_curriculum (category, scope, cycle_id, form_name, content, updated_by)
values
  ('kicks', 'form', null, 'Won-Hyo',
   '[{"title":"Won-Hyo Cycle","items":["Twist kick","Sliding spin side kick"]}]'::jsonb,
   'Race, dictated'),
  ('kicks', 'form', null, 'Hwa-Rang',
   '[{"title":"Hwa-Rang Cycle","items":["360 round kick","Jump spin crescent"]}]'::jsonb,
   'Race, dictated')
on conflict (category, form_name) where scope = 'form'
do update set content = excluded.content, updated_by = excluded.updated_by, updated_at = now();

select form_name, category, jsonb_array_length(content) as blocks,
       content -> 0 -> 'items' as items
  from public.cycle_curriculum
 where scope='form' and form_name in ('Won-Hyo','Hwa-Rang');
