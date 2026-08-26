-- Cub and under-5 ranks, dictated by Race 2026-08-26. His word is the source
-- of truth; Spark's ranks were stale and are not consulted.
--
-- Not listed here on purpose:
--   Johnny Kubit, Scottie Jackson - Little Kickers, "no change there"
--   Melody Nannen                 - not mentioned; left at Cub Orange Belt
--   Elora Wingfield               - "cub orange or green, put a note on that";
--                                   rank untouched, note recorded separately
update contacts c
   set rank = v.rank
  from (values
    ('Adonai',    'Arellano',    'Cub Green Belt'),
    ('Aziel',     'Cortes',      'Senior Yellow Belt'),   -- moved up to Juniors
    ('Daniel',    'Ko',          'Cub Green Belt'),
    ('Danny',     'Hardin',      'Cub Red Belt'),
    ('Ezra',      'Lackey',      'Cub Green Belt'),
    ('Gidel',     'Villalobos',  'Cub White Belt'),
    ('Hunter',    'Lerche',      'Cub Green Belt'),
    ('Iliza',     'Randall',     'Cub Purple Belt'),
    ('Scarlett',  'Randall',     'Cub Purple Belt'),
    ('Jessie',    'Bares',       'Cub Yellow Belt'),
    ('Johnny',    'Northcutt',   'Yellow Belt'),          -- Juniors
    ('Kai',       'Oglesby',     'Yellow Belt'),          -- Juniors
    ('Logan',     'Kim',         'Cub Orange Belt'),
    ('Max',       'Eikner',      'Cub Yellow Belt'),
    ('Miles',     'Eikner',      'Cub Green Belt'),
    ('Morgan',    'Mogle',       'Cub Yellow Belt'),
    ('Oliver',    'Allen',       'Cub Orange Belt'),
    ('Samuel',    'Root',        'Senior Yellow Belt'),   -- Juniors
    ('Sunny',     'Bares',       'Cub Red Belt')
  ) as v(first, last, rank)
 where c.first_name = v.first and c.last_name = v.last;

select c.first_name || ' ' || c.last_name as who, c.rank
  from contacts c
 where (c.first_name, c.last_name) in (
   ('Adonai','Arellano'),('Aziel','Cortes'),('Daniel','Ko'),('Danny','Hardin'),
   ('Ezra','Lackey'),('Gidel','Villalobos'),('Hunter','Lerche'),('Iliza','Randall'),
   ('Scarlett','Randall'),('Jessie','Bares'),('Johnny','Northcutt'),('Kai','Oglesby'),
   ('Logan','Kim'),('Max','Eikner'),('Miles','Eikner'),('Morgan','Mogle'),
   ('Oliver','Allen'),('Samuel','Root'),('Sunny','Bares'))
 order by c.first_name;
