-- Seed generated from the catalogue content already written.
-- Fills cycle_curriculum so the apps read rotating material from data.
with c as (select id from public.cycle_data where is_active limit 1)
insert into public.cycle_curriculum (category, scope, cycle_id, form_name, content)
values
  ('self-defense', 'cycle', (select id from c), null, '[{"title":"Current Cycle","items":["Block incoming punch","Parry to grab","Under the shoulder grab"]}]'::jsonb),
  ('power-combo', 'cycle', (select id from c), null, '[{"title":"Current Cycle","items":["Skipping roundhouse","Reverse punch (#2)","Roundhouse"]}]'::jsonb),
  ('mitt-combo', 'cycle', (select id from c), null, '[{"title":"Current Cycle","items":["Jab","Slip (#1 slip #3) — slip to left side","Hook punch"]}]'::jsonb),
  ('sparring-combo', 'cycle', (select id from c), null, '[{"title":"Current Cycle — Green Belt & Above","items":["#1 Slide sidekick","Hand fake","#2 Front kick","Spin sidekick","Feint spin kick","#1 Hook or step behind hook"]}]'::jsonb),
  ('form', 'form', null, 'Ki-Bon', '[{"title":"Form","items":["Ki-Bon — see form section above"]}]'::jsonb),
  ('kicks', 'form', null, 'Ki-Bon', '[{"title":"Kicks","items":["#1 Side Kick (front leg)","#1 Front Kick (front leg)","#2 Front Kick (back leg)","#1 Round Kick (front leg)","#2 Round Kick (back leg)","Inside Crescent Kick","Outside Crescent Kick"]}]'::jsonb),
  ('form', 'form', null, 'Dan-Gun', '[{"title":"Dan-Gun Cycle","items":["Dan-Gun (21 movements)"]},{"title":"Do-San Cycle","items":["Do-San (24 movements)"]}]'::jsonb),
  ('kicks', 'form', null, 'Dan-Gun', '[{"title":"Dan-Gun Cycle","items":["Front kick/round kick combo","Spin side kick","Spin crescent kick","Slide side kick","Skip round kick","#2 Jump round kick"]},{"title":"Do-San Cycle","items":["#3 Front kick","#3 Side kick","#3 Round kick","#2 Hook kick","Slide side kick","Skip round kick","#2 Jump round kick"]}]'::jsonb),
  ('sparring-combo', 'form', null, 'Dan-Gun', '[{"title":"Dan-Gun Combo 1","items":["Outer forearm block","Reverse ridgehand","#2 Round kick","Spin side kick"]},{"title":"Dan-Gun Combo 2","items":["Outside block","Reverse punch","Hook punch","#1 Side kick","Spin crescent kick"]},{"title":"Do-San Combo 1","items":["#3 Side kick","Lead backfist","Reverse punch","#2 Hook kick"]},{"title":"Do-San Combo 2","items":["#3 Round kick","#2 Front kick/round kick combo","Reverse hook punch (#4)","Lead uppercut (#5)"]}]'::jsonb),
  ('form', 'form', null, 'Jun-Gun', '[{"title":"Form","items":["See rotating schedule above"]}]'::jsonb),
  ('form', 'form', null, 'Hwa-Rang', '[{"title":"Form","items":["See rotating schedule above"]}]'::jsonb),
  ('form', 'form', null, 'Gwang-Gae', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Poe-Eun', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Gae-Baek', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Choong-Jang', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Yoo-Sin', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Ul-Ji', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Yon-Gae', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Juche', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Ko-Dang', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Choi-Yong', '[{"title":"Form","items":["See form section above"]}]'::jsonb),
  ('form', 'form', null, 'Tong-Il', '[{"title":"Form","items":["See form section above"]}]'::jsonb)
on conflict do nothing;

select scope, category, coalesce(form_name,'(school-wide)') as keyed_on,
       jsonb_array_length(content) as blocks
  from public.cycle_curriculum order by scope, category, keyed_on;
