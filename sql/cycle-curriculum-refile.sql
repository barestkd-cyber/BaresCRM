-- Re-file rotating curriculum by the form each block names.
-- Generated from portal/shared/belts.js; replaces the first seeding,
-- which filed multi-form stripes under a single form.

delete from public.cycle_curriculum where scope = 'form';

insert into public.cycle_curriculum (category, scope, cycle_id, form_name, content) values
  ('kicks', 'form', null, 'Ki-Bon', '[{"title":"Kicks","items":["#1 Side Kick (front leg)","#1 Front Kick (front leg)","#2 Front Kick (back leg)","#1 Round Kick (front leg)","#2 Round Kick (back leg)","Inside Crescent Kick","Outside Crescent Kick"]}]'::jsonb),
  ('form', 'form', null, 'Dan-Gun', '[{"title":"Dan-Gun Cycle","items":["Dan-Gun (21 movements)"]}]'::jsonb),
  ('form', 'form', null, 'Do-San', '[{"title":"Do-San Cycle","items":["Do-San (24 movements)"]}]'::jsonb),
  ('kicks', 'form', null, 'Dan-Gun', '[{"title":"Dan-Gun Cycle","items":["Front kick/round kick combo","Spin side kick","Spin crescent kick"]},{"title":"Dan-Gun Cycle","items":["Front kick/round kick combo","Spin side kick","Spin crescent kick","Slide side kick","Skip round kick","#2 Jump round kick"]}]'::jsonb),
  ('kicks', 'form', null, 'Do-San', '[{"title":"Do-San Cycle","items":["#3 Front kick","#3 Side kick","#3 Round kick","#2 Hook kick"]},{"title":"Do-San Cycle","items":["#3 Front kick","#3 Side kick","#3 Round kick","#2 Hook kick","Slide side kick","Skip round kick","#2 Jump round kick"]}]'::jsonb),
  ('sparring-combo', 'form', null, 'Dan-Gun', '[{"title":"Dan-Gun Combo 1","items":["Outer forearm block","Reverse ridgehand","#2 Round kick","Spin side kick"]},{"title":"Dan-Gun Combo 2","items":["Outside block","Reverse punch","Hook punch","#1 Side kick","Spin crescent kick"]}]'::jsonb),
  ('sparring-combo', 'form', null, 'Do-San', '[{"title":"Do-San Combo 1","items":["#3 Side kick","Lead backfist","Reverse punch","#2 Hook kick"]},{"title":"Do-San Combo 2","items":["#3 Round kick","#2 Front kick/round kick combo","Reverse hook punch (#4)","Lead uppercut (#5)"]}]'::jsonb);

select form_name, category, jsonb_array_length(content) as blocks
  from public.cycle_curriculum where scope='form' order by form_name, category;
