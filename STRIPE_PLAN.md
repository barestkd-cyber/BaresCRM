# BaresCRM POS + Stripe — Final Plan

## 1. The honest answer first

**Yes, the POS can go live with Stripe. But not with memberships first, and not in one step.**

The blocking problem is not Stripe. It is that a POS sale currently produces no durable record at all. `posTender` (BaresCRM/index.html:1948-2037) writes exactly two things — `memberships` snapshots (:1981) and `enrollments` rows (:2012). A product-only or event-only sale writes **literally nothing**: the $242 gear package, the $60 testing fee, the sales tax, the discount, the admin fee, the tender method and the staff name all evaporate when the success screen renders. There is no `sales`, `invoices`, `payments` or `transactions` table anywhere in the system. So a Stripe session, payment intent, refund or payout has nothing in the CRM to point at.

**What "live" means for Phase 1 — narrower than you may expect, and deliberately so.**

Phase 1 Stripe covers **non-membership sales only**: testing fees, uniforms, gear, event/camp fees, private lessons, drop-ins. Staff builds the invoice as today, presses Card or Bank, the buyer pays a one-time hosted Stripe checkout, and a signature-verified webhook records the money. No membership snapshot, no enrollment row, no Spark overlap.

**Why memberships are excluded from Phase 1.** If month 1 goes through Stripe while months 2+ stay on Spark, every new signup requires *two* payment setups — Stripe's ACH mandate does not transfer to Spark, so you would ask the same parent for their bank details twice, at the desk, on the highest-frequency operation in the building. That is strictly more work than today. Worse, it puts every new member in *both* systems simultaneously, which is the hardest possible starting position for a later cutover. Memberships should move to Stripe **once, together with recurring billing**, as a clean cohort boundary: existing members stay 100% Spark and shrink; new members go 100% Stripe from day one.

**Rough effort**, working sessions, not calendar time:

| Phase | What | Sessions |
|---|---|---|
| A1 | Sale ledger, products table, cents-native totals — no Stripe | 1–2 |
| A2 | Move the write path server-side into an Edge Function | 2–3 |
| B | Stripe sandbox, non-membership one-time payments | 2–3 |
| C | Go live | 1 |
| D | Recurring + memberships (the actual Spark replacement) | Its own design conversation — larger than A+B+C combined |
| E | Dual pricing / cash discount | 1, but gated on an attorney and may not survive review |

Your longest-lead item is Stripe account verification, which is entirely outside my control. Start it today, during Phase A.

---

## 2. What only you can do, in order, starting today

**Claude must never see, request, or embed your Stripe secret key or webhook signing secret.** Those go into Supabase Edge Function secrets, placed by you, following the existing `RESEND_API_KEY` precedent (barestkd-site/supabase/functions/trial-booking/index.ts:534). Every app repo here is published to GitHub Pages — a committed secret is public from the moment of push.

**Today (does not block on anything):**

1. **Create the Stripe account and start business verification / KYC.** This is the long pole. Note: after activating a live account, the business origin country can never be changed.
2. **Verify a user cannot UPDATE their own `profiles.role`.** This gates everything else. `is_staff()` reads `profiles.role`, every staff RLS policy depends on it, and portal/shared/auth.js:113-118 does a best-effort self-upsert into `profiles` including a role, with a code comment claiming RLS makes it a no-op. That claim is a comment, not a verified policy. If self-promotion to admin works, the whole security model falls once money is behind it.
3. **Read the live definitions of `is_staff()`, `my_student_ids()` and `is_email_allowed` out of Supabase** and send them to me so they can be committed to BaresCRM/sql/ as versioned files. Grep finds only call sites (membership-schema.sql:112,115,119,123,126; calendar-schema.sql:23) — the function bodies exist nowhere in the repo. Confirm `is_staff()` is SECURITY DEFINER, STABLE, with EXECUTE granted to role `authenticated`.
4. **Confirm the live `enrollments` DDL** — exact column names and the status values actually in use. There is no enrollments SQL file anywhere in BaresCRM/sql/, yet all four check-in surfaces assume `status = 'active'` (BaresCRM/index.html:804, checkin.html:179, leadership-signup/checkin-kiosk.html:214, curriculum/index.html:3256).
5. **Verify and fix the `roster` SELECT policy** — the leadership-signup item open since June. It holds no payment data, but it is the one place the load-bearing claim "RLS is the real wall" has never actually been tested, and that claim underpins this entire design.

**This week:**

