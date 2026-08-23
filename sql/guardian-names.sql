-- ===========================================================================
-- Put names on guardian rows, where the address says whose it is
-- ---------------------------------------------------------------------------
-- 123 of 129 guardian rows carried an email and a label but no human name, so
-- every profile showed "(no name)" beside an address. The Spark export has a
-- Mom Name and a Dad Name per student, but says nothing about WHICH parent
-- each email belongs to.
--
-- The first name in the address decides it. A shared surname decides nothing:
-- jenboitnott@ contains "boitnott" for both parents. An address that OPENS
-- with a parent's first name is the strongest signal (jen -> Jennifer, clint
-- -> Clinton); one that merely contains it is weaker but still real
-- (reneeholly93@ -> Holly). A tie writes nothing, because equal resemblance
-- is not evidence and a coin flip puts a father's name on a mother's row.
--
-- Rejected on purpose: "only one parent named, so it must be theirs". Nicolas
-- Cooke's only named parent is Linda and the address on file is
-- billcookefam@ - Bill's. That rule would have written the wrong parent.
--
-- Only rows whose name is currently NULL are touched, and only the name is
-- set. Phone is left alone: the export's Mobile is the household number, and
-- attaching it to one named parent would be the same guess this file refuses
-- to make about the addresses.
--
-- Casing is tidied on the way in: "Neil BOitnott", "ALLEN WESTRA",
-- "Matthew  Foster" all arrive as typed.
-- ===========================================================================

begin;

update public.student_guardians set name = 'Alycia Arellano'
  where id = '66dbb064-f681-4cfc-9aae-d91c273aa29f' and name is null;   -- Adonai Arellano / alyciakatelyn22@outlook.com
update public.student_guardians set name = 'Kandice Foster'
  where id = '4763c9d6-d9a8-48bb-ad8a-c8c196949f4b' and name is null;   -- Andrew Foster / kandice98@aol.com
update public.student_guardians set name = 'Jennifer Boitnott'
  where id = '035dd125-33f4-456e-b8c7-0806f046de9f' and name is null;   -- Annaleigh Boitnott / jenboitnott@gmail.com
update public.student_guardians set name = 'Holly Cortes'
  where id = '12576021-d7c7-40a9-affe-dc3778fa4f1b' and name is null;   -- Arabella Cortes / reneeholly93@gmail.com
update public.student_guardians set name = 'Ishaq Winters'
  where id = 'f934e456-c215-440d-b278-85ff8389eb1b' and name is null;   -- Ayman Winters / winters.ishaq@gmail.com
update public.student_guardians set name = 'Holly Cortes'
  where id = '5b2b3107-aa8e-4c71-907e-f318ffb32f0c' and name is null;   -- Aziel Cortes / reneeholly93@gmail.com
update public.student_guardians set name = 'Colette Toit'
  where id = '9aef4398-e51c-4870-a545-e208f2661367' and name is null;   -- Belle Du Toit / dutoitcolette@yahoo.com
update public.student_guardians set name = 'Clinton Sellers'
  where id = '76427958-e2e5-4d0c-82c2-7ab62e6fe011' and name is null;   -- Brady Sellers / clintsellers9@gmail.com
update public.student_guardians set name = 'Lindsay Louis'
  where id = '0ecd4c44-cec1-4e8b-9ce2-3045cdb2643f' and name is null;   -- Cade Louis / lindsay.louis26@gmail.com
update public.student_guardians set name = 'Laura Ware'
  where id = '3ec921dc-8b1e-4149-a3db-aba11aef6d5f' and name is null;   -- Cody Ware / laura_gaines@yahoo.com
update public.student_guardians set name = 'Kristi Macher'
  where id = '8de0f718-7dcd-4706-84ed-faf4ccc98f22' and name is null;   -- Cooper Macher / kristirmacher@gmail.com
update public.student_guardians set name = 'Dave Watkins'
  where id = '6093a0e4-4610-4b21-8434-bf2ff28af2ec' and name is null;   -- David Watkins / david@davewatkins.net
update public.student_guardians set name = 'Katie Wilson'
  where id = 'd4f8b1ac-2cee-4233-b46b-e00dc3dd331f' and name is null;   -- Dustin Wilson / katie.l.wilson2013@gmail.com
update public.student_guardians set name = 'Jennifer Boitnott'
  where id = '90532904-010a-4016-b601-0a71ef6bca46' and name is null;   -- Emmalyn Boitnott / jenboitnott@gmail.com
update public.student_guardians set name = 'Mallory Sutton'
  where id = 'cf3271f9-3b2a-4ae2-8756-578ea3884041' and name is null;   -- Ezra Lackey / mallorysutton94@gmail.com
update public.student_guardians set name = 'Joshua Nannen'
  where id = '4e4e1b4d-525f-4641-8f94-94da4a077f1c' and name is null;   -- Gavin Nannen / josh.a.nannen@gmail.com
update public.student_guardians set name = 'Jessica Enriquez'
  where id = 'bd84fa31-1434-4787-9173-9e30cc594dd4' and name is null;   -- Gidel Villalobos / jessicaenriquez983@gmail.com
update public.student_guardians set name = 'Lindsay Tarry'
  where id = '511859fd-8cd4-4acb-867c-ce571ec17745' and name is null;   -- Henry Tarry / lindsaytarry@gmail.com
update public.student_guardians set name = 'Robynne Lerche'
  where id = '59cd14b6-7bdd-4d5b-b02a-ebcb2bc2d372' and name is null;   -- Hunter Lerche / robynnebouwer@gmail.com
update public.student_guardians set name = 'Katie Wilson'
  where id = 'f6f1ba1b-9d3d-4d7e-b464-21870841b27a' and name is null;   -- Ian Wilson / katie.l.wilson2013@gmail.com
