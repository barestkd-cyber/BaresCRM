-- Race's rank rulings, 2026-08-27, walking the typed-vs-profile list.
--
-- The pattern he identified: several people typed the rank they are TESTING
-- FOR, not the rank they hold. Where he named the current rank, it is set
-- here. Where he was unsure (Victoria) or the profile was already right
-- (Nicolas Cooke, Daniel Ko), nothing moves.
update contacts c
   set rank = v.rank
  from (values
    ('Arabella',  'Cortes',   'Brown Belt'),
    ('Fabian',    'Cortes',   'Orange Belt'),
    ('Emmalyn',   'Boitnott', 'Orange Belt'),
    ('Patrick',   'Larano',   'Yellow Belt'),
    ('Madison',   'Newsom',   'Yellow Belt'),
    ('Annaleigh', 'Boitnott', 'Yellow Belt'),
    ('Elora',     'Wingfield','Cub Green Belt'),   -- settles the "orange or green" note: green
    ('Cade',      'Louis',    'Yellow Belt'),
    ('Gavin',     'Nannen',   'Brown Belt'),
    ('Liam',      'Becze',    'Senior Brown Belt'),
    ('Wesley',    'Teague',   'Senior Blue Belt'),
    ('Miles',     'Teague',   'Senior Blue Belt'),
    ('Joshua',    'Nannen',   'Senior Brown Belt')
  ) as v(first, last, rank)
 where c.first_name = v.first and c.last_name = v.last;

select c.first_name||' '||c.last_name as who, c.rank
  from contacts c
 where (c.first_name, c.last_name) in (
   ('Arabella','Cortes'),('Fabian','Cortes'),('Emmalyn','Boitnott'),
   ('Patrick','Larano'),('Madison','Newsom'),('Annaleigh','Boitnott'),
   ('Elora','Wingfield'),('Cade','Louis'),('Gavin','Nannen'),
   ('Liam','Becze'),('Wesley','Teague'),('Miles','Teague'),
   ('Joshua','Nannen'),('Victoria','Newsom'),('Nicolas','Cooke'),('Daniel','Ko'))
 order by c.last_name, c.first_name;
