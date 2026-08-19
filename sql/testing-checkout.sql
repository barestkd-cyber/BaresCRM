-- ===========================================================================
-- Belt-testing checkout: fee ladder + signup provenance
-- ---------------------------------------------------------------------------
-- `testing_dates` and `testing_signups` already existed in the live database
-- (empty, referenced by no code, and with no schema file anywhere in either
-- repo). Their shape was right, so this file adopts them rather than building
-- something parallel, and records them for the first time.
--
-- NOTE the ECOSYSTEM §19 gotcha: `create table if not exists` silently skips a
-- table that already exists, including every column added to the file later.
-- Both tables are pre-existing, so every column below is an explicit
-- `alter table ... add column if not exists`.
--
-- FEE LADDER (owner, 2026-08-19). The parent DECLARES their family position;
-- it is never computed from a household lookup, because a public page has no
-- login, and Race explicitly wants a parent who tested one child last month to
-- come back and check out as second at $50 without a first in the same cart:
--
--   position 1  -> that student's program rate: Cubs $50, everyone else $60
--   position 2  -> $50
--   position 3  -> $30
--   position 4+ -> $10 each, "4th and each additional"
--
-- Position 1 follows the program of whoever the parent puts first, so a family
-- that puts a Cubs student first pays $50 for that seat. Owner's call.
--
-- Run:  supabase db query --linked -f sql/testing-checkout.sql
-- ===========================================================================

-- 1 ─ the ladder lives in settings, not in code -----------------------------
-- Same pattern as admin_fee_bps: Race can change a price without a deploy.
-- Written as update-then-insert so it is idempotent whether or not
-- pricing_settings.key carries a unique constraint.

update public.pricing_settings p
   set value_cents = v.value_cents
  from (values
    ('testing_fee_cubs_cents',     5000),
    ('testing_fee_standard_cents', 6000),
    ('testing_fee_2nd_cents',      5000),
    ('testing_fee_3rd_cents',      3000),
    ('testing_fee_addl_cents',     1000)
  ) as v(key, value_cents)
 where p.key = v.key;

insert into public.pricing_settings (key, value_cents)
select v.key, v.value_cents
  from (values
    ('testing_fee_cubs_cents',     5000),
    ('testing_fee_standard_cents', 6000),
    ('testing_fee_2nd_cents',      5000),
    ('testing_fee_3rd_cents',      3000),
    ('testing_fee_addl_cents',     1000)
  ) as v(key, value_cents)
 where not exists (select 1 from public.pricing_settings p where p.key = v.key);

-- 2 ─ signup rows carry what the sale froze ---------------------------------
-- contact_id stays NULLABLE on purpose. The page cannot reliably identify an
-- existing student from a typed name, and inventing a contact per signup would
-- fill the roster with duplicates of people who are already members. The typed
-- name is recorded and Race reconciles; matching can be added later without a
-- migration.

alter table public.testing_signups
  add column if not exists sale_id uuid references public.pos_sales(id),
  add column if not exists program text,
  add column if not exists belt_size text,
  add column if not exists family_position integer,
  add column if not exists fee_cents integer;

comment on column public.testing_signups.family_position is
  'Declared by the parent at checkout (1,2,3,4+), never derived from households.';
comment on column public.testing_signups.fee_cents is
  'Frozen amount charged for this seat. Never recompute from current settings.';

create index if not exists testing_signups_date_idx
  on public.testing_signups (testing_date_id, created_at desc);
create index if not exists testing_signups_sale_idx
  on public.testing_signups (sale_id);

-- 3 ─ the event itself -------------------------------------------------------
-- `public_from` is the gate: the website advertises a testing only on or after
-- that date, so opening signups is a data change and not a deploy, exactly as
-- program_sessions.status works for Little Kickers.

create index if not exists testing_dates_public_idx
  on public.testing_dates (public_from, test_date);

-- 4 ─ verify -----------------------------------------------------------------
select (select count(*) from public.pricing_settings
         where key like 'testing_fee%') as ladder_keys,
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='testing_signups'
           and column_name in ('sale_id','program','belt_size','family_position','fee_cents')
       ) as signup_columns_added;
