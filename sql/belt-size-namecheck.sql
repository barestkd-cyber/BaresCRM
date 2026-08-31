-- Read-only: every dictated name must match exactly ONE contact before the
-- size write. Anything not equal to 1 is listed.
with v(f, l) as (values
  ('Luther','Allen'),('Sophie','Cater'),('Tim','Apple'),('Aziel','Cortes'),
  ('Evelyn','Du Toit'),('Samuel','Ortiz'),('Samuel','Root'),('Lee','Tarry'),
  ('Lua','Apple'),('Liva','Apple'),('John','Cater'),('Andrew','Foster'),
  ('Isabella','Foster'),('Travis','Splinter'),('Lincoln','Randall'),
  ('Rebecca','Mohrbach'),('Miles','Teague'),('Wesley','Teague'),
  ('Liam','Becze'),('Joshua','Nannen'),('Henry','Tarry'),
  ('Lee ''''Radford''''','Tarry Jr.'),('Ian','Wilson'),('Owen','Skinner'),
  ('Annaleigh','Boitnott'),('Cade','Louis'),('Patrick','Larano'),
  ('Madison','Newsom'),('Emmalyn','Boitnott'),('Fabian','Cortes'),
  ('Zachary','Lackey'),('Scott','Randall'),('Davis','Fretty'),
  ('Wyatt','Osborne'),('Victoria','Newsom'),('Selah','Gentry'),
  ('Arabella','Cortes'),('Gavin','Nannen'),('Zoey','Osborne'),
  ('Savannah','Wilson'),('Mason','Soultanov')
)
select v.f || ' ' || v.l as dictated, count(c.id) as matches
  from v left join public.contacts c
    on c.first_name ilike v.f and c.last_name ilike v.l
 group by v.f, v.l
having count(c.id) <> 1
 order by 1;
