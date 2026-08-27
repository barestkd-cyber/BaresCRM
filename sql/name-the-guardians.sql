-- Race's names for the guardians the Spark import left blank, 2026-08-26.
-- Adult students who are their own guardian get their own name on the record,
-- which is the pattern he confirmed for Patrick Larano.
update guardians g set name = v.name
  from (values
    ('sirmeliodas699@gmail.com', 'Aden Collins'),      -- "meiodas is aden himself"
    ('smalls8466@gmail.com',     'Isaiah Stillwell'),  -- "that is isaiahs"
    ('westraallen@gmail.com',    'Allen Westra'),
    ('crfretty@gmail.com',       'Casey Fretty'),
    ('elf508@gmail.com',         'Dustin Wilson'),
    ('ttorr12345@gmail.com',     'Taylor Teague'),
    ('w_craig_hughes@yahoo.com', 'Craig Hughes'),      -- Patrick's stepdad, who paid
    ('akashmdr90@gmail.com',     'Akash'),             -- Aidan's dad; surname unknown
    ('jennatransition@gmail.com','Jenna Hernandez'),
    ('cstntyler@gmail.com',      'Chris Thibodeaux'),
    ('ourgoldenlove@gmail.com',  'Rayo Akinsola'),     -- Remi's guardian, tried a class
    ('creidg@hotmail.com',       'Charles George'),
    ('shop3116@gmail.com',       'MK')
  ) as v(email, name)
 where coalesce(nullif(g.name,''),'') = ''
   and exists (select 1 from guardian_emails ge
                where ge.guardian_id = g.id and lower(ge.email) = v.email);

select coalesce(nullif(g.name,''),'(STILL BLANK)') as guardian,
       coalesce((select string_agg(ge.email,',') from guardian_emails ge where ge.guardian_id=g.id),'-') as email,
       coalesce((select string_agg(c.first_name||' '||c.last_name,', ')
                   from student_guardians sg join contacts c on c.id=sg.student_id
                  where sg.guardian_id=g.id),'-') as kids
  from guardians g
 where coalesce(nullif(g.name,''),'') = ''
    or lower(coalesce((select ge.email from guardian_emails ge where ge.guardian_id=g.id limit 1),''))
       in ('katie.l.wilson2013@gmail.com')
 order by 1;