6. **Run the Phase A1 SQL** I deliver, in the SQL editor for project akdncbzxiwvihfcyijvm. Nothing is deployed until you confirm it ran.
7. **Confirm the seeded product prices** in the new `products` table are correct — they are currently hardcoded float dollars at BaresCRM/index.html:1622-1626.
8. **Ask your accountant** three questions before the first live taxable sale (see §6). At minimum: is a testing fee taxable at all? The POS currently taxes anything with `kind==='prod'` (index.html:2068), and "Testing fee" is in the PRODUCTS array (index.html:1624) — so a service is currently being taxed at 8.25%.

**Before Phase B:**

9. `supabase link --project-ref akdncbzxiwvihfcyijvm` inside the BaresCRM repo (one time), then `supabase functions deploy pos-sale` — **with** JWT verification, deliberately *not* the `--no-verify-jwt` used by trial-booking (index.ts:17).
10. **Set the account statement descriptor** and public support email, phone, address, website. Parents see only the first 16 alphanumeric characters on a bank statement; a vague descriptor is a documented dispute driver.
11. **Enable "US bank account" (ACH Direct Debit)** in Stripe payment method settings; check eligibility for T+2 faster settlement.
12. **Create a restricted Stripe test key** (Checkout Sessions write, PaymentIntents read, Customers write) and place `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` into Supabase secrets yourself.
13. **Register the test webhook endpoint** and select: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `refund.created`, `refund.updated`, `charge.dispute.created`, `charge.dispute.closed`, `charge.dispute.funds_reinstated`. Test mode and live mode have **different** signing secrets.
14. **Deploy `stripe-webhook` with `--no-verify-jwt`** — Stripe cannot present a Supabase JWT; the signature is the entire auth model.
15. **Run the sandbox failure tests yourself** with the ACH test accounts (000222222227 insufficient funds, 000555555559 dispute, 000000000009 stuck processing), using a `barestkd+test_email@gmail.com`-style address — Stripe sends no sandbox mandate or microdeposit emails without the `+test_email` form.

---

## 3. The decisions you must make

### 3.1 Are memberships in the first Stripe release? — **No. Reversible.**

Recommend: Stripe Phase 1 covers testing fees, uniforms, gear, events, private lessons. Memberships join Stripe when recurring does. The alternative — memberships on Stripe now — costs a second payment setup per signup and puts every new member in two systems at once. If you want membership down-payments on Stripe sooner anyway, say so; it is a sequencing choice, not an architectural one, but you would be paying that double-entry tax on every new student until Phase D.

### 3.2 Is the membership row written before checkout, or only on confirmation? — **Only on confirmation. Expensive to reverse; getting it right now matters.**

When memberships do reach Stripe (Phase D), at tender the server writes the sale rows and stores the frozen quote verbatim as JSON on the sale line. No `memberships` row exists until payment confirms. Reasons, in order of weight:

- `memberships.status` has a CHECK constraint with no pending value (BaresCRM/sql/membership-schema.sql:70). A pending row needs a migration *and* every future consumer permanently learning that state.
- `isQualifying` (BaresCRM/pricing.js:122) requires status exactly `'active'`, so a pending row is invisible to household ranking anyway — it buys nothing.
- The freeze-at-quote-time principle is fully preserved: `buildMembershipSnapshot` (pricing.js:413-446) is a pure function returning a plain row object. Store it; the webhook does a dumb insert.
- It keeps "every row in `memberships` is a sale that actually happened" true forever.

### 3.3 Does enrollment (check-in access) follow immediately, or wait for payment? — **On `checkout.session.completed`. Reversible cheaply.**

Not at tender: a closed browser tab would equal free training forever, and ECOSYSTEM.md:721 forbids inventing check-in bypasses. Not at ACH settlement: ACH is T+4, so a Monday signup could not train until the following Monday — staff would sell cards instead, defeating the "prefer ACH" preference.

**One critical implementation rule, and it is a deliberate divergence from Stripe's published sample:** for ACH, `checkout.session.completed` arrives with `payment_status = 'unpaid'`, and Stripe's own reference fulfillment function gates on `payment_status != 'unpaid'`. Anyone following that sample will silently *not* enroll ACH buyers. We enroll on `completed` **regardless of `payment_status`**, and treat `async_payment_succeeded` / `async_payment_failed` as money-ledger events only. This gets its own commented rule and its own sandbox test.

### 3.4 The fee model / dual pricing — **Defer past go-live. Fully reversible. May not survive legal review.**