update public.student_guardians set name = 'Kandice Foster'
  where id = '1e457353-a6c4-4cbd-ae44-adedd629cdf0' and name is null;   -- Isabella Foster / kandice98@aol.com
update public.student_guardians set name = 'Maranda Cater'
  where id = 'f71273d4-21fa-47e3-99d5-e34062f0b761' and name is null;   -- John Cater / maranda.cater@yahoo.com
update public.student_guardians set name = 'Annie Northcutt'
  where id = 'e036e7b3-d4e6-4c97-9cb9-858326df345f' and name is null;   -- Johnny Northcutt / annie.ullrich@gmail.com
update public.student_guardians set name = 'Colette Toit'
  where id = '59561066-7684-4679-90a9-e2da706c8bd1' and name is null;   -- June Du Toit / dutoitcolette@yahoo.com
update public.student_guardians set name = 'Makayla Johnson'
  where id = '5e3005ac-d371-46b5-bb84-f7cd337f74e3' and name is null;   -- Kai Oglesby / makaylafaithdreams@gmail.com
update public.student_guardians set name = 'Jennifer Smith'
  where id = '259cdd15-c375-4e7d-9a4a-d427abc134ce' and name is null;   -- Kaleb Smith / jenniferab1101@yahoo.com
update public.student_guardians set name = 'Lindsay Tarry'
  where id = '83ae86a6-0e1f-4962-8d9d-ad1a109981b1' and name is null;   -- Lee ''Radford'' Tarry Jr. / lindsaytarry@gmail.com
update public.student_guardians set name = 'Katelyn Becze'
  where id = '34c372d9-ec8c-4b45-b838-1ed6ab589364' and name is null;   -- Liam Becze / katelyn.becze@gmail.com
update public.student_guardians set name = 'Joshua Nannen'
  where id = '8a0f2d78-1b68-4043-adc9-25143beb8c43' and name is null;   -- Liam Nannen / josh.a.nannen@gmail.com
update public.student_guardians set name = 'Scott Randall'
  where id = '763fd00e-0627-4e41-bdcb-5bcf62bab33a' and name is null;   -- Lincoln Randall / scottrandallric@gmail.com
update public.student_guardians set name = 'Carlton Allen'
  where id = '8c865ce4-0bdc-4cdb-b035-8dac40140180' and name is null;   -- Luther Allen / carltonallen89@gmail.com
update public.student_guardians set name = 'Zinnour Soultanov'
  where id = '7cf1a2f7-9b59-4235-b922-c2c44c214a45' and name is null;   -- Mason Soultanov / zinnour@yahoo.com
update public.student_guardians set name = 'Charles George'
  where id = '66bf1e2b-dedc-4cb2-a1ad-fbece0ec0be1' and name is null;   -- Matthew George / chashince05@yahoo.com
update public.student_guardians set name = 'Thomas Eikner'
  where id = '3d16eaaa-394b-445b-93e2-bfa565c81e23' and name is null;   -- Max Eikner / thom.eikner@gmail.com
update public.student_guardians set name = 'Thomas Eikner'
  where id = '527962e3-98cb-4c41-9f15-33cd73a3fcd0' and name is null;   -- Miles Eikner / thom.eikner@gmail.com
update public.student_guardians set name = 'Colette Toit'
  where id = '1102fc4a-d330-4c57-aaef-deccb6e0891d' and name is null;   -- Noah Du Toit / dutoitcolette@yahoo.com
update public.student_guardians set name = 'Ray Allen'
  where id = '3d22558b-fd0f-4b1a-87b0-4ccbb0b03c02' and name is null;   -- Oliver Allen / ray.t.all3n@gmail.com
update public.student_guardians set name = 'Brittnee Allen'
  where id = '32e29b93-d9ce-4922-9d62-29276c045669' and name is null;   -- Oliver Allen / brittnee.moore6@icloud.com
update public.student_guardians set name = 'Aubrey Skinner'
  where id = 'bc73a6a8-e399-4b87-94dd-f5bf1daf27c6' and name is null;   -- Owen Skinner / aubskinner@gmail.com
update public.student_guardians set name = 'Amie Giebel'
  where id = 'f0373445-fc26-4032-ac81-de0b20ffbea6' and name is null;   -- Parker Giebel / amiegiebel@gmail.com
update public.student_guardians set name = 'Hermes Ortiz'
  where id = '1c7cf6c8-6c6c-4cf0-bae4-f97c3c53f5b8' and name is null;   -- Samuel Ortiz / hermes.ortiz@aol.com
update public.student_guardians set name = 'Katie Root'
  where id = '1c493120-72cd-485e-9874-2a8731022165' and name is null;   -- Samuel Root / katherine.root@uttyler.edu
update public.student_guardians set name = 'Shelley Melton'
  where id = 'cc6e8afb-88c1-4f7d-8991-2e5ffd04c5aa' and name is null;   -- William Melton / shelley_denise04@yahoo.com
update public.student_guardians set name = 'Colette Toit'
  where id = '579d62a5-2653-428a-813b-04461edd7363' and name is null;   -- Witten DuToit / dutoitcolette@yahoo.com
update public.student_guardians set name = 'Kayla Osborne'
  where id = '56ef03ce-ada6-47fe-a019-79f01e4bd070' and name is null;   -- Wyatt Osborne / kayla_osborne@outlook.com
update public.student_guardians set name = 'Kayla Osborne'
  where id = '8c891953-48eb-4704-b387-01fdf7da5aa2' and name is null;   -- Zoey Osborne / kayla_osborne@outlook.com

commit;

select count(*) as guardian_rows,
       count(*) filter (where name is not null and name <> '') as with_name
from public.student_guardians;
