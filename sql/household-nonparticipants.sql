-- ===========================================================================
-- A household member who does not train
-- ---------------------------------------------------------------------------
-- Owner, 2026-08-23: "it would be a HOUSEHOLD MEMBER but not a participant
-- with separate contact and I should be able to add it from CRM."
--
-- His model, stated earlier: a household is everything under one roof - all
-- the participants, and "grandma and grandpa could be on there, and uncle who
-- sometimes pays for testing."
--
-- household_members pointed only at contacts, so putting grandmother in one
-- meant making her a participant. That is the thing he refused: 99 guardians
-- against 141 contacts, and no appetite for a member list full of people who
-- have never stepped on the mat.
--
-- So a membership row now points at EITHER a contact or a guardian, never
-- both and never neither. The guardian record already is a person with their
-- own name, addresses, phones and card - it needed no new columns to become
-- somebody who lives in a house.
-- ===========================================================================

alter table public.household_members
  add column if not exists guardian_id uuid references public.guardians(id) on delete cascade;

alter table public.household_members
  alter column contact_id drop not null;

-- exactly one of the two, or the row means nothing
alter table public.household_members
  drop constraint if exists household_members_one_person;
alter table public.household_members
  add constraint household_members_one_person
  check ((contact_id is not null) <> (guardian_id is not null));

create unique index if not exists household_members_guardian_idx
  on public.household_members (household_id, guardian_id) where guardian_id is not null;

select (select count(*) from household_members where contact_id is not null) as participants,
       (select count(*) from household_members where guardian_id is not null) as others;