Phase 1 charges one posted price to everyone regardless of payment method. This is the most important judgement call in the plan: you can be live on Stripe weeks before you have a legal opinion, and the fee model is an additive change to one totals function later.

When it does land, the shape is **a discount, never a fee** — nothing labelled surcharge, service fee, convenience fee or card fee, in the UI, on a receipt, or in a column name. Tex. Bus. & Com. Code §604A.001 excludes "a discounted price charged… to a buyer who pays with cash" from the surcharge definition, and 15 U.S.C. §1666f protects cash discounts *if* offered to all prospective buyers and disclosed clearly and conspicuously.

**But I have to flag two problems with it honestly, and they may kill it:**

- The §604A.001 exclusion says **cash**. It does not say ACH and it does not say check. Extending the discount to ACH is standard industry practice but is a textual extension of the statute.
- Under hosted Checkout you **cannot know card funding type before authorization** — the buyer picks their instrument on Stripe's page. So a discount extended to cash/check/ACH but not cards necessarily charges *debit* users more than non-card users, with no mechanism to avoid it. §604A.002 (the debit prohibition) was never part of the Rowell litigation and carries no injunction.

Real cost deltas at Stripe list rates: $139 plan → card ~$4.33 vs ACH ~$1.11 (delta ~$3.22); $119 → ~$2.80; $79 → ~$1.96. A single flat discount must stay under ~$1.96 or it exceeds the actual saving on the cheapest plan. Flat cents, never a percentage — a percentage tracking card cost is a surcharge in substance regardless of label.

**Do not use Stripe's surcharging features.** `automatic_surcharge` for Checkout is private preview, requires a paid third-party app (Yeeld or InterPayments), is `payment` mode only so it can never cover recurring, is Payment Element only so it is unavailable on the hosted page — and Stripe disclaims 100% of the compliance liability.

**Regardless of all the above, one thing happens in Phase A1:** delete BaresCRM/index.html:1454-1457. It computes `items*0.0315 + 0.55` and renders it as a line literally labelled **"Card surcharge."** That is 3.15% + $0.55 — above the Visa 3% cap, above cost of acceptance on every plan, applied regardless of funding type so it would hit debit, and never transmitted to the network in Field 28. It lives in the checkout-pages prototype, not the live tender path, but it is user-facing language and it is the most concrete compliance liability in the repository. Also delete the mock card form at :1417-1422 (raw "Card number / Expiry / CVC" inputs under a "powered by Stripe" badge on a BaresTKD origin — the single most likely path to accidental PCI scope) and the "Card on file" copy at :1470, which contradicts the locked never-store-card-data decision.

### 3.5 Recurring: Stripe Subscriptions or a self-driven charge loop? — **Decide now, build in Phase D. Hard to reverse.**

This shapes Phase B's Customer and mandate handling, so it cannot wait. Recommend **Stripe Billing**. At ~0.7% of billing volume (roughly $125/mo on $18k of monthly memberships) it buys the schedule, dunning, smart retries and failed-payment emails you would otherwise build and then personally chase. The self-driven alternative avoids the Billing fee but puts retries, proration and dunning on you.

One hard constraint already known: **Stripe subscription status cannot be the check-in gate.** With ACH a subscription goes straight to `active` and *stays* `active` after the first payment fails — Stripe voids the invoice instead. The gate must be a BaresTKD-side field driven by invoice events.

### 3.6 Split tender — **Support it. The schema decision is now or never.**

"Here's $150 cash, put the rest on the card" is routine on a $400 mixed invoice. **`tender_method` must not live on the sale header.** It belongs on the payment row, and paid-ness is derived as `SUM(pos_payments.amount_cents) >= pos_sales.total_cents`. This costs nothing now and is a migration later. This is the one schema change I would insist on before any SQL is run.

### 3.7 Charge-to-account — **Add an `open` status, or remove the button.**

Today the button exists (index.html:1677) and writes nothing. Under the new model, the only status a non-Stripe tender could land in is `paid`, which would book money never received. Add `'open'` to the status set and derive a real per-contact balance from open sales minus the ledger. That is also the smallest honest step toward accounts receivable available inside Phase A.

### 3.8 First live transaction — **A $60 testing fee or a uniform. Trivially reversible.**

Exercises Checkout, the webhook, the ledger, the return page and the refund path end to end with a $60 blast radius and no student's roster access at risk.

---

## 4. Recommended architecture

### Components

