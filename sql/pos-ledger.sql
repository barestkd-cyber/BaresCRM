-- ============================================================================
-- BaresTKD — POS sales ledger (Stripe plan Phase A1) + two security fixes
-- ----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL editor. Safe to re-run (idempotent).
-- Written against the LIVE schema as verified 2026-08-09:
--   * is_staff() = profiles.role in ('admin','instructor') OR staff_role set
--   * enrollments columns: id, student_id, program, status, started_on,
--     ended_on, created_at
--   * profiles policies: profiles_update_self allows any user to UPDATE
--     their own row — including role/staff_role (fixed by §1 below).
--
-- Contents:
--   §1  SECURITY FIX — block self-promotion via profiles.role/staff_role
--   §2  SECURITY FIX — roster blob readable only when signed in
--   §3  products (real cents-native catalog for POS quick-list)
--   §4  pos_sales / pos_sale_lines / pos_payments / payment_events
--   §5  provenance columns on memberships + enrollments
--   §6  one-active-enrollment guard (partial unique index)
--   §7  RLS for the new tables (Phase A1: staff read AND write; Phase A2
--       will tighten writes to the Edge Function's service role)
-- ============================================================================


-- §1 ─ SECURITY FIX: profiles self-promotion ─────────────────────────────────
-- profiles_update_self USING (id = auth.uid()) lets any logged-in user update
-- their own row. Policies cannot exclude columns, so a member could set
-- role='instructor' or staff_role and pass is_staff() everywhere.
-- Guard trigger: role/staff_role edits through the API require an admin.
-- auth.uid() IS NULL exempts the SQL editor, dashboard and service role, so
-- Race's own admin work is untouched.

create or replace function public.profiles_guard_privileges()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then return new; end if;   -- SQL editor / service role
  if (new.role is distinct from old.role)
     or (new.staff_role is distinct from old.staff_role) then
    if coalesce(get_my_role(), '') <> 'admin' then
      raise exception 'Only an admin can change role or staff_role';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.profiles_guard_privileges();


-- §2 ─ SECURITY FIX: leadership roster blob ──────────────────────────────────
-- Closes the long-open item: the signup blob (names + emails) was readable
-- with the bare anon key. The leadership app only touches roster AFTER
-- sign-in (verified: init() runs from showLeadApp()), so authenticated-only
-- breaks nothing while shutting out anonymous reads.

alter table public.roster enable row level security;

drop policy if exists roster_authenticated_select on public.roster;
create policy roster_authenticated_select on public.roster
  for select using (auth.role() = 'authenticated');

drop policy if exists roster_authenticated_insert on public.roster;
create policy roster_authenticated_insert on public.roster
  for insert with check (auth.role() = 'authenticated');

drop policy if exists roster_authenticated_update on public.roster;
create policy roster_authenticated_update on public.roster
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- §3 ─ products ──────────────────────────────────────────────────────────────
-- A products table ALREADY EXISTS in the live DB (discovered 2026-08-09; it
-- is in no repo schema file): id uuid, name text, price_cents int, sku text
-- null, active bool. Nothing in any app reads it today. We adopt it rather
-- than replace it: keep its column names, add what the POS needs. No drops,
-- so whatever it contains is preserved.

alter table public.products add column if not exists taxable       boolean not null default true;
alter table public.products add column if not exists display_order integer default 100;

-- Seed the POS quick-list items. No unique constraint on sku is assumed
-- (none is known to exist): plain anti-join instead of on-conflict.
insert into public.products (name, price_cents, sku, active, taxable, display_order)
select v.name, v.price_cents, v.sku, true, v.taxable, v.display_order
from (values
  ('Beginner uniform',      8225,  'uniform_beginner', true, 10),
  ('Testing fee',           6000,  'testing_fee',      true, 20),
  ('Sparring gear package', 24250, 'gear_sparring',    true, 30)
) as v(name, price_cents, sku, taxable, display_order)
where not exists (select 1 from public.products p where p.sku = v.sku);


-- §4 ─ the ledger ────────────────────────────────────────────────────────────
-- pos_sales.id is CLIENT-MINTED per tender attempt: a double-tapped tender
-- cannot create two sales (primary-key conflict), and in Phase B the same id
-- becomes the Stripe Idempotency-Key so it cannot create two charges either.

create table if not exists public.pos_sales (
  id                    uuid primary key,
  buyer_contact_id      uuid references public.contacts(id) on delete set null,  -- null = walk-in
  sale_date             date not null,
  staff_email           text not null,
  brand                 text not null default 'btkd'
                          check (brand in ('btkd','gbs','gmaf')),
  tender_method         text
                          check (tender_method is null or tender_method in ('cash','check','card','ach')),
  status                text not null default 'paid'
                          check (status in ('unpaid','pending_payment','processing','paid','failed','abandoned','voided')),
  subtotal_cents        integer not null check (subtotal_cents >= 0),
  discount_cents        integer not null default 0 check (discount_cents >= 0),
  admin_fee_cents       integer not null default 0 check (admin_fee_cents >= 0),
  tax_cents             integer not null default 0 check (tax_cents >= 0),
  total_cents           integer not null check (total_cents >= 0),
  notes                 text,
  stripe_session_id     text unique,
  stripe_payment_intent text unique,
  created_at            timestamptz not null default now(),
  confirmed_at          timestamptz
);
create index if not exists pos_sales_date_idx  on public.pos_sales (sale_date);
create index if not exists pos_sales_buyer_idx on public.pos_sales (buyer_contact_id);

create table if not exists public.pos_sale_lines (
  id                 uuid primary key default gen_random_uuid(),
  sale_id            uuid not null references public.pos_sales(id) on delete cascade,
  kind               text not null check (kind in ('mem','prod','event')),
  label              text not null,
  qty                integer not null default 1 check (qty > 0),
  unit_cents         integer not null,
  discount_cents     integer not null default 0,
  taxable            boolean not null default false,
  line_total_cents   integer not null,
  student_contact_id uuid references public.contacts(id),
  product_id         uuid references public.products(id),
  membership_row     jsonb,
  membership_id      uuid references public.memberships(id)
);
create index if not exists pos_sale_lines_sale_idx on public.pos_sale_lines (sale_id);

-- Append-only. Later money (refund, dispute, ACH return) is a NEW signed row;
-- a sale's net position is a SUM, never an UPDATE, and snapshots never change.
create table if not exists public.pos_payments (
  id               uuid primary key default gen_random_uuid(),
  sale_id          uuid not null references public.pos_sales(id),
  kind             text not null
                     check (kind in ('charge','refund','dispute','dispute_won','ach_return','fee')),
  amount_cents     integer not null,     -- signed: charge positive, refund negative
  stripe_object_id text,
  stripe_event_id  text unique,
  occurred_at      timestamptz not null default now(),
  note             text
);
create index if not exists pos_payments_sale_idx on public.pos_payments (sale_id);

-- Webhook dedupe (used from Phase B). Insert-first; unique violation = seen.
create table if not exists public.payment_events (
  stripe_event_id text primary key,
  type            text not null,
  payload         jsonb not null,
  received_at     timestamptz not null default now(),
  handled_at      timestamptz,
  handle_error    text
);


-- §5 ─ provenance ────────────────────────────────────────────────────────────
-- What did this sale grant, versus what did the person already have?

alter table public.memberships add column if not exists sale_id uuid references public.pos_sales(id);
alter table public.enrollments add column if not exists sale_id uuid references public.pos_sales(id);


-- §6 ─ one ACTIVE enrollment per program ─────────────────────────────────────
-- Partial unique: kills the double-enroll race in the read-then-insert seeding
-- while still allowing history (ended rows) and future re-enrollment.
--
-- If duplicates already exist, CREATE INDEX fails harmlessly with an error.
-- Preview first; if it returns rows, tell Claude and we resolve them:
--   select student_id, program, count(*) from public.enrollments
--   where status = 'active' group by 1,2 having count(*) > 1;

create unique index if not exists enrollments_one_active_uidx
  on public.enrollments (student_id, program)
  where status = 'active';


-- §7 ─ RLS ───────────────────────────────────────────────────────────────────
-- Phase A1: the POS client (staff browser) both reads and writes the ledger.
-- Phase A2 moves writes into the pos-sale Edge Function; the insert policies
-- below get dropped then. payment_events: RLS on, ZERO policies = deny-all to
-- anon/authenticated; the service role bypasses RLS and writes freely.

alter table public.products       enable row level security;
alter table public.pos_sales      enable row level security;
alter table public.pos_sale_lines enable row level security;
alter table public.pos_payments   enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists products_staff_all on public.products;
create policy products_staff_all on public.products
  for all using (is_staff()) with check (is_staff());

drop policy if exists pos_sales_staff_select on public.pos_sales;
create policy pos_sales_staff_select on public.pos_sales
  for select using (is_staff());
drop policy if exists pos_sales_staff_insert on public.pos_sales;
create policy pos_sales_staff_insert on public.pos_sales
  for insert with check (is_staff());
drop policy if exists pos_sales_staff_update on public.pos_sales;
create policy pos_sales_staff_update on public.pos_sales
  for update using (is_staff()) with check (is_staff());

drop policy if exists pos_lines_staff_select on public.pos_sale_lines;
create policy pos_lines_staff_select on public.pos_sale_lines
  for select using (is_staff());
drop policy if exists pos_lines_staff_insert on public.pos_sale_lines;
create policy pos_lines_staff_insert on public.pos_sale_lines
  for insert with check (is_staff());

drop policy if exists pos_pay_staff_select on public.pos_payments;
create policy pos_pay_staff_select on public.pos_payments
  for select using (is_staff());
drop policy if exists pos_pay_staff_insert on public.pos_payments;
create policy pos_pay_staff_insert on public.pos_payments
  for insert with check (is_staff());

-- payment_events: intentionally no policies.


-- ============================================================================
-- ROLLBACK (commented — run only the lines you need)
-- ============================================================================
-- drop trigger if exists profiles_guard_privileges on public.profiles;
-- drop function if exists public.profiles_guard_privileges();
-- drop policy if exists roster_authenticated_select on public.roster;
-- drop policy if exists roster_authenticated_insert on public.roster;
-- drop policy if exists roster_authenticated_update on public.roster;
-- alter table public.roster disable row level security;
-- drop index if exists enrollments_one_active_uidx;
-- alter table public.memberships drop column if exists sale_id;
-- alter table public.enrollments drop column if exists sale_id;
-- drop table if exists public.payment_events;
-- drop table if exists public.pos_payments;
-- drop table if exists public.pos_sale_lines;
-- drop table if exists public.pos_sales;
-- products PRE-EXISTED this file — never drop it wholesale. Undo only our additions:
-- alter table public.products drop column if exists taxable;
-- alter table public.products drop column if exists display_order;
-- delete from public.products where sku in ('uniform_beginner','testing_fee','gear_sparring');
