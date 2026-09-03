-- Is rank_date actually populated? It decides whether a certificate can just
-- read the profile, or needs a fallback.
select count(*) filter (where segment in ('active','trial'))            as active_students,
       count(*) filter (where segment in ('active','trial') and rank_date is not null) as have_rank_date,
       count(*) filter (where segment in ('active','trial') and coalesce(rank,'') <> '') as have_rank,
       (select count(*) from public.testing_sessions)                    as saved_testings,
       (select count(*) from public.testing_history)                     as history_rows
  from public.contacts;
