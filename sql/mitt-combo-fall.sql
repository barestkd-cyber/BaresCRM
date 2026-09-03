-- Mitt combo for Fall Cycle 2026, dictated by Race 2026-09-03. School-wide,
-- so it is keyed to the active cycle and every belt training it sees the same
-- thing. Replaces the Worlds Cycle combo, which is what was still showing.
insert into public.cycle_curriculum (category, scope, cycle_id, form_name, content, updated_by)
select 'mitt-combo', 'cycle', cd.id, null,
       '[{"title":"Fall Cycle — from a left-in-front fighting stance","items":[
          "Jab",
          "Slip left",
          "Left hook",
          "Reverse punch",
          "Slip right",
          "Right uppercut"
        ]}]'::jsonb,
       'Race, dictated'
  from public.cycle_data cd where cd.is_active
on conflict (category, cycle_id) where scope = 'cycle'
do update set content = excluded.content, updated_by = excluded.updated_by, updated_at = now();

select cd.name as cycle, cc.category, cc.content -> 0 ->> 'title' as heading,
       cc.content -> 0 -> 'items' as items
  from public.cycle_curriculum cc
  join public.cycle_data cd on cd.id = cc.cycle_id
 where cc.scope='cycle' and cd.is_active
 order by cc.category;
