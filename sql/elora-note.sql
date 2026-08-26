-- Race, 2026-08-26: "Elora is a cub orange or green, put a note on that."
-- Rank left as-is (Cub Orange Belt) until he confirms.
insert into contact_notes (id, contact_id, body, created_by, created_at)
select gen_random_uuid(), c.id,
       'Rank needs confirming: Cub Orange or Cub Green. Left at Cub Orange until confirmed.',
       'race@barestkd.fit', now()
  from contacts c
 where c.first_name = 'Elora' and c.last_name = 'Wingfield';

select c.first_name || ' ' || c.last_name as who, c.rank, n.body
  from contacts c join contact_notes n on n.contact_id = c.id
 where c.first_name = 'Elora' and c.last_name = 'Wingfield'
 order by n.created_at desc limit 1;
