// ===========================================================================
// Supabase Edge Function: charge-due
// ---------------------------------------------------------------------------
// The recurring billing engine. Once a day it finds the payments that have
// come due and charges the card the member already put on file.
//
// This is the ONLY system here that moves money with nobody watching, so the
// design is defensive on purpose:
//
//   1. IT IS OFF UNTIL RACE TURNS IT ON. settings.billing_engine_live defaults
//      to false, and while it is false this function does the entire run and
//      reports exactly what it WOULD have charged without calling Stripe. A
//      deploy can never start charging people.
//   2. HARD CEILING PER RUN. settings.billing_max_per_run. A bug that selects
//      the wrong rows can affect a handful of members, not the whole roster.
//   3. THE DATABASE PREVENTS DOUBLE CHARGING, not the code. One scheduled
//      payment per membership per due date, enforced by a partial unique
//      index. Running twice in a day finds the same row and skips it. That is
//      the lesson the duplicate-receipt bug taught in August: a check-then-act
//      cannot win a race, only a constraint can.
//   4. A DECLINE IS NOT A FAILURE OF THE RUN. The invoice stays unpaid, the
//      attempt is recorded with Stripe's own reason, and the member is retried
//      on a schedule until billing_max_attempts. Nothing is silently dropped.
//   5. next_bill_on ONLY ADVANCES ON SUCCESS. A declined member stays due, so
//      they cannot quietly fall off the billing schedule.
//
// What it charges: membership_installments rows that are due. That is the
// owner's own doctrine ("the scheduled payment IS the due date") and it gives
// him one row per payment to move, reprice or waive. A recurring membership
// that has no row for its due date gets one created just in time, so nobody
// has to pre-generate a year of schedule.
//
// GET/POST with the x-billing-token header. Add ?dry=1 to force a dry run
// even when the engine is live.
//
// Deploy: supabase functions deploy charge-due --no-verify-jwt
// ===========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import BTKDPricing from "../_shared/pricing_esm.js";

const SITE = "https://www.barestkd.fit";

const money = (c: number) => "$" + (c / 100).toFixed(2);
const todayCT = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

function addDaysYmd(ymd: string, n: number): string {
  const p = ymd.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

/** The next due date after `ymd` at this cadence. Deliberately the SAME code
 *  the schedule builder uses rather than a second implementation: it already
 *  keeps the anchor day across short months, so a 31st schedule does not slide
 *  to the 28th permanently after February, and it is covered by tests. */
function nextDue(ymd: string, freq: string): string {
  const two = BTKDPricing.installmentSchedule({
    firstDueOn: ymd, frequency: freq === "weekly" ? "weekly" : "monthly",
    amountCents: 0, count: 2,
  });
  return two.length === 2 ? two[1].dueOn : addDaysYmd(ymd, freq === "weekly" ? 7 : 30);
}

/** `idempotencyKey` is Stripe's own guard: the same key can never produce a
 *  second charge, however many times this run is repeated or retried. It is a
 *  HEADER, not a form field. */
async function stripe(
  path: string, key: string, form?: URLSearchParams, method = "POST", idempotencyKey?: string,
) {
  const headers: Record<string, string> = {
    "Authorization": "Bearer " + key,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method, headers,
    body: method === "POST" ? (form ?? new URLSearchParams()) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
}

/** Fire the receipt server-to-server. Never throws into the billing path: the
 *  money is already taken, and a mail failure must not look like a charge
 *  failure. */
async function sendReceipt(saleId: string): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const r = await fetch(url + "/functions/v1/send-receipt", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + serviceKey,
        "Content-Type": "application/json",
        "Origin": "https://crm.barestkd.fit",
      },
      body: JSON.stringify({ sale_id: saleId, notify_owner: true }),
    });
    if (!r.ok) console.error("[charge-due] receipt failed", r.status, await r.text().catch(() => ""));
  } catch (e) {
    console.error("[charge-due] receipt threw", e);
  }
}

/** Move a membership to its next billing date, or end it if the agreed number
  * of payments is complete. Advancing from the INSTALLMENT keeps a membership
  * that is already ahead from skipping a cycle. */