- **BaresCRM/index.html** — POS client, unchanged hosting. Its job shrinks: build the cart, quote for display, send **intent**.
- **BaresCRM/pricing.js** — still the single pricing brain. **Extended**: the invoice arithmetic moves *into* it as `BTKDPricing.invoiceTotals()` (line net, per-line discount, pro-rata invoice-discount allocation, per-line tax, admin fee, grand total), all integer cents, round-half-up, applied per line and once for tax. `posTotals()` becomes a pure display formatter over it. This matters: today the client computes tax as `+(taxBase*rate).toFixed(2)` on float dollars (index.html:2051), and a server working in integer cents disagrees at ordinary amounts — a $6.00 taxable line gives client $0.49 vs server $0.50; $130.00 gives $10.72 vs $10.73; same at $134, $138, $142, $146, $194, $202, $210. One implementation, one rounding rule, exact-equality comparison, no tolerance.
- **BaresCRM/supabase/functions/_shared/pricing.js** — byte-identical copy, plus a `PRICING_HASH` constant the client sends and the server checks per request. A test asserting byte-equality is documentation if nobody runs it (there are no GitHub Actions anywhere in this ecosystem; tests are run by hand). The request-time hash check fails loudly instead of silently.
- **BaresCRM/supabase/functions/pos-sale/index.ts** — POS-facing. Deployed **with** JWT verification. CORS locked to `https://crm.barestkd.fit`, returning 403 on a non-allowed Origin (not trial-booking's permissive echo fallback at index.ts:38-49, which serves the request anyway). Treat CORS as defence in depth; it never stops curl.
- **BaresCRM/supabase/functions/stripe-webhook/index.ts** — Stripe-facing. `--no-verify-jwt`, no CORS.

**Repo placement: BaresCRM, not barestkd-site.** barestkd-site is the only currently-linked repo, but re-linking is a 30-second command. Co-locating with `pricing.js`, `sql/` and `tests/` is worth more, because the single largest correctness risk here is pricing logic drifting between client and server — exactly the problem that already makes `WAIVER_TEXT` fragile (trial-booking/index.ts:33 must be kept byte-identical with trial.js:36 by hand, with nothing enforcing it).

### Data model — all amounts `integer` cents

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique, label text not null,
  amount_cents integer not null check (amount_cents >= 0),
  taxable boolean not null default true,
  active boolean not null default true,
  display_order integer default 100
);

-- id is minted when the cart's FIRST LINE is added (cart identity, not
-- attempt identity) and reused for every tender attempt on that cart.
create table pos_sales (
  id uuid primary key,
  buyer_contact_id uuid references contacts(id) on delete set null, -- null = walk-in
  sale_date date not null,
  staff_email text not null,            -- from the VERIFIED JWT, never the body
  status text not null default 'pending_payment'
    check (status in ('open','pending_payment','processing','paid',
                      'partially_paid','failed','abandoned','voided')),
  currency text not null default 'usd',
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  admin_fee_cents integer not null default 0,
  tax_cents integer not null,
  total_cents integer not null,
  agreement_version text, agreed_name text, agreed_at timestamptz,
  notes text,
  stripe_session_id text unique, stripe_payment_intent text unique,
  created_at timestamptz not null default now(), confirmed_at timestamptz
);
-- NOTE: no tender_method column. It lives on pos_payments.

create table pos_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references pos_sales(id) on delete cascade,
  kind text not null check (kind in ('mem','prod','event')),
  label text not null, qty integer not null default 1,
  unit_cents integer not null,
  line_discount_cents integer not null default 0,
  alloc_invoice_discount_cents integer not null default 0,  -- pro rata
  taxable boolean not null default false,
  tax_cents integer not null default 0,                     -- per line
  line_total_cents integer not null,
  income_category text,                                     -- POS already collects it
  student_contact_id uuid references contacts(id),
  product_id uuid references products(id),
  membership_row jsonb,                                     -- SERVER-built snapshot
  membership_id uuid references memberships(id)
);

-- Append-only money ledger. Uniqueness is on the Stripe OBJECT id, not the
-- event id, so a second charge.refunded carrying a CUMULATIVE amount_refunded
-- cannot be double-counted.
create table pos_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references pos_sales(id),
  kind text not null check (kind in ('charge','refund','dispute',
                                     'dispute_won','ach_return','fee')),
  tender_method text not null check (tender_method in
                                     ('cash','check','card','ach','account')),
  amount_cents integer not null,        -- signed: charge +, refund/dispute -
  currency text not null default 'usd',
  stripe_object_id text unique,         -- charge / refund / dispute id
  stripe_event_id text,
  stripe_charge_id text, stripe_balance_transaction_id text,
  gross_cents integer, fee_cents integer, net_cents integer,
  available_on date,
  stripe_mandate_id text, stripe_payment_method_id text,
  mandate_accepted_at timestamptz, mandate_text_version text,
  occurred_at timestamptz not null default now(), note text
);

