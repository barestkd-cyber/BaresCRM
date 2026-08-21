-- ===========================================================================
-- A real state machine for automatic charges
-- ---------------------------------------------------------------------------
-- Adversarial review of the first cut found 39 confirmed defects before the
-- engine ever ran, and they were not 39 separate bugs. They were a handful of
-- structural faults repeated:
--
--   * Nothing CLAIMED a row, so two overlapping runs both charged it. Every
--     status write was a blind update keyed only on id, so the loser's decline
--     handler could un-pay a payment that had already succeeded.
--   * 'invoiced' was a dead end no query revisited, so any interruption, or
--     Race pressing "Bill now", froze that membership out of billing forever.
--   * A row that exhausted its retries stayed 'scheduled' at the front of the
--     oldest-first queue, so dead rows ate the per-run cap and silently
--     stopped billing everyone behind them.
--
-- Two new states fix all three. 'charging' is a claim: a row can only enter it
-- from 'scheduled', and only one caller can win that transition. 'failed' is a
-- terminal answer that leaves the queue instead of clogging it.
-- ===========================================================================

alter table public.membership_installments drop constraint if exists membership_installments_status_check;
alter table public.membership_installments add constraint membership_installments_status_check
  check (status in ('scheduled','charging','invoiced','paid','failed','waived','canceled'));

-- Attempt bookkeeping the engine reads to decide backoff and when to give up.
alter table public.membership_installments
  add column if not exists attempts integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text;

-- A run that dies mid-charge leaves a row 'charging'. That is SAFE (nobody
-- else can claim it, so it cannot double charge) but it must be visible, not
-- silent, so the report can surface it and a human can decide.
create index if not exists membership_installments_charging_idx
  on public.membership_installments (last_attempt_at) where status = 'charging';

-- Emergency brake that actually stops: 0 must mean zero, which the old
-- `Number(x) || 25` fallback could never express.
alter table public.settings
  add column if not exists billing_paused boolean not null default false,
  add column if not exists billing_max_back_cycles integer not null default 1;

select pg_get_constraintdef(oid) as statuses from pg_constraint
 where conname = 'membership_installments_status_check';
