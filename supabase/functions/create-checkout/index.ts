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
//   4. No card data ever touches us — Stripe's hosted page collects it. That
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
      .select("id,status,brand,total_cents,sale_date,buyer_contact_id")
      .eq("view_token", token).single();
    if (saleRes.error || !saleRes.data) return json({ error: "Invoice not found" }, 404, h);
    const s = saleRes.data;

    if (s.status === "paid") return json({ error: "This invoice is already paid." }, 409, h);
    if (s.status === "closed") return json({ error: "This invoice is closed — nothing is owed." }, 409, h);
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

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("client_reference_id", s.id);
    form.set("success_url", `${SITE}/invoice/?t=${token}&paid=1`);
    form.set("cancel_url", `${SITE}/invoice/?t=${token}`);
    form.set("payment_method_types[0]", "card");
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(balance));
    form.set("line_items[0][price_data][product_data][name]", `${brandName} — Invoice ${shortId}`);
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
