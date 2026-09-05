-- ===========================================================================
-- A record of every rank change, so promoting is undoable.
-- ---------------------------------------------------------------------------
-- Promotion writes contacts.rank and contacts.rank_date. Without a trail there
-- is no way back from a misclick across 60 students, and no way to answer
-- "when did they get this belt" beyond the current rank_date.
--
-- kind: 'promote'   - moved up at a testing
--       'correct'   - the stored rank was wrong and was fixed
--       'undo'      - a previous row was rolled back
-- ===========================================================================
create table if not exists public.rank_promotions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.contacts(id) on delete cascade,
  rank_from    text,
  rank_to      text not null,
  kind         text not null default 'promote',
  testing_date date,
  applied_by   text,
  created_at   timestamptz not null default now()
);

create index if not exists rank_promotions_student_idx
  on public.rank_promotions (student_id, created_at desc);

alter table public.rank_promotions enable row level security;
drop policy if exists rank_promotions_staff on public.rank_promotions;
create policy rank_promotions_staff on public.rank_promotions
  for all using (is_staff()) with check (is_staff());
-- A family may read their own student's history, never write it.
drop policy if exists rank_promotions_parent_read on public.rank_promotions;
create policy rank_promotions_parent_read on public.rank_promotions
  for select using (student_id in (select my_student_ids()));

select 'rank_promotions ready' as status,
       (select count(*) from public.contacts where rank_date is not null) as with_rank_date;
