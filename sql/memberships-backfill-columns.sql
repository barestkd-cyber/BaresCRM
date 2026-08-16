-- ============================================================================
-- BaresTKD — repair: memberships was missing its pricing-snapshot columns
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Safe to re-run.
--
-- WHY THIS EXISTS: the live `memberships` table pre-dated
-- sql/membership-schema.sql. That file opens with `create table if not
-- exists`, which found the table already there and did NOTHING - so every
-- column the file added afterwards was never created.
--
-- The damage was invisible until something actually wrote a membership:
--   "Could not find the 'adjustments' column of 'memberships' in the schema
--   cache"
-- That broke the Little Kickers checkout AND the POS membership sale, which
-- had simply never been run against this database before.
--
-- All columns are added NULLABLE (the schema file marks several NOT NULL) so
-- this cannot fail against rows that already exist. The app always writes
-- them, so nothing depends on a database-side default.
-- ============================================================================

alter table public.memberships add column if not exists plan_code             text;
alter table public.memberships add column if not exists program               text;
alter table public.memberships add column if not exists billing_frequency     text;
alter table public.memberships add column if not exists ended_on              date;
alter table public.memberships add column if not exists base_cents            integer;
alter table public.memberships add column if not exists adjustments           jsonb not null default '[]'::jsonb;
alter table public.memberships add column if not exists final_recurring_cents integer;
alter table public.memberships add column if not exists final_down_cents      integer default 0;
alter table public.memberships add column if not exists explanation           text;
alter table public.memberships add column if not exists pricing_version       text;
alter table public.memberships add column if not exists recommended_cents     integer;
alter table public.memberships add column if not exists payment_count         integer;
alter table public.memberships add column if not exists created_by            text;
alter table public.memberships add column if not exists override_reason       text;
alter table public.memberships add column if not exists override_by           text;
alter table public.memberships add column if not exists override_at           timestamptz;

-- PostgREST caches the schema; without this the API keeps reporting the
-- columns as missing until its cache happens to expire.
notify pgrst, 'reload schema';

-- Verify: 23 columns expected.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'memberships'
order by ordinal_position;

-- ─── NO ROLLBACK ────────────────────────────────────────────────────────────
-- Dropping these would break every membership write. If a column here is
-- genuinely unwanted, remove its writer in the app first.