create table payment_events (
  stripe_event_id text primary key, type text not null,
  payload jsonb not null, received_at timestamptz not null default now(),
  handled_at timestamptz, handle_error text
);

alter table memberships  add column sale_id uuid references pos_sales(id);
alter table memberships  add column sale_line_id uuid unique
                         references pos_sale_lines(id);
alter table enrollments  add column sale_id uuid references pos_sales(id);
create unique index enrollments_student_program_uidx
  on enrollments (student_id, program);   -- CONFIRM live column names first
```

RLS: staff may **look**; only the Edge Functions (service role, which bypasses RLS) may write. `payment_events` gets RLS with **zero policies** — deny-all to anon and authenticated, fully writable by service role.

`memberships` gains two columns and **no new status value**. The CHECK at membership-schema.sql:70 stays untouched. `pos_sales.status` is the workflow state machine; `memberships.status` remains a lifecycle field only.

### The trust boundary, stated honestly per field

The slogan "the client sends intent, the server sends money" is true only for the parts the server can re-derive. The POS has five money inputs it cannot: `posSale.discount` and `posSale.adminFee` (staff-typed, index.html:2191-2205) and per-line `amount`/`qty`/`discVal`/`taxable` (index.html:2179-2190). Pretending otherwise means the 409 check becomes tautological, or ad-hoc discounts get silently removed as a feature.

- **Authoritative** (server re-derives; client value ignored): membership base/recurring/down cents from `pricing_plans`, product `unit_cents` from `products`, tax rate, and all arithmetic.
- **Negotiated** (client supplies; server validates and clamps): qty (1..N), per-line discount (≤ line gross), invoice discount (clamped to `[0, subtotal]`), admin fee (≤ configured max), taxable override, membership override (audited, `override_by` from the verified JWT, `override_at` from the server clock; overrides >25% below recommended require `role='admin'`).

The 409 fires only when an **authoritative** component disagrees — and it returns the server's fresh quote in the body so the POS can render a one-tap diff ("Price changed: $139 → $145. Accept and continue / Cancel") with the cart intact. The realistic trigger is a stale lobby tab after a morning price edit, not tampering; dumping a built invoice mid-sale in front of a customer is the wrong response to the most likely case.

### End-to-end flow

**Cash / check (Phase A2):** client POSTs `{sale_id, tender_method, buyer_contact_id, sale_date, lines[intent], negotiated fields, client_quoted_total_cents, pricing_hash}` with the staff access token → function calls `auth.getUser()`, then `rpc('is_staff')` on the *caller's* client and requires `true` → reads `pricing_plans`, `pricing_settings`, `products` and the household's `memberships` **once**, up front, and prices every line against that single in-memory context (mirroring `POS_STUDENT_CTX` at index.html:1742-1750 — re-reading between lines would mis-price sibling 2 and fire a spurious 409) → clamps negotiated fields → computes totals → compares to `client_quoted_total_cents` → inserts `pos_sales` (`paid`) + lines + one `pos_payments` charge row. Client renders success from the **response**, not its own arithmetic.

**Card / ACH (Phase B):** same through totals, then inserts `pos_sales` as `pending_payment`, creates a Checkout Session (`mode:'payment'`, `client_reference_id: sale_id`, `expires_at: now+30min` — Stripe's documented minimum, not the 24h default, `Idempotency-Key: sale_id + ':' + attempt_n`), and returns `{ok:true, checkout_url}`.

Three changes from the earlier draft, all consequential:

- **No `setup_future_usage`.** Banking an ACH mandate on a checkout the buyer is told is one-time is the sharpest legal exposure in this plan. A Nacha WEB one-time authorization does not become a recurring authorization by being stored, and Reg E 1005.10(b) requires preauthorized recurring EFTs to be separately authorized in writing with amount, frequency and revocation method. The recurring mandate gets collected properly in Phase D as its own consented step.
- **Do not force `verification_method:'instant'`.** Instant-only means a parent types their online banking username and password into a page on your lobby tablet, and if their credit union is not covered by Financial Connections there is *no fallback* — the sale dead-ends. Allow Stripe's default (instant with microdeposit fallback), and **render the checkout URL as a QR code** (or text the link) so the parent completes it on their own phone. That removes the credentials-on-the-school-tablet objection entirely.
- **A repeat POST for an existing `sale_id` returns the existing session or status** rather than inserting. A double-tap becomes a no-op; a back-button becomes a resume; a declined card gets a **Retry payment** button that creates a new session against the existing sale row (`attempt_n+1`), plus a "Take as cash/check instead" action. Without this, a decline destroys the cart (`window.location.href` navigates the tab away, and cart drafts are deliberately not persisted) and staff rebuilds a multi-line invoice by hand in front of the customer.

**Webhook:** `await req.text()` **first** (copying trial-booking's immediate `await req.json()` at index.ts:293 silently breaks verification — the easiest fatal copy-paste in this job), verify with `constructEventAsync(raw, sig, secret, undefined, Stripe.createSubtleCryptoProvider())` (the synchronous `constructEvent` does not work under Deno), do not widen the 5-minute tolerance, re-fetch the object from Stripe by id rather than trusting the payload.

**Idempotency by WORK, not by RECEIPT** — this is the fix for the most dangerous bug in the earlier draft. Insert the `payment_events` row; on unique violation, **select it and short-circuit only if `handled_at IS NOT NULL`** — otherwise redo the work. Set `handled_at` in the same transaction as the membership/enrollment/ledger writes, or not at all. On failure, write `handle_error` and return 500 so Stripe keeps retrying. The naive version ("return 200 on unique violation") loses payments permanently: first delivery inserts the event, the write throws, the retry sees the unique violation and 200s, Stripe stops retrying — money captured, nothing in the CRM, and the "Unfinished sales" view then invites staff to Void a sale that was actually paid. (Correspondingly: the Void button is blocked unless the function has re-fetched the session from Stripe and confirmed `status=expired` with `payment_status=unpaid`.)

**Access vs money, separated at the event level:**

| Event | Access | Money |
|---|---|---|
| `checkout.session.completed`, card, `payment_status=paid` | grant | charge row, status `paid` |
| `checkout.session.completed`, ACH, `payment_status=unpaid` | **grant** | **no charge row**, status `processing` |
| `async_payment_succeeded` | — | charge row, status `paid` |
| `async_payment_failed` | untouched | reversal row if a charge exists; status `failed`; Needs Attention |
| `refund.created` / `refund.updated` | untouched | signed row keyed on **refund id** |
| `charge.dispute.created` | untouched | debit row keyed on dispute id |
| `charge.dispute.closed` (lost) | untouched | **no second debit** |
| `charge.dispute.funds_reinstated` | untouched | credit row |

Writing the charge row on `completed` for ACH would book positive revenue for money that has not moved, on the majority of sales, for at least four business days — and permanently on failures. The return page reads `pos_sales.status` and says "Payment submitted — confirming with the bank" for `processing`, never "$X paid." It polls, never treats the return URL as proof of payment, and has an explicit terminal state after timeout ("check Stripe, do not re-tender") rather than a spinner or a false success.

**Reversals never touch the snapshot.** `memberships` columns split into **write-once** (plan_code, plan_id, billing_frequency, base_cents, down_cents, adjustments, final_*_cents, recommended_cents, pricing_version, override_*) and **mutable lifecycle** (status, ended_on) — recorded in ECOSYSTEM.md. A $139/mo snapshot reads $139/mo forever; net position is a SUM over the ledger. The webhook **never auto-revokes enrollment** on a refund, dispute or ACH return — it flags into a "Needs attention" queue and a human clicks. And that queue **emails you via Resend** (already wired at trial-booking index.ts:534); you are teaching, not refreshing a list view, and an ACH return can land five days later.

---

## 5. Phasing

**A1 — the ledger, client-side (days, not weeks).** SQL + `products` table + `BTKDPricing.invoiceTotals()` + client writes of `pos_sales`/`pos_sale_lines`/`pos_payments` alongside the existing membership insert, under the staff RLS you already have. Plus: delete the mock card form (:1417-1422), the "Card surcharge" math (:1454-1457), the "Card on file" copy (:1470), and relabel the two `toast('Opens signed agreement')` mocks at :2590 and :2664 so nobody believes a signed agreement exists. Convert the invoice discount and admin fee inputs from `parseFloat` dollars to cents (:2201-2205).

**Genuinely useful on its own:** every sale — including product-only and event-only sales, which today write *nothing* — produces a durable record with tax, discount, admin fee, income category, staff and tender captured. Plus a daily "today by tender method" view so cash and check reconcile. This survives even if Stripe slips or gets deprioritized.

**A2 — move the write path server-side.** `pos-sale` Edge Function with server repricing, staff JWT verification, CORS lockdown, the pricing hash check. A2 deletes three inserts A1 wrote; everything else carries forward. Server-side repricing is only *justified* once the client's number becomes a charge, which is why it is not bundled into A1.

Also in A2: repoint the second membership write path on the Memberships page (index.html:3145-3166) at the server — but as a **separate no-charge path with a reason field**, leaving `sale_id` null. That path legitimately creates memberships with no money (comps, staff family, trial conversions, corrections); forcing it to fabricate a sale row would pollute the ledger.

**B — Stripe sandbox, non-membership items.** Card + ACH one-time hosted Checkout, the webhook, the return page, the "Unfinished sales" and "Needs attention" views with email alerts, the refund path. Sandbox tests: card success, ACH instant success, ACH insufficient funds, session expiry, duplicate webhook delivery, out-of-order arrival, and the ACH-`unpaid`-still-enrolls case.

**C — go live.** One real testing fee or uniform, run by you, then refunded from the Stripe dashboard to confirm the ledger row and Needs Attention entry appear. Then open to staff. Update ECOSYSTEM.md §15 with the resolved decisions and the write-once column split; document the deploy commands in a real file (trial-booking's survives only as index.ts:17 and a year-old commit message, which is why the docs never captured it).

**D — memberships + recurring (the actual Spark replacement).** Its own design conversation, but with the direction from §3.5 already fixed. Needs: agreement capture, Nacha mandate storage, cancellation flow, dunning, cohort cutover.

**E — dual pricing.** Only if the attorney says it works.

---

## 6. Hard parts and honest risks

**Take to an attorney, not to me:**

- Whether the §604A.001 cash-discount exclusion reaches ACH and check, or cash only. If not, the differential is a surcharge by definition and the debit user gets hit by §604A.002 — which Rowell never touched and which carries no injunction. Texas AG Opinion KP-0257 says §604A.0021 "remains enforceable in some contexts"; you are not a Rowell plaintiff.
- Given hosted Checkout cannot price by funding type pre-authorization, whether *any* implementable version exists. Fallbacks to price: cash-and-check-only discount (statutorily cleanest, saves nothing on the ACH cost the model exists to capture), or abandoning the differential and simply preferring ACH operationally.
- **Texas Occupations Code Ch. 702 (health spas)** — registration with the Secretary of State, security/bond requirements for prepaid memberships, mandatory cancellation rights. Whether a martial arts school selling multi-month and paid-in-full plans is covered or exempt is unresolved and appears nowhere in ECOSYSTEM.md. This is a Phase D blocker, not a Phase C one — another reason the first live sales are testing fees and uniforms.
- **There is no membership agreement anywhere in the system.** A free trial gets WAIVER_TEXT verbatim, a typed name, a drawn signature and an emailed PDF (trial-booking/index.ts:36, :117-123, :332-334). A $700 paid-in-full membership would get nothing. Phase D needs versioned terms, typed assent, a server-stamped timestamp and an emailed copy — with material terms disclosed **before** the Stripe redirect, not on the success screen.

**Take to your accountant:**

- Is a testing fee taxable? It is currently taxed at 8.25% as a `prod` line.
- **Invoice-level discounts do not currently reduce the tax base.** `posTotals()` (index.html:2049-2055) taxes the pre-discount base and subtracts the discount from the total. Today that is an untracked spreadsheet error because product sales write nothing; the moment Stripe is live it becomes over-collected sales tax on a real charge in a real ledger. The fix (pro-rata allocation, persisted per line) is in A1, but whether it *should* reduce the base is his call.
- Is the admin fee itself taxable when the invoice contains taxable goods? It is currently added after tax and never taxed.
- Sales tax on refunds — Texas filing needs taxable sales net of returns, which is why tax is stored per line and refunds are recorded against lines.

**Unverified Stripe specifics** (test these in sandbox; do not build policy on them):

- Stripe's capability table states ACH **partial refunds are not supported** (full only). This contradicts the general Refunds API and matters enormously for prorated mid-term refunds, which may be *mandated* under Ch. 702.
- Whether Financial Connections instant verification ($1.50) is billed per linked account or per payment.
- Whether Stripe Billing has any low-volume free tier.
- Whether subscription-mode ACH exposes `async_payment_*` or only `invoice.paid`.
- **SAQ A**: hosted Checkout is very likely still SAQ A and is the right choice over Elements. But PCI DSS v4.x revised SAQ A eligibility and added payment-page script-management language. Frame it as "designed for SAQ A eligibility; confirm the current version with the acquirer before attesting."

**Operational risks I want on the record:**

- **Accounts receivable is not delivered until Phase D.** The dashboard's "Overdue — $X outstanding" tile is dead: `isOverdue(m)` tests `m.balance > 0` (index.html:988) and every DB-loaded contact is hardcoded `balance: 0` (:790). Recurring dues — nearly all your receivables — stay in Spark. Do not ship a Phase C where the dashboard confidently reports "$0.00 outstanding" next to a live payments ledger. Hide the tile or wire it to open `account` sales.
- **Cancellation does not exist anywhere** and no phase before D addresses it. Through Phase C that means cancelling in Spark, separately setting `memberships.status`, separately deciding on the enrollment row — three manual steps across two systems.
- **No receipt artifact.** Stripe emails its own for card/ACH (bare total, no line detail, no student names); cash and check produce nothing. A line-itemized receipt keyed on `sale_id` is what a parent asks for at tax time and what a refund dispute turns on.
- **Free-text note fields are an open PCI path.** `pos_sales.notes`, `pos_payments.note` and the existing `<textarea class="inv-notes">` (:1676) will get a card number typed into them eventually. Reject 13–19 digit runs client- and server-side, label the field, and document the phone-payment flow as texting a Stripe link.
- **ACH is restricted to identified buyers** (`buyer_contact_id` not null). Walk-ins pay card, cash or check. Originating a consumer bank debit against an unidentified buyer, in a flow where disputes are final and uncontestable for 60 days, is a needless weak point.
- **`payment_events.payload` accumulates guardian names, emails, addresses and bank last4 forever.** Purge raw payloads past 18–24 months (the derived ledger is what reconciliation needs), and update barestkd-site/privacy-policy/ — it currently contains zero mentions of payment, billing or Stripe.
- **One latent pricing bug to confirm before vendoring:** `posMemDueCents` (:1761-1767) returns only `rec` for a `one_time` plan, dropping `finalDownCents` — while `buildMembershipSnapshot` still writes `final_down_cents` (pricing.js:427-430). Today that is a display discrepancy; under Stripe it is a real undercharge where the snapshot claims a down payment was collected. A byte-identical server copy reproduces it byte-identically, so a parity test cannot catch it. Confirm whether any `one_time` plan carries non-zero `down_cents`.

**Where the critiques overreached, briefly:** a full `payouts` table is more machinery than one school needs — I keep `fee_cents`/`net_cents`/`balance_transaction_id` (only conveniently available at event time, expensive to backfill) and defer the rest. Overpayment is a non-issue on fixed-amount Checkout Sessions. Rate limiting on the Edge Functions is ceremony given a staff-JWT-gated endpoint and a signature-verified webhook — revisit if abuse appears. The portal's token-in-URL launch (ECOSYSTEM.md:186-188) is a real weakness whose value rises once staff sessions can create charges, but it is its own piece of work, not this one.

---

## 7. What I recommend for the very next working session

1. **You, before we start:** answer blockers 2, 3 and 4 from §2 — the `profiles.role` self-write check, the live `is_staff()` / `my_student_ids()` / `is_email_allowed` definitions, and the live `enrollments` DDL. Ten minutes in the Supabase dashboard, and A1's SQL cannot be written safely without them. Start the Stripe account signup the same day.
2. **Me, in session:** deliver the Phase A1 SQL paste-ready — `products`, `pos_sales`, `pos_sale_lines`, `pos_payments`, `payment_events`, the `memberships`/`enrollments` provenance columns, the enrollments unique index, RLS, and the `roster` SELECT fix folded into the same block so you run and confirm once.
3. **Me, same session:** move the invoice arithmetic into `BTKDPricing.invoiceTotals()` in integer cents with round-half-up and pro-rata discount allocation, reduce `posTotals()` to a display formatter, convert the discount and admin-fee inputs to cents, and extend the Node tests — including a two-sibling-one-invoice case and a `one_time`-plan due-today assertion.
4. **Me, same session:** delete the mock card form, the "Card surcharge" math, and the "Card on file" copy; relabel the two contract-toast mocks.
5. **Then:** wire the client-side ledger writes and a "today by tender method" view. At that point you have a sales ledger for the first time, with no Stripe key in existence, and we start A2 from a position where every number on screen is already an integer cent.