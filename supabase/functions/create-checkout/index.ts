// ===========================================================================
// Supabase Edge Function: create-checkout
// ---------------------------------------------------------------------------
// Turns an unpaid invoice into a Stripe Checkout Session and hands back the
// hosted payment URL. Called by the customer-facing invoice page at
// https://www.barestkd.fit/invoice/?t=<view_token>
//
// HARD RULES:
//   1. PUBLIC endpoint (deploy --no-verify-jwt). The 128-bit view_token is the
//      only credential; it grants THIS one invoice and nothing else.
//   2. The client sends ONLY the token. The amount is ALWAYS re-derived here
//      from the ledger (total − payments). A browser can never name its price.
//   3. Refuses anything that is not currently unpaid with a positive balance.
//   4. No card data ever touches us - Stripe's hosted page collects it. That
//      is what keeps BaresTKD out of PCI scope.
//   5. No SDK: plain fetch to the Stripe REST API, form-encoded.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy create-checkout --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://www.barestkd.fit";
const ALLOWED_ORIGINS = [SITE, "https://barestkd.fit"];

const BRAND_NAMES: Record<string, string> = {
  btkd: "Bares Taekwondo Fitness",
  gbs: "Grizzly Business Systems",
  gmaf: "Grizzly Martial Arts & Fitness LLC",
};

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: unknown, status: number, h: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, h);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Payments are not configured yet." }, 503, h);

    const body = await req.json().catch(() => ({}));
    const token = String(body.t ?? "").trim();
    if (!/^[0-9a-f]{32}$/i.test(token)) return json({ error: "Bad link" }, 400, h);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const saleRes = await admin.from("pos_sales")
      .select("id,status,brand,total_cents,sale_date,buyer_contact_id,stripe_customer_id")
      .eq("view_token", token).single();
    if (saleRes.error || !saleRes.data) return json({ error: "Invoice not found" }, 404, h);
    const s = saleRes.data;

    // ── INLINE CARD MODE ────────────────────────────────────────────────────
    // The invoice page now collects the card in a Stripe Elements field
    // instead of bouncing to a hosted page. Two extra actions serve it:
    //   config   -> the publishable key, so nothing is hardcoded in the page
    //   intent   -> a PaymentIntent for the ledger balance
    //   finalize -> verify with Stripe, then record the money
    // The hosted-session path below stays as a fallback and for anything that
    // still links to it.
    const action = String(body.action ?? "").trim();
    if (action === "config") {
      const pk = Deno.env.get("STRIPE_PUBLISHABLE_KEY");
      if (!pk) return json({ error: "Card payments are not configured yet." }, 503, h);
      return json({ publishable_key: pk }, 200, h);
    }

    if (s.status === "paid") return json({ error: "This invoice is already paid." }, 409, h);
    if (s.status === "closed") return json({ error: "This invoice is closed - nothing is owed." }, 409, h);
    if (s.status !== "unpaid") return json({ error: "This invoice can't be paid online right now." }, 409, h);

    // Balance is OUR number, from OUR ledger. Never the client's.
    const paysRes = await admin.from("pos_payments").select("amount_cents").eq("sale_id", s.id);
    const paidNet = (paysRes.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
    const balance = s.total_cents - paidNet;
    if (balance <= 0) return json({ error: "Nothing is owed on this invoice." }, 409, h);
    if (balance < 50) return json({ error: "This balance is below the minimum card payment." }, 409, h);

    // Prefill the customer's email when we know it (Stripe shows it read-only
    // on the hosted page and uses it for the Stripe receipt).
    let email: string | null = null;
    if (s.buyer_contact_id) {
      const c = await admin.from("contacts").select("email").eq("id", s.buyer_contact_id).maybeSingle();
      email = (c.data?.email ?? null) || null;
    }

    const brandName = BRAND_NAMES[s.brand as string] ?? BRAND_NAMES.btkd;
    const shortId = String(s.id).slice(0, 8).toUpperCase();

    // Inline card: hand back an intent for the page to confirm, or verify one
    // that already cleared. Same balance, same guards as the hosted path.
    if (action === "intent" || action === "finalize") {
      const stripeApi = async (path: string, f?: URLSearchParams, method = "POST") => {
        const r = await fetch("https://api.stripe.com/v1/" + path, {
          method,
          headers: { "Authorization": "Bearer " + stripeKey, "Content-Type": "application/x-www-form-urlencoded" },
          body: method === "POST" ? (f ?? new URLSearchParams()) : undefined,
        });
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b?.error?.message || ("Stripe " + r.status));
        return b;
      };

      if (action === "intent") {
        // Attach a Stripe customer and keep the card, same as the desk path
        // (pos-charge). Without this, a down payment collected by emailed
        // link left NO card on file, and the whole point of a membership
        // down payment is being able to charge the rest later. Walk-ins with
        // no contact attached still pay fine; there is just nobody to save
        // the card against.
        let customerId = (s.stripe_customer_id as string | null) ?? null;
        if (!customerId && s.buyer_contact_id) {
          const c = await admin.from("contacts")
            .select("first_name,last_name,email,phone,stripe_customer_id")
            .eq("id", s.buyer_contact_id).maybeSingle();
          customerId = c.data?.stripe_customer_id ?? null;
          if (!customerId) {
            const cf = new URLSearchParams();
            const nm = [c.data?.first_name, c.data?.last_name].filter(Boolean).join(" ");
            if (nm) cf.set("name", nm);
            if (c.data?.email) cf.set("email", String(c.data.email));
            if (c.data?.phone) cf.set("phone", String(c.data.phone));
            cf.set("metadata[contact_id]", String(s.buyer_contact_id));
            const cust = await stripeApi("customers", cf);
            customerId = cust.id;
            await admin.from("contacts").update({ stripe_customer_id: customerId })
              .eq("id", s.buyer_contact_id);
          }
          await admin.from("pos_sales").update({ stripe_customer_id: customerId }).eq("id", s.id);
        }

        const f = new URLSearchParams();
        f.set("amount", String(balance));
        f.set("currency", "usd");
        f.set("payment_method_types[]", "card");
        f.set("description", `${brandName} - Invoice ${shortId}`);
        f.set("metadata[sale_id]", s.id);
        f.set("metadata[source]", "invoice-page");
        if (email) f.set("receipt_email", email);
        if (customerId) {
          f.set("customer", customerId);
          f.set("setup_future_usage", "off_session");
        }
        const pi = await stripeApi("payment_intents", f);
        await admin.from("pos_sales").update({ stripe_payment_intent: pi.id }).eq("id", s.id);
        return json({ client_secret: pi.client_secret, payment_intent_id: pi.id, amount_cents: balance }, 200, h);
      }

      const piId = String(body.payment_intent_id ?? "");
      if (!piId.startsWith("pi_")) return json({ error: "Bad payment reference." }, 400, h);
      const pi = await stripeApi("payment_intents/" + encodeURIComponent(piId), undefined, "GET");
      if (pi.status !== "succeeded") return json({ error: "That payment did not complete." }, 409, h);
      if (String(pi.metadata?.sale_id ?? "") !== s.id) return json({ error: "That payment is for a different invoice." }, 409, h);
      const amt = Number(pi.amount_received ?? pi.amount ?? 0);
      if (amt <= 0) return json({ error: "No amount on that payment." }, 409, h);

      const seen = await admin.from("pos_payments")
        .select("id").eq("sale_id", s.id).eq("stripe_object_id", pi.id).maybeSingle();
      if (!seen.data) {
        const ins = await admin.from("pos_payments").insert({
          sale_id: s.id, kind: "charge", amount_cents: amt, method: "card",
          stripe_object_id: pi.id, note: "Card payment (invoice page)",
        });
        if (ins.error) throw ins.error;
      }
      const pays2 = await admin.from("pos_payments").select("amount_cents").eq("sale_id", s.id);
      const net = (pays2.data ?? []).reduce((a: number, p: { amount_cents: number }) => a + p.amount_cents, 0);
      let nowPaid = false;
      if (net >= s.total_cents && s.status !== "paid") {
        const upd = await admin.from("pos_sales").update({
          status: "paid", tender_method: "card",
          confirmed_at: new Date().toISOString(), stripe_payment_intent: pi.id,
        }).eq("id", s.id);
        if (!upd.error) {
          nowPaid = true;
          // Receipt, exactly as the webhook would have sent it.
          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-receipt`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
                "Origin": "https://crm.barestkd.fit",
              },
              body: JSON.stringify({ sale_id: s.id, notify_owner: true }),
            });
          } catch (e) { console.error("receipt after inline pay", e); }
        }
      }
      return json({ ok: true, paid: nowPaid, amount_cents: amt }, 200, h);
    }

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("client_reference_id", s.id);
    form.set("success_url", `${SITE}/invoice/?t=${token}&paid=1`);
    form.set("cancel_url", `${SITE}/invoice/?t=${token}`);
    form.set("payment_method_types[0]", "card");
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(balance));
    form.set("line_items[0][price_data][product_data][name]", `${brandName} - Invoice ${shortId}`);
    form.set("line_items[0][price_data][product_data][description]", `Invoice dated ${s.sale_date}`);
    form.set("metadata[sale_id]", s.id);
    form.set("metadata[short_id]", shortId);
    form.set("payment_intent_data[description]", `${brandName} invoice ${shortId}`);
    form.set("payment_intent_data[metadata][sale_id]", s.id);
    // 30-minute window keeps abandoned sessions from lingering.
    form.set("expires_at", String(Math.floor(Date.now() / 1000) + 30 * 60));
    if (email) form.set("customer_email", email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // Same invoice at the same balance reuses the session instead of
        // spawning a new one every time the customer taps Pay.
        "Idempotency-Key": `checkout_${s.id}_${balance}`,
      },
      body: form.toString(),
    });
    const session = await res.json();
    if (!res.ok || !session?.url) {
      console.error("stripe session create failed", res.status, session);
      return json({ error: "Could not start checkout. Please try again." }, 502, h);
    }

    // Remember the session so the webhook can tie the payment back here even
    // if metadata were ever missing.
    const upd = await admin.from("pos_sales")
      .update({ stripe_session_id: session.id }).eq("id", s.id);
    if (upd.error) console.error("session id stamp failed", upd.error);

    return json({ url: session.url, amount_cents: balance }, 200, h);
  } catch (e) {
    console.error("create-checkout error", e);
    return json({ error: "Something went wrong starting checkout." }, 500, h);
  }
});
