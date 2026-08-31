-- Owner-dictated belt sizes, 2026-08-31, one per tester on the belt order.
-- Overwrites whatever the field held (mostly heights typed at registration);
-- his spoken size is the truth. Every name verified exactly-one-match first
-- (sql/belt-size-namecheck.sql returned zero problems).
update public.contacts c
   set belt_size = v.s
  from (values
    ('Luther','Allen','2'),('Sophie','Cater','3'),('Tim','Apple','5'),
    ('Aziel','Cortes','0'),('Evelyn','Du Toit','0'),('Samuel','Ortiz','1'),
    ('Samuel','Root','0'),('Lee','Tarry','4'),('Lua','Apple','3'),
    ('Liva','Apple','2'),('John','Cater','0'),('Andrew','Foster','0'),
    ('Isabella','Foster','2'),('Travis','Splinter','6'),('Lincoln','Randall','0'),
    ('Rebecca','Mohrbach','4'),('Miles','Teague','0'),('Wesley','Teague','0'),
    ('Liam','Becze','3'),('Joshua','Nannen','5'),('Henry','Tarry','0'),
    ('Lee ''''Radford''''','Tarry Jr.','1'),('Ian','Wilson','0'),('Owen','Skinner','3'),
    ('Annaleigh','Boitnott','2'),('Cade','Louis','0'),('Patrick','Larano','5'),
    ('Madison','Newsom','4'),('Emmalyn','Boitnott','3'),('Fabian','Cortes','4'),
    ('Zachary','Lackey','5'),('Scott','Randall','4'),('Davis','Fretty','1'),
    ('Wyatt','Osborne','0'),('Victoria','Newsom','3'),('Selah','Gentry','0'),
    ('Arabella','Cortes','0'),('Gavin','Nannen','0'),('Zoey','Osborne','3'),
    ('Savannah','Wilson','1'),('Mason','Soultanov','4')
  ) as v(f, l, s)
 where c.first_name ilike v.f and c.last_name ilike v.l;

select count(*) filter (where belt_size ~ '^[0-9]$') as clean_sizes
  from public.contacts
 where belt_size is not null;
