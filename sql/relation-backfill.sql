-- The Spark export named a Mom column and a Dad column, and the guardian
-- naming pass recorded which of the two each address matched. That answer was
-- thrown away at the time; this puts it back as a tag.
update public.guardians g set relation = 'Mom'
where g.relation is null and exists (
  select 1 from public.guardian_emails e
  where e.guardian_id = g.id and lower(e.email) in (
    'alyciakatelyn22@outlook.com','kandice98@aol.com','jenboitnott@gmail.com',
    'lindsay.louis26@gmail.com','laura_gaines@yahoo.com','kristirmacher@gmail.com',
    'katie.l.wilson2013@gmail.com','mallorysutton94@gmail.com','reneeholly93@gmail.com',
    'dutoitcolette@yahoo.com','kjhardin12@gmail.com','kjullrich11@yahoo.com',
    'billcookefam@yahoo.com','sdkrumrei@aol.com','j.nicole.nannen@gmail.com',
    'svhwhite@gmail.com','tnewsom@emaengineer.com','tbeard_prov31@yahoo.com',
    'm_mogle@icloud.com','ksroot1@hotmail.com','katherine.root@uttyler.edu',
    'tessawingfield8415@gmail.com','ashleymachicekrph@gmail.com','beccaspray@icloud.com',
    'bodifordbreanna@gmail.com','haneenhazimeh91@gmail.com','natalieevalle@yahoo.com',
    'kallen@uttyler.edu'
  ));

update public.guardians g set relation = 'Dad'
where g.relation is null and exists (
  select 1 from public.guardian_emails e
  where e.guardian_id = g.id and lower(e.email) in (
    'clintsellers9@gmail.com','winters.ishaq@gmail.com','david@davewatkins.net',
    'carltonallen89@gmail.com','teaguejust@gmail.com','rrschall2015@gmail.com',
    'mdriggle1006@hotmail.com','tdapple@me.com','sgtapple444@gmail.com',
    'josh.a.nannen@gmail.com','scottrandallric@gmail.com'
  ));

select relation, count(*) from public.guardians group by relation order by 2 desc;
