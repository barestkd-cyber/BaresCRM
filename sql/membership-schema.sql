-- ============================================================================
-- BaresTKD — Household membership pricing schema
-- ----------------------------------------------------------------------------
-- Run this ONCE, by hand, in the Supabase SQL editor (project
-- akdncbzxiwvihfcyijvm) BEFORE using the CRM's Memberships section. The UI
-- reads and writes these five tables and will not function until they exist.
--
-- Order: tables -> RLS -> seed data -> commented rollback (at the bottom).
--
-- MONEY: every monetary column is an INTEGER number of CENTS. Never store
-- dollars or floats. $89.00 is 8900.
--
-- MEMBERSHIPS vs ENROLLMENTS: `memberships` (here) is the BILLING/PRICING
-- record. The existing `enrollments` table is the attendance-roster gate and
-- is deliberately untouched by this file. They are separate concepts; a
-- membership may optionally seed an enrollment row from the app.
-- ============================================================================

-- ─── TABLES ─────────────────────────────────────────────────────────────────

create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'active',
  notes       text,
  created_at  timestamptz default now()
);

-- One household per contact, enforced by unique(contact_id).
create table if not exists household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  added_by      text,
  added_at      timestamptz default now(),
  unique (contact_id)
);

create table if not exists pricing_plans (
  id                          uuid primary key default gen_random_uuid(),
  code                        text unique not null,
  name                        text not null,
  program                     text,
  category                    text not null check (category in ('core_tkd','cubs','specialty','addon','weekly_bundle','other')),
  active                      boolean not null default true,
  billing_frequency           text not null check (billing_frequency in ('monthly','weekly','one_time')),
  recurring_cents             integer,
  down_cents                  integer default 0,
  payment_count               integer,
  pif_cents                   integer,
  family_position             integer,
  supports_household_discount boolean not null default false,
  promo_label                 text,
  description                 text,
  display_order               integer default 100,
  effective_date              date default (now() at time zone 'America/Chicago')::date
);

create table if not exists pricing_settings (
  key         text primary key,
  value_cents integer not null,
  note        text
);

create table if not exists memberships (
  id                     uuid primary key default gen_random_uuid(),
  contact_id             uuid not null references contacts(id) on delete cascade,
  plan_id                uuid references pricing_plans(id),
  plan_code              text not null,
  program                text,
  status                 text not null default 'active' check (status in ('active','paused','canceled','ended','trial','complimentary')),
  billing_frequency      text not null,
  started_on             date not null default (now() at time zone 'America/Chicago')::date,
  ended_on               date,
  base_cents             integer not null,
  down_cents             integer not null default 0,
  adjustments            jsonb not null default '[]',
  final_recurring_cents  integer not null,
  final_down_cents       integer not null default 0,
  explanation            text,
  pricing_version        text,
  recommended_cents      integer,
  override_reason        text,
  override_by            text,
  override_at            timestamptz,
  created_by             text,
  created_at             timestamptz default now()
);

