-- Read-only: which of the 12 cash testers exist as contacts (any segment),
-- matched on space-and-case-insensitive full name.
with want(n, shown) as (values
  ('jessiebares','Jessie Bares'),('sunnybares','Sunny Bares'),
  ('scarlettrandall','Scarlett Randall'),('ilizarandall','Iliza Randall'),
  ('scottrandall','Scott Randall'),('lincolnrandall','Lincoln Randall'),
  ('evelyndutoit','Evelyn Du Toit'),('junedutoit','June Du Toit'),
  ('belledutoit','Belle Du Toit'),('noahdutoit','Noah Du Toit'),
  ('wittendutoit','Witten Du Toit'),('kalebsmith','Kaleb Smith')
)
select w.shown, count(c.id) as hits,
       coalesce(min(c.id::text),'') as contact_id,
       coalesce(min(c.rank),'') as rank,
       coalesce(min(c.segment::text),'') as segment
  from want w
  left join public.contacts c
    on regexp_replace(lower(c.first_name || c.last_name), '[^a-z]', '', 'g') = w.n
 group by w.shown
 order by hits, w.shown;
