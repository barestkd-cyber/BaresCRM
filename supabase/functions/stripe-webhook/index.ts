// ===========================================================================
// Supabase Edge Function: stripe-webhook
// ---------------------------------------------------------------------------
// The ONLY thing that marks a Stripe-paid invoice paid. Public and
// unauthenticated by design - the Stripe signature is the entire gate.
//
// HARD RULES:
//   1. Deploy --no-verify-jwt (Stripe cannot send a Supabase JWT).
//   2. Read the RAW body first and verify the signature against it. Any
//      reserialization breaks verification.
//   3. Signature check is manual (Web Crypto HMAC-SHA256) - no SDK, so no
//      Deno-compat surprises. Scheme per Stripe docs: signed_payload is
//      "<t>.<raw body>", key is the whsec_ secret, compare hex constant-time,
//      accept only v1 schemes (downgrade protection), honour a 5-minute
//      tolerance, and accept ANY of the v1 signatures (secret rotation sends
//      one per active secret).
//   4. Dedupe on event id via payment_events - Stripe retries, and may send
//      the same event twice. Insert-first; a unique violation means "seen".
//   5. Money is never lost: if a payment arrives for an invoice that is
//      somehow already paid, the payment row is STILL recorded (it shows as
//      an overpayment Race can refund) rather than silently dropped.
//   6. Return 2xx fast; failures are logged, not retried into a loop.
//
// Subscribe this endpoint to: checkout.session.completed,
// checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
// charge.refunded
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOLERANCE_SECONDS = 300; // Stripe's own default; never 0

const enc = new TextEncoder();

function hexEqual(a: string, b: string): boolean {
  // Constant-time-ish comparison: same length check plus full-length XOR scan.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify per https://docs.stripe.com/webhooks#verify-manually */
async function verifyStripeSignature(raw: string, header: string, secret: string): Promise<boolean> {
  let timestamp = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim(), v = part.slice(idx + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") v1.push(v);   // ignore v0 and anything else
  }
  if (!timestamp || !v1.length) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > TOLERANCE_SECONDS) return false;

  const expected = await hmacHex(secret, `${timestamp}.${raw}`);
  return v1.some((sig) => hexEqual(sig, expected));
}

/** Fire the receipt email server-to-server. Never throws into the payment
 *  path: the money is already recorded, and a mail failure must not turn a
 *  successful payment into a retried webhook.
 *
 *  `notify_owner` BCCs the owner so a payment that lands while nobody is at
 *  the desk still reaches a human - previously an online payment by a walk-in
 *  notified nobody at all. */
