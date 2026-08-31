-- Owner, 2026-08-31 (belt order corrections): Owen Skinner is currently
-- Senior Brown, Rebecca Mohrbach is currently Senior Purple. Guarded.
update public.contacts set rank = 'Senior Brown Belt'
 where id = '81eef582-d1a3-49c6-a0f9-f431a4a1071e' and rank = 'Brown Belt';
update public.contacts set rank = 'Senior Purple Belt'
 where id = '42efb2ce-24a3-424e-b60f-2bf144dcfbc4' and rank = 'Purple Belt';
select first_name || ' ' || last_name as who, rank from public.contacts
 where id in ('81eef582-d1a3-49c6-a0f9-f431a4a1071e','42efb2ce-24a3-424e-b60f-2bf144dcfbc4');
