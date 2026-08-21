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

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const setRow = await admin.from("settings")
    .select("billing_engine_live, billing_max_per_run, billing_retry_days, billing_max_attempts, billing_token")
    .limit(1).maybeSingle();
  const S = setRow.data ?? {};

  // The token is the whole gate: this endpoint is deployed --no-verify-jwt so
  // pg_cron can reach it, exactly like daily-report.
  const token = req.headers.get("x-billing-token") ?? "";
  if (!S.billing_token || token !== String(S.billing_token)) {
    return new Response(JSON.stringify({ error: "no" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const url = new URL(req.url);
  const live = S.billing_engine_live === true && url.searchParams.get("dry") !== "1";
  const cap = Math.max(1, Math.min(Number(S.billing_max_per_run) || 25, 200));
  const retryDays = Math.max(1, Number(S.billing_retry_days) || 3);
  const maxAttempts = Math.max(1, Number(S.billing_max_attempts) || 4);
  const today = todayCT();
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

  const report = {
    ran_at: new Date().toISOString(), today, live,
    considered: 0, charged: 0, declined: 0, skipped: 0,
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
      const exists = await admin.from("membership_installments")
        .select("id").eq("membership_id", m.id).eq("due_on", m.next_bill_on)
        .in("status", ["scheduled", "invoiced", "paid"]).limit(1);
      if (exists.data && exists.data.length) continue;
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

    // ── 2. everything that is due and not yet settled ─────────────────────
    const due = await admin.from("membership_installments")
      .select("id,membership_id,contact_id,seq,due_on,amount_cents,attempts,last_attempt_at")
      .eq("status", "scheduled")
      .lte("due_on", today)
      .order("due_on", { ascending: true })
      .limit(cap);

    const rows = (due.data ?? []) as Record<string, unknown>[];
    report.considered += rows.length;

    for (const r of rows) {
      const attempts = Number(r.attempts) || 0;
      // Back off between tries rather than hammering a card that just failed.
      if (attempts > 0 && r.last_attempt_at) {
        const since = (Date.now() - new Date(String(r.last_attempt_at)).getTime()) / 86400000;
        if (since < retryDays) { report.skipped++; continue; }
      }
      if (attempts >= maxAttempts) {
        report.skipped++;
        report.lines.push("GAVE UP after " + attempts + " tries: installment " + r.seq + " due " + r.due_on);
        continue;
      }

      const mem = await admin.from("memberships")
        .select("id,program,contact_id,billing_frequency,next_bill_on,status").eq("id", r.membership_id).maybeSingle();
      if (!mem.data || mem.data.status !== "active") { report.skipped++; continue; }

      const person = await admin.from("contacts")
        .select("id,first_name,last_name,email,brand,stripe_customer_id").eq("id", r.contact_id).maybeSingle();
      const who = person.data
        ? [person.data.first_name, person.data.last_name].filter(Boolean).join(" ")
        : "unknown";
      const amount = Number(r.amount_cents) || 0;
      const label = who + " · " + mem.data.program + " · " + money(amount) + " due " + r.due_on;

      if (!live) {
        report.lines.push("WOULD CHARGE " + label);
        report.charged_cents += amount;
        continue;
      }
      if (!secretKey || !person.data?.stripe_customer_id) {
        report.skipped++;
        report.lines.push("NO CARD ON FILE " + label);
        await admin.from("membership_installments").update({
          attempts: attempts + 1, last_attempt_at: new Date().toISOString(),
          last_error: "no saved card",
        }).eq("id", r.id);
        continue;
      }

      // ── the invoice comes first, so the money always has a home ─────────
      const saleId = crypto.randomUUID();
      const sale = await admin.from("pos_sales").insert({
        id: saleId, buyer_contact_id: r.contact_id, sale_date: today,
        staff_email: "charge-due@auto", brand: person.data.brand || "btkd",
        tender_method: null, status: "unpaid",
        subtotal_cents: amount, discount_cents: 0, admin_fee_cents: 0, tax_cents: 0,
        total_cents: amount,
        receipt_email: person.data.email,
        customer_note: mem.data.program + " membership, payment due " + r.due_on + ".",
        notes: "Automatic membership payment, installment " + r.seq,
      }).select("view_token").single();
      if (sale.error) {
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
      await admin.from("membership_installments")
        .update({ status: "invoiced", sale_id: saleId }).eq("id", r.id);

      // ── charge the card the member already put on file ─────────────────
      const pmList = await stripe(
        "payment_methods?customer=" + encodeURIComponent(String(person.data.stripe_customer_id)) + "&type=card&limit=1",
        secretKey, undefined, "GET",
      );
      const pm = pmList.body?.data?.[0]?.id;
      if (!pm) {
        report.declined++;
        report.lines.push("NO SAVED CARD " + label);
        await admin.from("membership_installments").update({
          status: "scheduled", sale_id: null,
          attempts: attempts + 1, last_attempt_at: new Date().toISOString(),
          last_error: "customer has no saved card",
        }).eq("id", r.id);
        await admin.from("pos_sales").update({ notes: "Automatic payment: no saved card" }).eq("id", saleId);
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
      // The idempotency key below IS the installment id, so a retried run
      // cannot create a second charge for the same scheduled payment.
      const pi = await stripe("payment_intents", secretKey, f, "POST", "inst_" + String(r.id));

      if (pi.ok && pi.body?.status === "succeeded") {
        report.charged++;
        report.charged_cents += amount;
        report.lines.push("CHARGED " + label);
        await admin.from("pos_payments").insert({
          sale_id: saleId, kind: "charge", amount_cents: amount, method: "card",
          stripe_object_id: pi.body.id, note: "Card payment (automatic membership billing)",
        });
        await admin.from("pos_sales").update({
          status: "paid", tender_method: "card",
          confirmed_at: new Date().toISOString(), stripe_payment_intent: pi.body.id,
        }).eq("id", saleId);
        await admin.from("membership_installments").update({
          status: "paid", attempts: attempts + 1,
          last_attempt_at: new Date().toISOString(), last_error: null,
        }).eq("id", r.id);
        // Only now does the member move forward. A decline leaves them due.
        const advanceFrom = String(mem.data.next_bill_on || r.due_on);
        await admin.from("memberships").update({
          next_bill_on: nextDue(advanceFrom, String(mem.data.billing_frequency)),
        }).eq("id", r.membership_id);
        await sendReceipt(saleId);
      } else {
        report.declined++;
        const why = pi.body?.error?.message || pi.body?.last_payment_error?.message
          || ("status " + (pi.body?.status ?? "unknown"));
        report.lines.push("DECLINED " + label + " - " + why);
        // The invoice stays, unpaid, so Race can send a pay link. The
        // installment goes back to scheduled so it is retried.
        await admin.from("membership_installments").update({
          status: "scheduled", sale_id: saleId,
          attempts: attempts + 1, last_attempt_at: new Date().toISOString(),
          last_error: String(why).slice(0, 400),
        }).eq("id", r.id);
        await admin.from("pos_sales").update({
          notes: "Automatic payment declined: " + String(why).slice(0, 200),
        }).eq("id", saleId);
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
