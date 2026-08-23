// ===========================================================================
// Supabase Edge Function: pos-charge - run a card at the front desk
// ---------------------------------------------------------------------------
// Race takes cards in his office with the card in hand and no reader yet, so
// the POS needs to CHARGE, not just record. This is the server half of that:
// the browser never sees a secret key and never posts a card number anywhere
// except Stripe's own iframe (Stripe Elements), which keeps this out of PCI
// scope beyond SAQ-A.
//
// THREE ACTIONS, all staff-only (deployed WITH JWT verification + is_staff):
//   config  -> { publishable_key }  so the CRM can boot Stripe.js without a
//              hardcoded key, and test/live follow whatever the secrets say.
//   intent  -> creates a PaymentIntent for the invoice's REAL balance, read
//              from the ledger here. Returns its client_secret for the
//              browser to confirm. The client never states an amount.
//   finalize-> after the browser confirms, re-reads the PaymentIntent FROM
//              STRIPE and writes pos_payments only if Stripe says succeeded.
//              A lying client cannot mark an invoice paid. When the invoice
//              is settled here, the receipt is sent from here too (service
//              key, so send-receipt dedupes it against the webhook's copy).
//
// The webhook also handles payment_intent.succeeded as a backstop; both paths
// dedupe on stripe_object_id, so whichever lands first wins and the second is
// a no-op.
//
// CARD ON FILE: every charge attaches to a Stripe customer with
// setup_future_usage=off_session, per the owner's locked model - the card is
// saved so Race can charge it later, and customers never manage cards
// themselves.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy pos-charge
// Requires secret STRIPE_PUBLISHABLE_KEY alongside STRIPE_SECRET_KEY.
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://crm.barestkd.fit",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];
function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(obj: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const str = (v: unknown) => (v == null ? "" : String(v)).trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Stripe ids are opaque but never arbitrary text; refusing anything else
// keeps a typo or a hostile string out of a URL path.
const PM_RE = /^pm_[A-Za-z0-9]+$/;

/** Stripe REST call, form-encoded. No SDK: one less dependency to pin. */
async function stripe(path: string, key: string, form?: URLSearchParams, method = "POST", idem?: string) {
  const headers: Record<string, string> = {
    "Authorization": "Bearer " + key,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  // An idempotency key makes a repeated POST return the FIRST result rather
  // than doing it again, which is the whole defence against a double-press
  // taking the money twice.
  if (idem) headers["Idempotency-Key"] = idem;
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers,
    body: method === "POST" ? (form ?? new URLSearchParams()) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || ("Stripe " + res.status));
  return body;
}

/** Automatic receipt, authenticated with the service key so send-receipt
 *  treats it as a system send and claims receipt_sent_at (one receipt per
 *  payment, whichever of finalize and the webhook gets there first). */
async function sendReceipt(url: string, serviceKey: string, saleId: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/functions/v1/send-receipt`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json", "Origin": "https://crm.barestkd.fit" },
      body: JSON.stringify({ sale_id: saleId, notify_owner: true }),
    });
    if (!res.ok) { console.error("receipt send failed", res.status, await res.text().catch(() => "")); return false; }
    return true;
  } catch (e) { console.error("receipt send threw", e); return false; }
}
/** Put a SUCCEEDED PaymentIntent on the books, settle the invoice if it is
 *  now covered, and send the receipt. Shared by finalize (customer present,
 *  browser confirmed) and charge-saved (card on file, nobody present) so the
 *  two can never disagree about what a paid invoice looks like.
 *
 *  Dedupes on stripe_object_id, the same key the webhook uses, so whichever
 *  path arrives first wins and the rest are no-ops. */
async function recordSucceeded(
  admin: ReturnType<typeof createClient>,
  url: string, serviceKey: string, saleId: string,
  sale: Record<string, any>, pi: Record<string, any>, note: string,
) {
  const amount = Number(pi.amount_received ?? pi.amount ?? 0);
  if (amount <= 0) throw new Error("No amount on that payment.");

  const existing = await admin.from("pos_payments")
    .select("id").eq("sale_id", saleId).eq("stripe_object_id", pi.id).maybeSingle();
  if (!existing.data) {
    const ins = await admin.from("pos_payments").insert({
      sale_id: saleId, kind: "charge", amount_cents: amount,
      method: "card", stripe_object_id: pi.id, note,
    });
    // 23505: the webhook landed between our check and our insert. Same
    // payment, already on the books (unique index on stripe_object_id).
    if (ins.error && String(ins.error.code) !== "23505") throw ins.error;
  }

  const pays = await admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId);
  const net = (pays.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
  let nowPaid = false;
  if (net >= sale.total_cents && sale.status !== "paid") {
    const upd = await admin.from("pos_sales").update({
      status: "paid", tender_method: "card",
      confirmed_at: new Date().toISOString(), stripe_payment_intent: pi.id,
    }).eq("id", saleId);
    if (!upd.error) nowPaid = true;
  }
  // The receipt goes out from here, server-to-server, so send-receipt's claim
  // on receipt_sent_at dedupes it against the webhook's copy.
  let receiptSent = false;
  if (nowPaid) receiptSent = await sendReceipt(url, serviceKey, saleId);
  return {
    ok: true, amount_cents: amount, paid_in_full: nowPaid,
    balance_cents: Math.max(0, sale.total_cents - net), receipt_sent: receiptSent,
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const pubKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");

    // ── staff only. The JWT is verified by the platform; this checks ROLE. ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const staff = await asUser.rpc("is_staff");
    if (staff.error || staff.data !== true) {
      return json({ error: "Staff only." }, 403, cors);
    }

    const body = await req.json().catch(() => ({}));
    const action = str(body.action);

    if (action === "config") {
      if (!pubKey) return json({ error: "STRIPE_PUBLISHABLE_KEY is not set." }, 503, cors);
      return json({ publishable_key: pubKey, live: pubKey.startsWith("pk_live_") }, 200, cors);
    }
    if (!secretKey) return json({ error: "Payments are not configured yet." }, 503, cors);

    const admin = createClient(url, serviceKey);
    const saleId = str(body.sale_id).toLowerCase();
    if (!UUID_RE.test(saleId)) return json({ error: "Bad sale id" }, 400, cors);

    const saleRes = await admin.from("pos_sales")
      .select("id,status,total_cents,buyer_contact_id,stripe_customer_id,stripe_payment_intent")
      .eq("id", saleId).single();
    if (saleRes.error || !saleRes.data) return json({ error: "Invoice not found" }, 404, cors);
    const s = saleRes.data;

    // The amount is OURS: total minus everything already paid.
    const paysRes = await admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId);
    const paidNet = (paysRes.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
    const balance = s.total_cents - paidNet;

    if (action === "intent") {
      if (balance <= 0) return json({ error: "Nothing is owed on this invoice." }, 409, cors);
      if (balance < 50) return json({ error: "Card minimum is $0.50." }, 409, cors);

      // A customer record so the card is on file for later charges.
      let customerId = s.stripe_customer_id as string | null;
      if (!customerId && s.buyer_contact_id) {
        const c = await admin.from("contacts")
          .select("first_name,last_name,email,phone,stripe_customer_id")
          .eq("id", s.buyer_contact_id).maybeSingle();
        customerId = c.data?.stripe_customer_id ?? null;
        if (!customerId) {
          const f = new URLSearchParams();
          const name = [c.data?.first_name, c.data?.last_name].filter(Boolean).join(" ");
          if (name) f.set("name", name);
          if (c.data?.email) f.set("email", String(c.data.email));
          if (c.data?.phone) f.set("phone", String(c.data.phone));
          f.set("metadata[contact_id]", String(s.buyer_contact_id));
          const cust = await stripe("customers", secretKey, f);
          customerId = cust.id;
          await admin.from("contacts").update({ stripe_customer_id: customerId })
            .eq("id", s.buyer_contact_id);
        }
      }

      // Reuse an intent this invoice already has, so a retry after a failed
      // finalize can never charge the card twice. Succeeded or processing
      // means the money moved (or is moving): refuse, the ledger catches up
      // through finalize or the webhook.
      const priorId = s.stripe_payment_intent as string | null;
      if (priorId && priorId.startsWith("pi_")) {
        const prior = await stripe("payment_intents/" + encodeURIComponent(priorId), secretKey, undefined, "GET").catch(() => null);
        if (prior) {
          if (prior.status === "processing") {
            return json({ error: "This invoice already has a card payment in progress. Reload the invoice before charging again." }, 409, cors);
          }
          if (prior.status === "succeeded") {
            // On the books and still a balance: a refund reopened the invoice
            // (owner rule 2026-08-21), so a fresh charge is legitimate. Not on
            // the books yet: finalize or the webhook is about to record it, and
            // charging again would take the money twice.
            const onBooks = await admin.from("pos_payments").select("id").eq("stripe_object_id", prior.id).limit(1);
            if (!onBooks.data || !onBooks.data.length) {
              return json({ error: "This invoice already has a card payment recorded with Stripe. Reload the invoice before charging again." }, 409, cors);
            }
          }
          const reusable = ["requires_payment_method", "requires_confirmation", "requires_action"].includes(prior.status);
          if (reusable && Number(prior.amount) === balance) {
            return json({ client_secret: prior.client_secret, amount_cents: balance, id: prior.id, reused: true }, 200, cors);
          }
          if (reusable) {
            // The balance moved since (fee removed, partial cash): retire it.
            await stripe("payment_intents/" + encodeURIComponent(priorId) + "/cancel", secretKey).catch(() => null);
          }
        }
      }
      const f = new URLSearchParams();
      f.set("amount", String(balance));
      f.set("currency", "usd");
      f.set("payment_method_types[]", "card");
      f.set("description", "Invoice " + saleId.slice(0, 8).toUpperCase());
      f.set("metadata[sale_id]", saleId);
      f.set("metadata[source]", "pos-manual");
      if (customerId) {
        f.set("customer", customerId);
        // Keep the card for later, per the owner's card-on-file model.
        f.set("setup_future_usage", "off_session");
      }
      const pi = await stripe("payment_intents", secretKey, f);
      await admin.from("pos_sales")
        .update({ stripe_payment_intent: pi.id, stripe_customer_id: customerId })
        .eq("id", saleId);
      return json({ client_secret: pi.client_secret, amount_cents: balance, id: pi.id }, 200, cors);
    }

    if (action === "finalize") {
      const piId = str(body.payment_intent_id);
      if (!piId.startsWith("pi_")) return json({ error: "Bad payment reference" }, 400, cors);

      // Ask STRIPE what happened. Never trust the browser's word for it.
      const pi = await stripe("payment_intents/" + encodeURIComponent(piId), secretKey, undefined, "GET");
      if (pi.status !== "succeeded") {
        return json({ error: "That payment did not complete (" + pi.status + ")." }, 409, cors);
      }
      if (str(pi.metadata?.sale_id).toLowerCase() !== saleId) {
        return json({ error: "That payment belongs to a different invoice." }, 409, cors);
      }
      const out = await recordSucceeded(admin, url, serviceKey, saleId, s, pi,
        "Card payment (keyed at the desk)");
      return json(out, 200, cors);
    }

    // ── charge-saved: run a card already on file, customer not present ────
    // The card is charged off_session, which is what it means to charge
    // somebody who is not standing there. Stripe may still demand the
    // cardholder authenticate, and when it does the honest answer is "it did
    // not go through, ask them", not a silent retry.
    if (action === "charge-saved") {
      const pm = str(body.payment_method_id);
      if (!PM_RE.test(pm)) return json({ error: "Which card?" }, 400, cors);
      if (balance <= 0) return json({ error: "Nothing is owed on this invoice." }, 409, cors);
      if (balance < 50) return json({ error: "Card minimum is $0.50." }, 409, cors);
      if (!s.buyer_contact_id) return json({ error: "A walk-in sale has nobody to charge. Use the card field." }, 409, cors);

      // A card belongs to the FAMILY. Carlton's sits on Emerson's contact,
      // because that is who his email resolved to when he paid, and it is the
      // card that pays for Luther. So the customer charged is the card's own
      // owner, and what is verified is that the owner is in the buyer's
      // household - not that the buyer happens to hold the card.
      const owned = await stripe("payment_methods/" + encodeURIComponent(pm), secretKey, undefined, "GET");
      const cardCustomer = str(owned.customer);
      if (!cardCustomer) return json({ error: "That card is not on file with anybody." }, 409, cors);

      // Everyone the buyer shares a household with, plus the buyer.
      const kin = await admin.rpc("household_contact_ids", { p_contact: s.buyer_contact_id });
      if (kin.error) console.error("household ids", kin.error);
      const allowed = new Set<string>([String(s.buyer_contact_id)]);
      for (const row of (kin.data ?? []) as { contact_id: string }[]) allowed.add(String(row.contact_id));

      const holders = await admin.from("contacts")
        .select("id,stripe_customer_id").in("id", [...allowed]).eq("stripe_customer_id", cardCustomer);
      if (!holders.data || !holders.data.length) {
        // Not a refusal about the card being bad - a refusal about it being
        // somebody else's. Naming any pm_ id must never charge a stranger.
        return json({ error: "That card belongs to somebody outside this household." }, 409, cors);
      }
      const customerId = cardCustomer;

      // Same double-charge guard as intent: an invoice that already has a
      // live or recorded payment intent does not get a second one.
      const priorId = str(s.stripe_payment_intent);
      if (priorId.startsWith("pi_")) {
        const prior = await stripe("payment_intents/" + encodeURIComponent(priorId), secretKey, undefined, "GET").catch(() => null);
        if (prior) {
          if (prior.status === "processing") {
            return json({ error: "This invoice already has a card payment in progress. Reload the invoice before charging again." }, 409, cors);
          }
          if (prior.status === "succeeded") {
            const onBooks = await admin.from("pos_payments").select("id").eq("stripe_object_id", prior.id).limit(1);
            if (!onBooks.data || !onBooks.data.length) {
              return json({ error: "This invoice already has a card payment recorded with Stripe. Reload the invoice before charging again." }, 409, cors);
            }
          }
          if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(prior.status)) {
            await stripe("payment_intents/" + encodeURIComponent(priorId) + "/cancel", secretKey).catch(() => null);
          }
        }
      }

      const f = new URLSearchParams();
      f.set("amount", String(balance));
      f.set("currency", "usd");
      f.set("customer", customerId);
      f.set("payment_method", pm);
      f.set("off_session", "true");
      f.set("confirm", "true");
      f.set("description", "Invoice " + saleId.slice(0, 8).toUpperCase());
      f.set("metadata[sale_id]", saleId);
      f.set("metadata[source]", "pos-card-on-file");
      let pi: Record<string, any>;
      try {
        // The key is the sale plus the amount: pressing the button twice for
        // the same balance returns the FIRST charge instead of making another.
        pi = await stripe("payment_intents", secretKey, f, "POST", "cof-" + saleId + "-" + balance);
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        return json({ error: "The card was declined: " + msg }, 402, cors);
      }
      await admin.from("pos_sales")
        .update({ stripe_payment_intent: pi.id, stripe_customer_id: customerId })
        .eq("id", saleId);
      if (pi.status !== "succeeded") {
        return json({
          error: pi.status === "requires_action"
            ? "The bank wants the cardholder to approve this one. Ask them to pay from the invoice link, or take the card in person."
            : "The card did not go through (" + pi.status + ").",
        }, 402, cors);
      }
      const out = await recordSucceeded(admin, url, serviceKey, saleId, s, pi,
        "Card on file (charged at the desk)");
      return json(out, 200, cors);
    }

    return json({ error: "Unknown action" }, 400, cors);
  } catch (e) {
    console.error("pos-charge error", e);
    return json({ error: (e as Error)?.message || "Card charge failed." }, 500, cors);
  }
});
