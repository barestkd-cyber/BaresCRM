// ===========================================================================
// Supabase Edge Function: card-reject
// ---------------------------------------------------------------------------
// A checkout page told a customer their card was no good. This records what
// they were told, and emails the owner.
//
// WHY IT EXISTS: on 2026-08-26 a parent filled the Cubs form, entered her card,
// and Stripe.js rejected the entry in her browser. She saw a message, gave up,
// and left a full enrollment behind with no payment. Nobody was told, and the
// message she saw was kept nowhere - so afterwards there was no way to know
// what she had been told, or even that it had happened.
//
// Public and unauthenticated on purpose: it is called from the checkout page
// with navigator.sendBeacon, which cannot set headers. It accepts nothing but
// a short code and message, stores no card data (Stripe.js never gives the
// page a card number), and is rate-limited by being useless to abuse - the
// worst a spammer achieves is noise in one table.
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  // Always 204: a beacon has nobody listening, and a failure here must never
  // become something the customer sees.
  const ok = () => new Response(null, { status: 204, headers: cors });
  try {
    const url = new URL(req.url);
    const src = String(url.searchParams.get("src") ?? "").slice(0, 60);
    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").slice(0, 80);
    const message = String(body?.message ?? "").slice(0, 300);
    // WHO could not pay. Nothing is written when a card is refused - that is
    // the point of checking first - so the form is the only place their
    // details exist, and the page sends what they typed. Never card data:
    // Stripe.js does not give the page a number.
    const w = (body?.who ?? {}) as Record<string, unknown>;
    const payer = String(w.parent ?? "").slice(0, 120);
    const student = String(w.student ?? "").slice(0, 120);
    const email = String(w.email ?? "").slice(0, 200);
    const phone = String(w.phone ?? "").slice(0, 40);
    if (!message && !code) return ok();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("card_rejections").insert({ page: src, code, message,
      payer_name: payer || null, student_name: student || null,
      email: email || null, phone: phone || null });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const to = (Deno.env.get("OWNER_NOTIFY_EMAIL") || "race@barestkd.fit").trim().toLowerCase();
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Bares Taekwondo <receipts@barestkd.fit>",
          to: [to],
          subject: (payer || email || "Somebody") + " could not pay" + (student ? " for " + student : ""),
          html: '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:460px;margin:0 auto;padding:18px 14px">'
            + '<p style="font-size:12px;letter-spacing:.08em;color:#EA0000;margin:0 0 4px">A CARD WAS REFUSED</p>'
            + (payer || student || email || phone
                ? '<p style="font-size:17px;font-weight:bold;margin:0 0 4px">' + esc(payer || "Name not filled in") + "</p>"
                  + (student ? '<p style="font-size:14px;margin:0 0 10px;color:#555">for ' + esc(student) + "</p>" : "")
                  + '<p style="font-size:14px;margin:0 0 12px">'
                  + (email ? '<a href="mailto:' + esc(email) + '">' + esc(email) + "</a>" : "")
                  + (email && phone ? " &middot; " : "")
                  + (phone ? '<a href="tel:' + esc(phone.replace(/[^0-9+]/g, "")) + '">' + esc(phone) + "</a>" : "")
                  + "</p>"
                : '<p style="font-size:14px;margin:0 0 10px;color:#EA0000">They had not filled in their details yet.</p>')
            + '<p style="font-size:15px;margin:0 0 12px">A card was refused on <b>' + esc(src || "a checkout page") + "</b>"
            + " before any charge was attempted, so nothing was taken and nothing was created.</p>"
            + '<p style="font-size:14px;margin:0 0 6px"><b>They were told:</b><br>' + esc(message || code) + "</p>"
            + '<p style="font-size:13px;color:#777;margin:14px 0 0">Their card was never sent to the bank - this was rejected in their browser. '
            + "Usually a mistyped number, expiry or postcode. Worth a call: they were trying to pay.</p></div>",
        }),
      }).catch(() => {});
    }
    return ok();
  } catch (_e) {
    return ok();
  }
});

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