async function advanceMembership(
  admin: ReturnType<typeof createClient>,
  mem: Record<string, unknown>,
  r: Record<string, unknown>,
  today: string,
) {
  const paid = await admin.from("membership_installments")
    .select("id", { count: "exact", head: true })
    .eq("membership_id", mem.id).eq("status", "paid");
  const total = Number(mem.payment_count) || 0;
  if (total > 0 && Number(paid.count ?? 0) >= total) {
    // The term is complete. Stop billing rather than manufacturing a payment
    // nobody agreed to.
    await admin.from("memberships")
      .update({ next_bill_on: null, ended_on: today }).eq("id", mem.id);
    return;
  }
  await admin.from("memberships")
    .update({ next_bill_on: nextDue(String(r.due_on), String(mem.billing_frequency)) })
    .eq("id", mem.id);
}

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const setRow = await admin.from("settings")
    .select("billing_engine_live, billing_max_per_run, billing_retry_days, billing_max_attempts, billing_token, billing_paused, billing_max_back_cycles")
    .limit(1).maybeSingle();
  const S = setRow.data ?? {};

  // The token is the whole gate: this endpoint is deployed --no-verify-jwt so
  // pg_cron can reach it, exactly like daily-report.
  const token = req.headers.get("x-billing-token") ?? "";
  if (!S.billing_token || token !== String(S.billing_token)) {
    return new Response(JSON.stringify({ error: "no" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const url = new URL(req.url);
  // Paused beats live. Two switches, and the safer one always wins.
  const live = S.billing_engine_live === true
    && S.billing_paused !== true
    && url.searchParams.get("dry") !== "1";
  // An emergency brake has to be able to say ZERO. `Number(x) || 25` turned
  // 0 into 25, so the one value an owner would reach for in a panic was the
  // one value that did nothing.
  const rawCap = Number(S.billing_max_per_run);
  const cap = Math.min(Number.isFinite(rawCap) ? Math.max(0, rawCap) : 25, 200);
  const maxBackCycles = Math.max(0, Number(S.billing_max_back_cycles) || 1);
  const retryDays = Math.max(1, Number(S.billing_retry_days) || 3);
  const maxAttempts = Math.max(1, Number(S.billing_max_attempts) || 4);
  const today = todayCT();
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  const report = {
    ran_at: new Date().toISOString(), today, live,
    considered: 0, charged: 0, declined: 0, skipped: 0,
    gave_up: 0, needs_review: 0, settled_by_hand: 0,
    charged_cents: 0,
    lines: [] as string[],
  };

  try {
    // ── 1. give every due recurring membership a row to charge ────────────
    // A membership billed monthly does not need a year of schedule laid out in
    // advance. It needs the NEXT one, made just in time. Anything Race already
    // scheduled by hand is found below instead, with his date and his price.
    const dueMems = await admin.from("memberships")
      .select("id,contact_id,program,plan_code,billing_frequency,final_recurring_cents,next_bill_on,status")
      .eq("status", "active")
      .in("billing_frequency", ["monthly", "weekly"])
      .not("next_bill_on", "is", null)
      .lte("next_bill_on", today)
      .limit(cap * 2);

    for (const m of (dueMems.data ?? []) as Record<string, unknown>[]) {
      if (!Number(m.final_recurring_cents)) continue; // nothing to charge
      // ANY installment on this date answers the question, including a
      // waived or canceled one. Filtering those out let the engine re-create
      // and charge a payment staff had deliberately written off.
      const exists = await admin.from("membership_installments")
        .select("id,status").eq("membership_id", m.id).eq("due_on", m.next_bill_on).limit(1);
      if (exists.data && exists.data.length) {
        // A waiver settles the date but does not move the member forward, so
        // advance them here or every run would reconsider the same date.
        const st = String(exists.data[0].status);
        if (live && (st === "waived" || st === "canceled")) {
          const after = BTKDPricing.nextBillOn(String(m.next_bill_on), String(m.next_bill_on));
          if (after) {
            await admin.from("memberships").update({ next_bill_on: after }).eq("id", m.id);
            report.lines.push("SKIPPED " + m.program + " " + m.next_bill_on + " (" + st + "), moved to " + after);
          }
        }
        continue;
      }
      if (!live) {
        // A dry run must not write. Report what WOULD be scheduled and move
        // on, rather than quietly leaving rows behind as the price of looking.
        report.considered++;
        report.charged_cents += Number(m.final_recurring_cents);
        report.lines.push("WOULD SCHEDULE AND CHARGE " + m.program + " "
          + money(Number(m.final_recurring_cents)) + " due " + m.next_bill_on);
        continue;
      }
      const seqRow = await admin.from("membership_installments")
        .select("seq").eq("membership_id", m.id).order("seq", { ascending: false }).limit(1).maybeSingle();
      const nextSeq = (Number(seqRow.data?.seq) || 0) + 1;
      const ins = await admin.from("membership_installments").insert({
        membership_id: m.id, contact_id: m.contact_id, seq: nextSeq,
        due_on: m.next_bill_on, amount_cents: m.final_recurring_cents, status: "scheduled",
      });
      // A duplicate here means another run beat us to it, which is fine.
      if (ins.error && !String(ins.error.message).includes("duplicate")) {
        console.error("[charge-due] could not schedule", m.id, ins.error.message);
      }
    }

    // ── 2. anything a previous run left mid-charge ────────────────────────
    // A run that died between claiming and answering leaves a row in
    // "charging". That is SAFE, because nobody else can claim it, so it can
    // never become a second charge. But it must never be silent: the money
    // may or may not have left the card, and only a human can tell.
    const stuck = await admin.from("membership_installments")
      .select("id,seq,due_on,amount_cents,last_attempt_at").eq("status", "charging");
    for (const x of (stuck.data ?? []) as Record<string, unknown>[]) {
      report.needs_review++;
      report.lines.push("NEEDS A HUMAN: installment " + x.seq + " due " + x.due_on
        + " " + money(Number(x.amount_cents)) + " was mid-charge when a run stopped."
        + " Check Stripe before touching it.");
    }

    // ── 3. everything due and still unsettled ─────────────────────────────
    const due = await admin.from("membership_installments")
      .select("id,membership_id,contact_id,seq,due_on,amount_cents,attempts,last_attempt_at,sale_id")
      .eq("status", "scheduled")
      .lte("due_on", today)
      .order("due_on", { ascending: true })
      .limit(cap);

    const rows = (due.data ?? []) as Record<string, unknown>[];
    report.considered += rows.length;

    for (const r of rows) {
      const attempts = Number(r.attempts) || 0;
      const amount = Number(r.amount_cents) || 0;

      // Give up LOUDLY and leave the queue. Left "scheduled", a dead row
      // sorts to the front of every future run and eats the per-run cap,
      // silently starving everyone behind it.
      if (attempts >= maxAttempts) {
        await admin.from("membership_installments")
          .update({ status: "failed" }).eq("id", r.id).eq("status", "scheduled");
        report.gave_up++;
        report.lines.push("GAVE UP after " + attempts + " tries: installment "
          + r.seq + " due " + r.due_on + " " + money(amount) + ". Needs a call.");
        continue;
      }
      if (attempts > 0 && r.last_attempt_at) {
        const since = (Date.now() - new Date(String(r.last_attempt_at)).getTime()) / 86400000;
        if (since < retryDays) { report.skipped++; continue; }
      }
      if (amount <= 0) {
        await admin.from("membership_installments")
          .update({ status: "failed", last_error: "nothing to charge" })
          .eq("id", r.id).eq("status", "scheduled");
        report.skipped++;
        report.lines.push("NOTHING TO CHARGE on installment " + r.seq + " due " + r.due_on);
        continue;
      }

      const mem = await admin.from("memberships")
        .select("id,program,contact_id,sale_id,billing_frequency,next_bill_on,status,payment_count,ended_on")
        .eq("id", r.membership_id).maybeSingle();
      if (!mem.data || mem.data.status !== "active") { report.skipped++; continue; }
      if (mem.data.ended_on && String(mem.data.ended_on) < today) {
        report.skipped++;
        report.lines.push("MEMBERSHIP ENDED " + mem.data.program + ", not charging " + r.due_on);
        continue;
      }

      // How far behind is this? Back-billing every missed cycle at once is
      // never what anyone wants to discover on their statement.
      const behind = Math.floor((new Date(today + "T00:00:00Z").getTime()
        - new Date(String(r.due_on) + "T00:00:00Z").getTime()) / 86400000);
      const cycleDays = String(mem.data.billing_frequency) === "weekly" ? 7 : 28;
      if (behind > maxBackCycles * cycleDays) {
        report.needs_review++;
        report.lines.push("TOO FAR BEHIND to bill automatically: installment " + r.seq
          + " due " + r.due_on + " is " + behind + " days old. Charge it by hand if it is owed.");
        continue;
      }

      // The card belongs to whoever BOUGHT the membership, which for a child
      // is a parent, not the student the membership is filed under.
      let payerId = String(r.contact_id);
      if (mem.data.sale_id) {
        const origin = await admin.from("pos_sales")
          .select("buyer_contact_id").eq("id", mem.data.sale_id).maybeSingle();
        if (origin.data?.buyer_contact_id) payerId = String(origin.data.buyer_contact_id);
      }
      const person = await admin.from("contacts")
        .select("id,first_name,last_name,email,brand,stripe_customer_id").eq("id", payerId).maybeSingle();
      const who = person.data
        ? [person.data.first_name, person.data.last_name].filter(Boolean).join(" ")
        : "unknown";
      const label = who + " · " + mem.data.program + " · " + money(amount) + " due " + r.due_on;

      if (!live) {
        report.lines.push("WOULD CHARGE " + label);
        report.charged_cents += amount;
        continue;
      }

      // ── the claim ────────────────────────────────────────────────────────
      // This is the only thing standing between one charge and two. A
      // conditional update is atomic: exactly one caller can move this row
      // out of "scheduled", and that caller owns the charge. A check-then-act
      // cannot win this race; only the database can decide it.
      const claim = await admin.from("membership_installments")
        .update({ status: "charging", last_attempt_at: new Date().toISOString() })
        .eq("id", r.id).eq("status", "scheduled").select("id");
      if (!claim.data || !claim.data.length) { report.skipped++; continue; }

      // Reuse this installment's invoice rather than minting a new one per
      // attempt. A fresh invoice each decline leaves a trail of orphans with
      // live pay links, and if a member pays one of them by hand the engine
      // still thinks the month is owed.
      let saleId = r.sale_id ? String(r.sale_id) : "";
      if (saleId) {
        const prior = await admin.from("pos_sales").select("status").eq("id", saleId).maybeSingle();
        if (prior.data?.status === "paid") {
          // They already paid the link. Settle it and move on: charging now
          // would take the month twice.
          await admin.from("membership_installments")
            .update({ status: "paid", last_error: null }).eq("id", r.id).eq("status", "charging");
          await advanceMembership(admin, mem.data, r, today);
          report.settled_by_hand++;
          report.lines.push("ALREADY PAID BY LINK " + label);
          continue;
        }
      } else {
        saleId = crypto.randomUUID();
        const sale = await admin.from("pos_sales").insert({
          id: saleId, buyer_contact_id: payerId, sale_date: today,
          staff_email: "charge-due@auto", brand: person.data?.brand || "btkd",
          tender_method: null, status: "unpaid",
          subtotal_cents: amount, discount_cents: 0, admin_fee_cents: 0, tax_cents: 0,
          total_cents: amount,
          receipt_email: person.data?.email,
          customer_note: mem.data.program + " membership, payment due " + r.due_on + ".",
          notes: "Automatic membership payment, installment " + r.seq,
        }).select("id").single();
        if (sale.error) {
          await admin.from("membership_installments")
            .update({ status: "scheduled" }).eq("id", r.id).eq("status", "charging");
          report.skipped++;
          console.error("[charge-due] invoice failed", r.id, sale.error.message);
          continue;
        }
        await admin.from("pos_sale_lines").insert({
          sale_id: saleId, kind: "mem",
          label: mem.data.program + " membership (" + r.due_on + ")",
          qty: 1, unit_cents: amount, discount_cents: 0, taxable: false,
          line_total_cents: amount, student_contact_id: r.contact_id,
          membership_id: r.membership_id,
        });
        await admin.from("membership_installments").update({ sale_id: saleId }).eq("id", r.id);
      }

      if (!secretKey || !person.data?.stripe_customer_id) {
        await admin.from("membership_installments").update({
          status: "scheduled", attempts: attempts + 1, last_error: "no saved card",
        }).eq("id", r.id).eq("status", "charging");
        report.declined++;
        report.lines.push("NO CARD ON FILE " + label + " (invoice raised, send the link)");
        continue;
      }

      const pmList = await stripe(
        "payment_methods?customer=" + encodeURIComponent(String(person.data.stripe_customer_id)) + "&type=card&limit=1",
        secretKey, undefined, "GET",
      );
      const pm = pmList.body?.data?.[0]?.id;
      if (!pm) {
        await admin.from("membership_installments").update({
          status: "scheduled", attempts: attempts + 1, last_error: "customer has no saved card",
        }).eq("id", r.id).eq("status", "charging");
        report.declined++;
        report.lines.push("NO SAVED CARD " + label + " (invoice raised, send the link)");
        continue;
      }

      const f = new URLSearchParams();
      f.set("amount", String(amount));
      f.set("currency", "usd");
      f.set("customer", String(person.data.stripe_customer_id));
      f.set("payment_method", String(pm));
      f.set("off_session", "true");
      f.set("confirm", "true");
      f.set("description", mem.data.program + " membership - " + who);
      f.set("metadata[sale_id]", saleId);
      f.set("metadata[source]", "auto-billing");
      // Key AND body are now stable per installment, because the invoice is
      // reused. The first cut minted a new sale_id every attempt, so the body
      // changed and Stripe answered a retry with an idempotency error, which
      // the code then recorded as a card decline.
      const pi = await stripe("payment_intents", secretKey, f, "POST", "inst_" + String(r.id));

      const errCode = String(pi.body?.error?.code ?? "");
      const declined = pi.body?.error?.type === "card_error"
        || pi.body?.status === "requires_payment_method";

      if (pi.ok && pi.body?.status === "succeeded") {
        await admin.from("pos_payments").insert({
          sale_id: saleId, kind: "charge", amount_cents: amount, method: "card",
          stripe_object_id: pi.body.id, note: "Card payment (automatic membership billing)",
        });
        await admin.from("pos_sales").update({
          status: "paid", tender_method: "card",
          confirmed_at: new Date().toISOString(), stripe_payment_intent: pi.body.id,
        }).eq("id", saleId);
        const settled = await admin.from("membership_installments").update({
          status: "paid", attempts: attempts + 1, last_error: null,
        }).eq("id", r.id).eq("status", "charging").select("id");
        report.charged++;
        report.charged_cents += amount;
        report.lines.push("CHARGED " + label);
        // Advance from THIS installment's date, not the membership's, so a
        // membership already ahead of the row cannot skip a month.
        if (settled.data && settled.data.length) await advanceMembership(admin, mem.data, r, today);
        await sendReceipt(saleId);
      } else if (declined) {
        const why = pi.body?.error?.message || ("status " + (pi.body?.status ?? "unknown"));
        await admin.from("membership_installments").update({
          status: "scheduled", attempts: attempts + 1,
          last_error: String(why).slice(0, 400),
        }).eq("id", r.id).eq("status", "charging");
        await admin.from("pos_sales").update({
          notes: "Automatic payment declined: " + String(why).slice(0, 200),
        }).eq("id", saleId);
        report.declined++;
        report.lines.push("DECLINED " + label + " - " + why);
      } else {
        // NOT a decline: a 5xx, a timeout, an idempotency collision. We do
        // not know whether the money moved, so we do not guess. The row stays
        // claimed, which blocks any retry, and a human is told.
        const why = pi.body?.error?.message || errCode || "no answer from Stripe";
        await admin.from("membership_installments").update({
          last_error: "INDETERMINATE: " + String(why).slice(0, 380),
        }).eq("id", r.id);
        report.needs_review++;
        report.lines.push("NO CLEAR ANSWER for " + label + " - " + why
          + ". Left claimed so nothing retries it. Check Stripe.");
      }
    }
    console.log("[charge-due]", JSON.stringify(report));
    return new Response(JSON.stringify(report, null, 1), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[charge-due] run failed:", e);
    return new Response(JSON.stringify({ error: "run failed", ...report }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