async function sendReceipt(saleId: string): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${url}/functions/v1/send-receipt`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Origin": "https://crm.barestkd.fit",
      },
      // No `to`: send-receipt resolves the recipient itself - the address the
      // payer used at checkout, else the buyer on file.
      body: JSON.stringify({ sale_id: saleId, notify_owner: true }),
    });
    if (!res.ok) console.error("receipt send failed", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("receipt send threw", e);
  }
}

function methodFromSession(session: Record<string, any>): string {
  const types: string[] = session?.payment_method_types ?? [];
  if (types.includes("us_bank_account")) return "ach";
  return "card";
}

/** Where a card payment actually came from, for the ledger note.
 *
 * This branch used to hardcode "keyed at the desk". It is the BACKSTOP for
 * every card payment, not just POS ones, so on 2026-08-19 it labelled a
 * payment Mike made through his invoice link as taken at the front desk,
 * and won the race against create-checkout which had it right. Every
 * PaymentIntent we create carries metadata.source; read it instead of
 * guessing, and stay vague rather than wrong when it is missing. */
function paymentNote(source: string): string {
  switch (source) {
    case "pos-manual":        return "Card payment (keyed at the desk)";
    case "invoice-page":      return "Card payment (invoice page)";
    case "lk-checkout":       return "Card payment (Little Kickers signup)";
    case "cubs-checkout":     return "Card payment (Cubs enrollment)";
    case "testing-checkout":  return "Card payment (testing registration)";
    case "program-checkout":  return "Card payment (online enrollment)";
    case "private-checkout":  return "Card payment (private lesson)";
    default:                  return "Card payment";
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("not configured", { status: 500 });
  }

  // RAW body first - this exact string is what was signed.
  const raw = await req.text();
  const sigHeader = req.headers.get("Stripe-Signature") ?? "";
  if (!(await verifyStripeSignature(raw, sigHeader, secret))) {
    console.error("signature verification failed");
    return new Response("bad signature", { status: 400 });
  }

  let event: Record<string, any>;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Dedupe: insert-first. A unique violation means we already have it.
  const seen = await admin.from("payment_events").insert({
    stripe_event_id: event.id, type: event.type, payload: event,
  });
  if (seen.error) {
    if (String(seen.error.code) === "23505") return new Response("duplicate ignored", { status: 200 });
    console.error("payment_events insert failed", seen.error);
    // Fall through: recording the money matters more than the audit row.
  }

  try {
    const obj = event.data?.object ?? {};

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      // For card, completed already means paid. For ACH, completed fires while
      // still pending and async_payment_succeeded fires when it clears.
      if (obj.payment_status !== "paid") {
        await admin.from("payment_events").update({ handled_at: new Date().toISOString(), handle_error: "not yet paid (" + obj.payment_status + ")" }).eq("stripe_event_id", event.id);
        return new Response("ok", { status: 200 });
      }
      const saleId = obj.client_reference_id || obj.metadata?.sale_id;
      if (!saleId) throw new Error("no sale id on session " + obj.id);

      const amount = Number(obj.amount_total ?? 0);
      if (amount <= 0) throw new Error("no amount on session " + obj.id);

      const method = methodFromSession(obj);
      const pi = typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id ?? null;

      // The address the payer typed at checkout. For a walk-in sale this is
      // the ONLY email anybody has, so without it the receipt goes nowhere.
      // Stored as-is and never written onto a contact here: an email entered
      // at a checkout page is not proof of identity, and silently changing a
      // member's address would redirect all their future receipts. The CRM
      // asks staff before adopting it.
      const payerEmail = String(obj.customer_details?.email ?? obj.customer_email ?? "").trim().toLowerCase();
      if (payerEmail && payerEmail.length <= 200) {
        const se = await admin.from("pos_sales").update({ stripe_email: payerEmail }).eq("id", saleId);
        if (se.error) console.error("stripe_email stamp failed", se.error); // not fatal to the payment
      }

      // Idempotency at the money level too: one payment row per session.
      const existing = await admin.from("pos_payments")
        .select("id").eq("sale_id", saleId).eq("stripe_object_id", obj.id).maybeSingle();
      if (!existing.data) {
        const ins = await admin.from("pos_payments").insert({
          sale_id: saleId, kind: "charge", amount_cents: amount, method,
          stripe_object_id: obj.id, stripe_event_id: event.id,
          note: method === "ach" ? "Bank payment (Stripe)" : "Card payment (Stripe)",
        });
        if (ins.error) throw ins.error;
      }

      // Mark paid only when the ledger says the balance is actually covered.
      const sale = await admin.from("pos_sales").select("total_cents,status").eq("id", saleId).single();
      if (!sale.error && sale.data) {
        const pays = await admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId);
        const net = (pays.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
        if (net >= sale.data.total_cents && sale.data.status !== "paid") {
          const upd = await admin.from("pos_sales").update({
            status: "paid", tender_method: method,
            confirmed_at: new Date().toISOString(), stripe_payment_intent: pi,
          }).eq("id", saleId);
          if (upd.error) console.error("mark paid failed", upd.error);
          else await sendReceipt(saleId);
        } else if (sale.data.status === "paid") {
          console.warn("payment recorded against an already-paid invoice", saleId, obj.id);
        }
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      // ACH bounced. Leave the invoice unpaid and leave a trail.
      const saleId = obj.client_reference_id || obj.metadata?.sale_id;
      if (saleId) {
        await admin.from("pos_payments").insert({
          sale_id: saleId, kind: "ach_return", amount_cents: 0,
          method: "ach", stripe_object_id: obj.id, stripe_event_id: event.id,
          note: "Bank payment failed - invoice still owes its balance",
        });
      }
    } else if (event.type === "payment_intent.succeeded") {
      // A card keyed at the front desk (pos-charge). The CRM already calls
      // pos-charge's finalize, which writes the same row synchronously so the
      // desk gets an instant answer; this is the backstop for a browser that
      // closed mid-confirm. Both dedupe on stripe_object_id, so whichever
      // arrives second does nothing.
      const saleId = obj.metadata?.sale_id;
      const amount = Number(obj.amount_received ?? 0);
      if (saleId && amount > 0) {
        const seen = await admin.from("pos_payments")
          .select("id").eq("sale_id", saleId).eq("stripe_object_id", obj.id).maybeSingle();
        if (!seen.data) {
          await admin.from("pos_payments").insert({
            sale_id: saleId, kind: "charge", amount_cents: amount,
            method: "card", stripe_object_id: obj.id, stripe_event_id: event.id,
            note: paymentNote(String(obj.metadata?.source ?? "")),
          });
        }
        const sale = await admin.from("pos_sales").select("total_cents,status").eq("id", saleId).single();
        if (!sale.error && sale.data && sale.data.status !== "paid") {
          const pays = await admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId);
          const net = (pays.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
          if (net >= sale.data.total_cents) {
            const upd = await admin.from("pos_sales").update({
              status: "paid", tender_method: "card",
              confirmed_at: new Date().toISOString(), stripe_payment_intent: obj.id,
            }).eq("id", saleId);
            if (!upd.error) await sendReceipt(saleId);
          }
        }
      }
    } else if (event.type === "charge.refunded") {
      // Record refunds issued from the Stripe dashboard so the CRM ledger and
      // Stripe never disagree. Amount is the NEWLY refunded portion.
      const saleId = obj.metadata?.sale_id;
      const refunded = Number(obj.amount_refunded ?? 0);
      if (saleId && refunded > 0) {
        const prior = await admin.from("pos_payments")
          .select("amount_cents").eq("sale_id", saleId).eq("kind", "refund");
        const already = -(prior.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
        const delta = refunded - already;
        if (delta > 0) {
          await admin.from("pos_payments").insert({
            sale_id: saleId, kind: "refund", amount_cents: -delta, method: "card",
            stripe_object_id: obj.id, stripe_event_id: event.id,
            note: "Refunded in Stripe",
          });
        }
      }
    }

    await admin.from("payment_events").update({ handled_at: new Date().toISOString() }).eq("stripe_event_id", event.id);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("handler error", event.type, e);
    await admin.from("payment_events")
      .update({ handle_error: String((e as Error)?.message ?? e) })
      .eq("stripe_event_id", event.id);
    // 200 on purpose: the event is stored, and a retry storm helps nobody.
    // payment_events.handle_error is the queue of things to look at.
    return new Response("recorded with error", { status: 200 });
  }
});
