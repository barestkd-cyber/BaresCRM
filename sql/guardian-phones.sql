-- ===========================================================================
-- Give every phone number a guardian
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-23: "associate the phone number with a guardian. Each
-- guardian doesn't have to have a phone number, but each number needs a
-- guardian."
--
-- The Spark backfill put the export's Mobile column into contacts.phone for 92
-- students. That column is the household number, so 87 MINORS ended up
-- carrying a parent's mobile as their own. Same mistake the email column made,
-- and this one was mine to make.
--
-- WHICH GUARDIAN: the Spark row pairs a Mobile with an Email and both belong
-- to the same adult, so the number goes to whoever owns that row's address.
-- Nothing is guessed - a row whose address resolves to no guardian is left
-- alone and listed at the end of the generator's output.
--
-- Numbers are APPENDED to whatever the guardian already has, deduplicated, so
-- a number added by hand since is not overwritten.
--
-- Then the number comes off the child, minors only. An adult's own phone is
-- their own phone: Betsy Thrash, Tim Apple and the rest keep theirs, and so
-- does any teenager who gave the studio their own number rather than a
-- parent's. The old value is kept in a tag, as the email clear-out did.
-- ===========================================================================

begin;

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '27babd8a-8d3b-401b-b007-02ded0060bdb'
    union select unnest(array['8189157426'])
  ) t where p is not null and p <> ''
)
where id = '27babd8a-8d3b-401b-b007-02ded0060bdb';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'c4c2b408-97df-46b9-95f6-32055c29aa31'
    union select unnest(array['9034260782'])
  ) t where p is not null and p <> ''
)
where id = 'c4c2b408-97df-46b9-95f6-32055c29aa31';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '6cde7916-3522-434d-b750-aae5b0aafbdd'
    union select unnest(array['3345240949'])
  ) t where p is not null and p <> ''
)
where id = '6cde7916-3522-434d-b750-aae5b0aafbdd';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'ba7b3d87-2055-4ed2-b175-0e3527895356'
    union select unnest(array['9032386139'])
  ) t where p is not null and p <> ''
)
where id = 'ba7b3d87-2055-4ed2-b175-0e3527895356';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '068b164e-f0da-48ce-ab33-be8a8b1b766e'
    union select unnest(array['9037482934'])
  ) t where p is not null and p <> ''
)
where id = '068b164e-f0da-48ce-ab33-be8a8b1b766e';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'e72120ce-1a08-468f-8ee6-be597a867186'
    union select unnest(array['9033434543'])
  ) t where p is not null and p <> ''
)
where id = 'e72120ce-1a08-468f-8ee6-be597a867186';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '13d8f0f6-2fbf-45d1-933c-ce43e0875684'
    union select unnest(array['7704015688'])
  ) t where p is not null and p <> ''
)
where id = '13d8f0f6-2fbf-45d1-933c-ce43e0875684';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '5f443c4b-33fa-4be1-ba4b-1a8541b9e119'
    union select unnest(array['7604032246'])
  ) t where p is not null and p <> ''
)
where id = '5f443c4b-33fa-4be1-ba4b-1a8541b9e119';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'b40c6b81-073a-41df-b075-79e63dd5f552'
    union select unnest(array['9039207848'])
  ) t where p is not null and p <> ''
)
where id = 'b40c6b81-073a-41df-b075-79e63dd5f552';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '347f6563-cb81-4547-a524-48a061e92564'
    union select unnest(array['19033637573'])
  ) t where p is not null and p <> ''
)
where id = '347f6563-cb81-4547-a524-48a061e92564';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'e4497889-5133-4609-a6b6-e5e96e2fd641'
    union select unnest(array['3187309243'])
  ) t where p is not null and p <> ''
)
where id = 'e4497889-5133-4609-a6b6-e5e96e2fd641';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '76285d82-140e-4776-ac38-25d17fee70f8'
    union select unnest(array['7179770205'])
  ) t where p is not null and p <> ''
)
where id = '76285d82-140e-4776-ac38-25d17fee70f8';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '45dab2aa-4e90-4f84-9774-1cd9313f12c9'
    union select unnest(array['9034239609'])
  ) t where p is not null and p <> ''
)
where id = '45dab2aa-4e90-4f84-9774-1cd9313f12c9';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'c0a4e3bd-4f8f-40ef-b165-2eb2a2ab5edc'
    union select unnest(array['9033604912'])
  ) t where p is not null and p <> ''
)
where id = 'c0a4e3bd-4f8f-40ef-b165-2eb2a2ab5edc';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'd22ff004-8a6b-425e-bcdf-8bb114bbf95f'
    union select unnest(array['5058704902'])
  ) t where p is not null and p <> ''
)
where id = 'd22ff004-8a6b-425e-bcdf-8bb114bbf95f';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '14cffd58-295e-4f43-aac5-d485c9b570b6'
    union select unnest(array['8149336517'])
  ) t where p is not null and p <> ''
)
where id = '14cffd58-295e-4f43-aac5-d485c9b570b6';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'efff9745-fe5b-4181-8838-8827ee3c6edd'
    union select unnest(array['2149094101'])
  ) t where p is not null and p <> ''
)
where id = 'efff9745-fe5b-4181-8838-8827ee3c6edd';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '5e917efe-8c64-4194-863c-acafaba0cbd3'
    union select unnest(array['2106161213'])
  ) t where p is not null and p <> ''
)
where id = '5e917efe-8c64-4194-863c-acafaba0cbd3';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '0093097b-3fe4-4f22-ad04-31ad7d775c74'
    union select unnest(array['5125421756'])
  ) t where p is not null and p <> ''
)
where id = '0093097b-3fe4-4f22-ad04-31ad7d775c74';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '3441dc20-9faf-4f44-9099-aa74fa9fe73f'
    union select unnest(array['9037055651'])
  ) t where p is not null and p <> ''
)
where id = '3441dc20-9faf-4f44-9099-aa74fa9fe73f';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '1fe18dd1-26bd-4a20-8b9b-4164084e81e8'
    union select unnest(array['9722158857', '9728396564'])
  ) t where p is not null and p <> ''
)
where id = '1fe18dd1-26bd-4a20-8b9b-4164084e81e8';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'c08ac296-ec43-4a15-9fee-3c920cec10be'
    union select unnest(array['9039875469'])
  ) t where p is not null and p <> ''
)
where id = 'c08ac296-ec43-4a15-9fee-3c920cec10be';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '757e2294-0274-4f8a-bca8-601000897f56'
    union select unnest(array['2147636106'])
  ) t where p is not null and p <> ''
)
where id = '757e2294-0274-4f8a-bca8-601000897f56';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '628f2ce6-a182-40b1-90b4-0de16f753f44'
    union select unnest(array['9032831834'])
  ) t where p is not null and p <> ''
)
where id = '628f2ce6-a182-40b1-90b4-0de16f753f44';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'f7265ab0-31a6-4c81-b256-d4e93e414fdd'
    union select unnest(array['9035213290'])
  ) t where p is not null and p <> ''
)
where id = 'f7265ab0-31a6-4c81-b256-d4e93e414fdd';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '599f2bd1-e8f3-4fa8-8034-432d280020ab'
    union select unnest(array['4304441510'])
  ) t where p is not null and p <> ''
)
where id = '599f2bd1-e8f3-4fa8-8034-432d280020ab';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '0b41ccb8-0a49-475a-8e00-aca2e7288eab'
    union select unnest(array['9037215446'])
  ) t where p is not null and p <> ''
)
where id = '0b41ccb8-0a49-475a-8e00-aca2e7288eab';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '68dd956a-4a01-45a4-9f91-4399988cd944'
    union select unnest(array['9032844838'])
  ) t where p is not null and p <> ''
)
where id = '68dd956a-4a01-45a4-9f91-4399988cd944';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'b7875213-7b99-401b-91cd-adb575bc65b1'
    union select unnest(array['9032450289'])
  ) t where p is not null and p <> ''
)
where id = 'b7875213-7b99-401b-91cd-adb575bc65b1';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '50ac6da8-38a0-45b1-a3ea-3f4a846f6f0a'
    union select unnest(array['3186171953'])
  ) t where p is not null and p <> ''
)
where id = '50ac6da8-38a0-45b1-a3ea-3f4a846f6f0a';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'fc8dd985-7fa4-4fa0-b004-fd8d8893f2bc'
    union select unnest(array['9032830561'])
  ) t where p is not null and p <> ''
)
where id = 'fc8dd985-7fa4-4fa0-b004-fd8d8893f2bc';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '18366147-60ba-4a99-8131-4a9ceb50a2ed'
    union select unnest(array['6504553048'])
  ) t where p is not null and p <> ''
)
where id = '18366147-60ba-4a99-8131-4a9ceb50a2ed';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '6300313b-eff6-42dc-b8e4-21aad2e2f8db'
    union select unnest(array['9035390513'])
  ) t where p is not null and p <> ''
)
where id = '6300313b-eff6-42dc-b8e4-21aad2e2f8db';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '94bd546a-636a-4067-a282-286ecee855d4'
    union select unnest(array['9037475744'])
  ) t where p is not null and p <> ''
)
where id = '94bd546a-636a-4067-a282-286ecee855d4';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '775da13a-f3f0-466c-a201-fae08598e239'
    union select unnest(array['9033632007'])
  ) t where p is not null and p <> ''
)
where id = '775da13a-f3f0-466c-a201-fae08598e239';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'ccedae73-f761-484a-a938-ad187c2744ce'
    union select unnest(array['2102752594'])
  ) t where p is not null and p <> ''
)
where id = 'ccedae73-f761-484a-a938-ad187c2744ce';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'ddcd27ab-3ba9-4eee-8f92-05139f814e8d'
    union select unnest(array['8177341019'])
  ) t where p is not null and p <> ''
)
where id = 'ddcd27ab-3ba9-4eee-8f92-05139f814e8d';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'fc4b8bd1-67cc-40d2-b565-bf9ee9e65ddf'
    union select unnest(array['8178793882'])
  ) t where p is not null and p <> ''
)
where id = 'fc4b8bd1-67cc-40d2-b565-bf9ee9e65ddf';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '26bb2f9b-49c7-43ca-a92a-47b1d0403d36'
    union select unnest(array['9035301145'])
  ) t where p is not null and p <> ''
)
where id = '26bb2f9b-49c7-43ca-a92a-47b1d0403d36';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '7e1f566b-130e-4235-9c6b-954acc2b2d56'
    union select unnest(array['4692269298'])
  ) t where p is not null and p <> ''
)
where id = '7e1f566b-130e-4235-9c6b-954acc2b2d56';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '0b7e3b69-4218-4867-b0ce-b2e05db07611'
    union select unnest(array['9037523195'])
  ) t where p is not null and p <> ''
)
where id = '0b7e3b69-4218-4867-b0ce-b2e05db07611';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'd04e035e-fcd6-4f51-bef3-f436082bd648'
    union select unnest(array['2242012002'])
  ) t where p is not null and p <> ''
)
where id = 'd04e035e-fcd6-4f51-bef3-f436082bd648';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '50dba0d0-c7d7-4f3f-9d7f-d59decd69cd5'
    union select unnest(array['9032458633'])
  ) t where p is not null and p <> ''
)
where id = '50dba0d0-c7d7-4f3f-9d7f-d59decd69cd5';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '8e761b2b-66f6-43b7-a81b-75eedbce43b1'
    union select unnest(array['9032581328'])
  ) t where p is not null and p <> ''
)
where id = '8e761b2b-66f6-43b7-a81b-75eedbce43b1';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '4f2f0259-f453-4bcf-b651-573972d56eae'
    union select unnest(array['4303440229'])
  ) t where p is not null and p <> ''
)
where id = '4f2f0259-f453-4bcf-b651-573972d56eae';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '231d6123-5c5b-4b49-89da-dbb1e9423c8f'
    union select unnest(array['5125019967'])
  ) t where p is not null and p <> ''
)
where id = '231d6123-5c5b-4b49-89da-dbb1e9423c8f';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '2f11bed7-58a1-4271-ae65-1c294e74bb5f'
    union select unnest(array['9363329661'])
  ) t where p is not null and p <> ''
)
where id = '2f11bed7-58a1-4271-ae65-1c294e74bb5f';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '11cda416-c7a2-474b-beea-66f9583dd419'
    union select unnest(array['5863810186'])
  ) t where p is not null and p <> ''
)
where id = '11cda416-c7a2-474b-beea-66f9583dd419';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '54f3bb8f-52a2-4a2d-be81-6a3133e77a57'
    union select unnest(array['9039048118'])
  ) t where p is not null and p <> ''
)
where id = '54f3bb8f-52a2-4a2d-be81-6a3133e77a57';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'a8e0aebb-da56-4a01-94bb-00c0d2985fc1'
    union select unnest(array['9033129735'])
  ) t where p is not null and p <> ''
)
where id = 'a8e0aebb-da56-4a01-94bb-00c0d2985fc1';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '2df079a5-0c0c-4a3a-9d4a-ec99e8b34336'
    union select unnest(array['19039202266'])
  ) t where p is not null and p <> ''
)
where id = '2df079a5-0c0c-4a3a-9d4a-ec99e8b34336';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '81bbe3a1-01dd-4408-8e00-7830075a3120'
    union select unnest(array['9035219884'])
  ) t where p is not null and p <> ''
)
where id = '81bbe3a1-01dd-4408-8e00-7830075a3120';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'd3c219f9-964b-4826-a7e5-3f143a229289'
    union select unnest(array['3185780896'])
  ) t where p is not null and p <> ''
)
where id = 'd3c219f9-964b-4826-a7e5-3f143a229289';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '7e419b77-a413-4447-a8df-b4b00ea2dfc6'
    union select unnest(array['9039446174'])
  ) t where p is not null and p <> ''
)
where id = '7e419b77-a413-4447-a8df-b4b00ea2dfc6';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'b707e583-0867-42f3-bd9a-a0e4bbc72af7'
    union select unnest(array['9039522250'])
  ) t where p is not null and p <> ''
)
where id = 'b707e583-0867-42f3-bd9a-a0e4bbc72af7';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'dc66c443-9927-408e-af69-70aaf986a03b'
    union select unnest(array['9035305441'])
  ) t where p is not null and p <> ''
)
where id = 'dc66c443-9927-408e-af69-70aaf986a03b';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'c6030d5f-fdef-4e24-a87d-5dce388d5c5f'
    union select unnest(array['9036038510'])
  ) t where p is not null and p <> ''
)
where id = 'c6030d5f-fdef-4e24-a87d-5dce388d5c5f';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'c2544655-3b8d-456f-bb2d-99e4c0384602'
    union select unnest(array['9037383295'])
  ) t where p is not null and p <> ''
)
where id = 'c2544655-3b8d-456f-bb2d-99e4c0384602';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '4db2bb85-2b26-44e1-bd1f-566c2832d655'
    union select unnest(array['9033301510'])
  ) t where p is not null and p <> ''
)
where id = '4db2bb85-2b26-44e1-bd1f-566c2832d655';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'cac82d9a-7e59-4cf6-9635-2eb9ab90f01b'
    union select unnest(array['9037059424'])
  ) t where p is not null and p <> ''
)
where id = 'cac82d9a-7e59-4cf6-9635-2eb9ab90f01b';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '1d910ede-9119-4cc2-908e-5566c5a3ac97'
    union select unnest(array['9038063033'])
  ) t where p is not null and p <> ''
)
where id = '1d910ede-9119-4cc2-908e-5566c5a3ac97';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'f011ff1b-b041-4f14-b8af-4ed44c7bbb88'
    union select unnest(array['9035396357'])
  ) t where p is not null and p <> ''
)
where id = 'f011ff1b-b041-4f14-b8af-4ed44c7bbb88';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '587235ba-3742-4e83-8f73-ee12a47f7856'
    union select unnest(array['9728396564'])
  ) t where p is not null and p <> ''
)
where id = '587235ba-3742-4e83-8f73-ee12a47f7856';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'a9a00c16-4d98-4b49-91c9-9add48ec8bc5'
    union select unnest(array['9033160965'])
  ) t where p is not null and p <> ''
)
where id = 'a9a00c16-4d98-4b49-91c9-9add48ec8bc5';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'fcdc1989-3a3c-42da-99d3-d26b3f716b1c'
    union select unnest(array['9032626608'])
  ) t where p is not null and p <> ''
)
where id = 'fcdc1989-3a3c-42da-99d3-d26b3f716b1c';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = 'afd35ba0-cd15-4da8-8a03-16880a9f8fe1'
    union select unnest(array['9035218332'])
  ) t where p is not null and p <> ''
)
where id = 'afd35ba0-cd15-4da8-8a03-16880a9f8fe1';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '90f9706a-7e9b-4d1b-a0be-d0537a857825'
    union select unnest(array['9032453632'])
  ) t where p is not null and p <> ''
)
where id = '90f9706a-7e9b-4d1b-a0be-d0537a857825';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '4849067b-55a7-4c25-809b-a4683d0054dc'
    union select unnest(array['2145371400'])
  ) t where p is not null and p <> ''
)
where id = '4849067b-55a7-4c25-809b-a4683d0054dc';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '44724f51-5874-4213-b1d1-3cbfe8ec026a'
    union select unnest(array['9035210694'])
  ) t where p is not null and p <> ''
)
where id = '44724f51-5874-4213-b1d1-3cbfe8ec026a';

update public.guardians set phones = (
  select coalesce(array_agg(distinct p), '{}') from (
    select unnest(phones) as p from public.guardians where id = '412d4c60-7b71-447f-b5a9-cad758766ec5'
    union select unnest(array['9035087369'])
  ) t where p is not null and p <> ''
)
where id = '412d4c60-7b71-447f-b5a9-cad758766ec5';

-- and off the children
update public.contacts c
set phone = null,
    tags = array_remove(coalesce(c.tags, '{}'), 'phone-was-a-guardians')
           || array['phone-was-a-guardians: ' || c.phone]
where c.phone is not null
  and c.dob is not null
  and date_part('year', age(c.dob)) < 18
  and exists (
    select 1 from public.student_guardians sg
    join public.guardians g on g.id = sg.guardian_id
    where sg.student_id = c.id and c.phone = any(g.phones)
  );

commit;

select (select count(*) from public.guardians where array_length(phones,1) > 0) as guardians_with_a_phone,
       (select count(*) from public.contacts c where c.phone is not null
          and c.dob is not null and date_part('year', age(c.dob)) < 18) as minors_still_holding_one;
