-- ===========================================================================
-- Who actually pays for a membership
-- ---------------------------------------------------------------------------
-- A membership is filed under the STUDENT, because that is whose place on the
-- mat it is. The card belongs to whoever pays, who for a child is a parent.
-- Rebecca Mohrbach trains; Mike Mohrbach pays. Nothing in the schema said so.
--
-- The charging engine had been inferring the payer from the membership's
-- originating sale, which works for anyone who enrolled through a checkout
-- page and fails silently for everyone migrated by hand: it falls back to the
-- student, finds no card, and records "no saved card" forever.
--
-- Say it explicitly instead. Null keeps the old behaviour, so nothing that
-- works today changes.
-- ===========================================================================

alter table public.memberships
  add column if not exists payer_contact_id uuid references public.contacts(id);

comment on column public.memberships.payer_contact_id is
  'Whose card is charged for this membership. Null means the buyer on the originating sale, then the student.';

create index if not exists memberships_payer_idx on public.memberships (payer_contact_id);

select count(*) as payer_column from information_schema.columns
 where table_schema='public' and table_name='memberships' and column_name='payer_contact_id';
