-- Kicks for THIS cycle's intermediate and advanced forms, dictated by Race
-- 2026-09-03. These two groups had no kicks content at all, and both forms
-- are up now, so this shows to students immediately.
--
-- The 360 into a back stance is a form movement rather than a kick; he asked
-- for it under the kick stripe anyway, so it is labelled rather than hidden.
insert into public.cycle_curriculum (category, scope, cycle_id, form_name, content, updated_by)
values
  ('kicks', 'form', null, 'Jun-Gun',
   '[{"title":"Jun-Gun Cycle","items":["Spin hook kick","Axe kick"]}]'::jsonb,
   'Race, dictated'),
  ('kicks', 'form', null, 'Choong-Moo',
   '[{"title":"Choong-Moo Cycle","items":["Two step jump side kick (from the form)","Jump spin side kick","360 into a back stance (from the form)"]}]'::jsonb,
   'Race, dictated')
on conflict (category, form_name) where scope = 'form'
do update set content = excluded.content, updated_by = excluded.updated_by, updated_at = now();

-- What every group now sees for this cycle's forms.
select c.form_name, c.category, c.content -> 0 -> 'items' as items
  from public.cycle_curriculum c
 where c.scope='form' and c.form_name in ('Do-San','Jun-Gun','Choong-Moo')
 order by c.form_name, c.category;