-- Lookup indexes the app relies on (household roll-ups, per-person pricing).
create index if not exists memberships_contact_idx        on memberships (contact_id);
create index if not exists memberships_status_idx         on memberships (status);
create index if not exists household_members_hh_idx       on household_members (household_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- House style: one staff-all policy per table using is_staff().
--
-- ADMIN-ONLY INTENT: pricing_plans and pricing_settings are meant to be
-- ADMIN-ONLY (they set prices for the whole school). There is no is_admin()
-- function in this database yet, so these policies grant all staff access and
-- the APP enforces admin-only at the UI layer (the Pricing subview is hidden
-- unless BTKD.getMyRole() === 'admin'). When an is_admin() function exists,
-- tighten these two policies to use it.

alter table households        enable row level security;
alter table household_members enable row level security;
alter table pricing_plans     enable row level security;
alter table pricing_settings  enable row level security;
alter table memberships       enable row level security;

drop policy if exists households_staff_all on households;
create policy households_staff_all on households for all using (is_staff()) with check (is_staff());

drop policy if exists household_members_staff_all on household_members;
create policy household_members_staff_all on household_members for all using (is_staff()) with check (is_staff());

-- admin-only by intent; see note above
drop policy if exists pricing_plans_staff_all on pricing_plans;
create policy pricing_plans_staff_all on pricing_plans for all using (is_staff()) with check (is_staff());

-- admin-only by intent; see note above
drop policy if exists pricing_settings_staff_all on pricing_settings;
create policy pricing_settings_staff_all on pricing_settings for all using (is_staff()) with check (is_staff());

drop policy if exists memberships_staff_all on memberships;
create policy memberships_staff_all on memberships for all using (is_staff()) with check (is_staff());

-- ─── SEED: pricing_settings ─────────────────────────────────────────────────

insert into pricing_settings (key, value_cents, note) values
  ('household_specialty_discount_cents', 1000, 'Flat monthly discount per qualifying later-joining household member, applied to specialty and add-on memberships'),
  ('weekly_household_discount_cents',       0, 'Household discount for weekly bundles, off by default')
on conflict (key) do nothing;

-- ─── SEED: pricing_plans (the current catalog) ──────────────────────────────
-- promo_label values are DISPLAY TEXT ONLY. Never recompute them.

insert into pricing_plans
  (code, name, program, category, billing_frequency, recurring_cents, down_cents,
   payment_count, pif_cents, family_position, supports_household_discount,
   promo_label, description, display_order)
values
  -- Core TKD — program left null: covers Juniors and Teens/Adults alike.
  ('tkd_pif',               'Taekwondo — Paid in Full',        null, 'core_tkd', 'one_time', null,  0,     null, 140000, null, false, null,       'One payment, full program.',                  10),
  ('tkd_option_b',          'Taekwondo — Option B',            null, 'core_tkd', 'monthly',  9500,  35900, 12,   null,   null, false, null,       'Higher down payment, lowest monthly.',        11),
  ('tkd_option_c',          'Taekwondo — Option C',            null, 'core_tkd', 'monthly',  11000, 25900, 12,   null,   null, false, null,       'Balanced down payment and monthly.',          12),
  ('tkd_option_d',          'Taekwondo — Option D',            null, 'core_tkd', 'monthly',  12900, 12900, 12,   null,   null, false, null,       'Lowest down payment, highest monthly.',       13),
  ('tkd_weekly',            'Taekwondo — Weekly',              null, 'core_tkd', 'weekly',   3395,  0,     null, null,   null, false, null,       'Pay weekly, no contract.',                    14),
  ('tkd_family_second',     'Taekwondo — 2nd family member',   null, 'core_tkd', 'monthly',  11900, 0,     null, null,   2,    false, null,       'Second household member in Taekwondo.',       15),
  ('tkd_family_third_plus', 'Taekwondo — 3rd+ family member',  null, 'core_tkd', 'monthly',  7900,  0,     null, null,   3,    false, null,       'Third and each additional household member.', 16),

  -- Cubs
  ('cubs_weekly',   'Cubs — Weekly',        'Cubs', 'cubs', 'weekly',   2795,  0,     null, null,   null, false, null,        'Pay weekly, no contract.',   20),
  ('cubs_option_a', 'Cubs — Option A',      'Cubs', 'cubs', 'monthly',  10500, 9900,  12,   null,   null, false, '~6% off',   null,                         21),
  ('cubs_option_b', 'Cubs — Option B',      'Cubs', 'cubs', 'monthly',  9000,  19900, 12,   null,   null, false, '~12% off',  null,                         22),
  ('cubs_pif',      'Cubs — Paid in Full',  'Cubs', 'cubs', 'one_time', null,  0,     null, 119200, null, false, '~18% off',  'One payment, full program.', 23),

  -- Specialty, standalone (household discount eligible)
  ('specialty_kickboxing', 'Kickboxing — Standalone',            'Kickboxing',             'specialty', 'monthly',  8900,  0, null, null, null, true,  null, 'Kickboxing only, not a Taekwondo add-on.', 30),
  ('specialty_jiujitsu',   'Jiu Jitsu — Standalone',             'Jiu Jitsu',              'specialty', 'monthly',  8900,  0, null, null, null, true,  null, 'Jiu Jitsu only, not a Taekwondo add-on.',  31),
  ('specialty_both',       'Kickboxing + Jiu Jitsu — Standalone','Kickboxing + Jiu Jitsu', 'specialty', 'monthly',  11900, 0, null, null, null, true,  null, 'Both specialties, no Taekwondo.',          32),
  ('specialty_dropin',     'Specialty — Drop-in',                null,                     'specialty', 'one_time', null,  0, null, 2000, null, false, null, 'Single class. Never counts toward household rank or eligibility.', 33),

  -- Taekwondo member add-ons (require the person to hold active core TKD)
  ('addon_kickboxing', 'Kickboxing — TKD member add-on',            'Kickboxing',             'addon', 'monthly', 4000, 0, null, null, null, true, null, 'Requires an active Taekwondo membership.', 40),
  ('addon_jiujitsu',   'Jiu Jitsu — TKD member add-on',             'Jiu Jitsu',              'addon', 'monthly', 4000, 0, null, null, null, true, null, 'Requires an active Taekwondo membership.', 41),
  ('addon_both',       'Kickboxing + Jiu Jitsu — TKD member add-on','Kickboxing + Jiu Jitsu', 'addon', 'monthly', 6000, 0, null, null, null, true, null, 'Requires an active Taekwondo membership.', 42),

  -- Weekly bundles: COMPLETE weekly price replacing tkd_weekly (3395), not stacked on it.
  ('bundle_tkd_one_specialty',    'Weekly — Taekwondo + one specialty',  null, 'weekly_bundle', 'weekly', 4395, 0, null, null, null, false, null, 'Replaces the weekly Taekwondo price. Requires weekly Taekwondo.',  50),
  ('bundle_tkd_both_specialties', 'Weekly — Taekwondo + both specialties',null, 'weekly_bundle', 'weekly', 4795, 0, null, null, null, false, null, 'Replaces the weekly Taekwondo price. Requires weekly Taekwondo.', 51),

  -- Other
  ('ampd_addon', 'AMP''D — Add-on', 'AMP''D', 'other', 'monthly', 5000, 0, null, null, null, false, null, 'Strength and conditioning add-on.', 60)
on conflict (code) do nothing;

-- ─── ADDENDUM (2026-08-02): local-time date defaults ────────────────────────
-- The tables above already exist in the live database, so the corrected
-- defaults in the create-table blocks never reach it ("if not exists" no-ops).
-- These alters bring the live tables in line. Bare current_date is UTC and
-- rolls to tomorrow's date around 6-7 PM Texas time.
-- Idempotent; affects only future rows that omit the column — no stored data
-- changes. The CRM already passes explicit local dates, so these defaults are
-- safety nets.

alter table pricing_plans alter column effective_date set default (now() at time zone 'America/Chicago')::date;
alter table memberships   alter column started_on     set default (now() at time zone 'America/Chicago')::date;

-- ============================================================================
-- ROLLBACK (commented). Uncomment and run to remove everything this file made.
-- Order matters: memberships and household_members reference the others.
-- WARNING: this destroys billing records. Do not run casually.
-- ============================================================================
-- drop policy if exists memberships_staff_all       on memberships;
-- drop policy if exists pricing_settings_staff_all  on pricing_settings;
-- drop policy if exists pricing_plans_staff_all     on pricing_plans;
-- drop policy if exists household_members_staff_all on household_members;
-- drop policy if exists households_staff_all        on households;
--
-- drop index if exists memberships_contact_idx;
-- drop index if exists memberships_status_idx;
-- drop index if exists household_members_hh_idx;
--
-- drop table if exists memberships;
-- drop table if exists household_members;
-- drop table if exists households;
-- drop table if exists pricing_settings;
-- drop table if exists pricing_plans;
