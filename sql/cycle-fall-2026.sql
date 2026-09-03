-- ===========================================================================
-- Put the cycle data on the owner's actual rules (CYCLES.md, 2026-09-03).
-- ---------------------------------------------------------------------------
--   * A cycle starts the day of the FIRST CLASS BACK  -> Tue 2026-09-08
--   * A cycle ENDS on awards night                    -> Thu 2026-11-19
--   * Testing sits just before awards                 -> Sat 2026-11-14
--   * Holiday weeks still count                       -> 11 weeks
--
-- Nothing is deleted here. The duplicate cycle is only deactivated and
-- renamed so it is obvious, because deleting a cycle CASCADES to
-- cycle_curriculum and that is not a call to make without being asked.
-- ===========================================================================

-- 1 ─ close out the cycle that just finished. Awards were tonight, not the 1st.
update public.cycle_data
   set is_active = false,
       awards_date = date '2026-09-03',
       following_cycle_begins = date '2026-09-08',
       updated_at = now()
 where name = 'Worlds Cycle 2026';

-- 2 ─ the new cycle, on the real dates.
update public.cycle_data
   set is_active   = true,
       start_date  = date '2026-09-08',
       weeks       = 11,
       awards_date = date '2026-11-19',
       following_cycle_begins = date '2026-11-24',
       -- The belt catalogue spells it Jun-Gun. cycle_curriculum is keyed on
       -- the form NAME, so "Joong-Gun" would find no content at all.
       form_inter  = 'Jun-Gun',
       updated_at  = now()
 where name = 'Fall Cycle 2026';

-- 3 ─ the leftover duplicate: parked, not removed.
update public.cycle_data
   set is_active = false,
       name = 'DUPLICATE - safe to delete (was Winter Cycle 2027)',
       updated_at = now()
 where name = 'Winter Cycle 2027';

select name, start_date::text as starts, awards_date::text as awards, weeks,
       is_active, rotation_half,
       form_beginner || ' / ' || form_inter || ' / ' || form_adv as forms
  from public.cycle_data order by start_date, name;
