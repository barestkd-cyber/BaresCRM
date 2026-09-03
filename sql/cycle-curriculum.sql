-- ===========================================================================
-- Rotating curriculum content, out of the catalogue and into data
-- ---------------------------------------------------------------------------
-- Spec section 7 and 9: a stripe has a PERMANENT identity plus a curriculum
-- SOURCE. Blue always means Kicks; what Kicks currently is depends on the
-- rotation. Today that content is typed into belts.js per belt, so rotating
-- this cycle's self-defense means editing ~20 belts and redeploying, and the
-- same material is duplicated across every rank that teaches it.
--
-- Two rotation sources, so two ways to key a row:
--   scope 'cycle' - school-wide for a 10-week cycle (Red, Purple, Orange, and
--                   Green from Green Belt up). Keyed by cycle_id.
--   scope 'form'  - travels with the form (Kicks, One-Step, Form, and Green
--                   for White..Senior Orange). Keyed by form_name, so when a
--                   form comes back around its material comes back with it.
--
-- Fixed categories (Stances, Blocks, Board Breaking) do not rotate and stay
-- on the belt in the catalogue.
--
-- Nothing here is required: an app that finds no row falls back to the
-- catalogue text, so this fills in gradually instead of in one big bang.
-- ===========================================================================

create table if not exists public.cycle_curriculum (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,                       -- kicks | self-defense | ...
  scope       text not null check (scope in ('cycle','form')),
  cycle_id    uuid references public.cycle_data(id) on delete cascade,
  form_name   text,                                -- for scope 'form'
  content     jsonb not null default '[]'::jsonb,  -- [{title, items:[...]}]
  updated_by  text,
  updated_at  timestamptz not null default now(),
  -- Exactly one key, matching the scope.
  constraint cycle_curriculum_key_matches_scope check (
    (scope = 'cycle' and cycle_id is not null and form_name is null) or
    (scope = 'form'  and form_name is not null and cycle_id is null)
  )
);

create unique index if not exists cycle_curriculum_cycle_key
  on public.cycle_curriculum (category, cycle_id) where scope = 'cycle';
create unique index if not exists cycle_curriculum_form_key
  on public.cycle_curriculum (category, form_name) where scope = 'form';

alter table public.cycle_curriculum enable row level security;

drop policy if exists cycle_curriculum_read on public.cycle_curriculum;
create policy cycle_curriculum_read on public.cycle_curriculum
  for select using (true);   -- families read their own curriculum

drop policy if exists cycle_curriculum_staff on public.cycle_curriculum;
create policy cycle_curriculum_staff on public.cycle_curriculum
  for all using (is_staff()) with check (is_staff());

select 'cycle_curriculum ready' as status,
       (select count(*) from public.cycle_data where is_active) as active_cycles,
       (select coalesce(name,'(unnamed)') from public.cycle_data where is_active limit 1) as active_cycle;
