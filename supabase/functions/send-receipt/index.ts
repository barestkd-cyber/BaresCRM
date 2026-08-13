// ===========================================================================
// Supabase Edge Function: send-receipt
// ---------------------------------------------------------------------------
// Emails a receipt (paid) or invoice (unpaid) for one pos_sales row.
//
// HARD RULES:
//   1. STAFF-ONLY. Deployed WITH JWT verification (no --no-verify-jwt), and
//      additionally checks is_staff() with the caller's own token. A valid
//      login that is not staff gets 403.
//   2. The ledger row is the single source of truth: everything rendered is
//      read from pos_sales/pos_sale_lines by id. The client sends ONLY
//      { sale_id, to } — never amounts, names, or line items.
//   3. Brand identity follows the sale's brand; both DBAs are registered
//      (2026-08-13), and the legal line always names the LLC.
//   4. Send via Resend (project secret RESEND_API_KEY, same as trial-booking).
//      From-address must stay on the Resend-verified domain barestkd.fit.
//   5. On success, stamp receipt_email + receipt_sent_at on the sale
//      (service role) so the CRM shows the receipt went out.
//
// Deploy, from the BaresCRM repo root (one-time link first):
//   supabase link --project-ref akdncbzxiwvihfcyijvm
//   supabase functions deploy send-receipt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://crm.barestkd.fit"];

const REPLY_TO = "race@barestkd.fit";
const LEGAL_ENTITY = "Grizzly Martial Arts and Fitness LLC";

// Brand catalog — keep aligned with RECEIPT_BRANDS in BaresCRM/index.html.
const BRANDS: Record<string, { name: string; dba: boolean; logo: string | null }> = {
  btkd: { name: "Bares Taekwondo Fitness", dba: true, logo: "https://barestkd.fit/assets/img/logo.png" },
  gbs: { name: "Grizzly Business Systems", dba: true, logo: "https://crm.barestkd.fit/gbs-logo.png" },
  gmaf: { name: LEGAL_ENTITY, dba: false, logo: null },
};

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const esc = (v: unknown) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const money = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "RESEND_API_KEY not configured" }, 500, cors);

    // ── caller must be staff ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Not signed in" }, 401, cors);
    const { data: staffOk, error: staffErr } = await caller.rpc("is_staff");
    if (staffErr || staffOk !== true) return json({ error: "Staff only" }, 403, cors);

    // ── input: sale id + recipient, nothing else trusted ────────────────────
    const body = await req.json().catch(() => ({}));
    const saleId = String(body.sale_id ?? "").trim();
    const to = String(body.to ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleId)) {
      return json({ error: "Bad sale_id" }, 400, cors);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 200) {
      return json({ error: "Bad recipient email" }, 400, cors);
    }

    // ── load the sale from the ledger (service role) ────────────────────────
    const admin = createClient(url, serviceKey);
    const [saleRes, linesRes, paysRes] = await Promise.all([
      admin.from("pos_sales").select("*").eq("id", saleId).single(),
      admin.from("pos_sale_lines").select("*").eq("sale_id", saleId),
      admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId),
    ]);
    if (saleRes.error || !saleRes.data) return json({ error: "Sale not found" }, 404, cors);
    const s = saleRes.data;
    const lines = linesRes.data ?? [];
    const paidNet = (paysRes.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
    const balance = Math.max(s.total_cents - paidNet, 0);
    const paid = s.status === "paid";

    const brand = BRANDS[s.brand as string] ?? BRANDS.btkd;
    const headName = brand.name;
    const legalLine = brand.dba ? `${LEGAL_ENTITY} · DBA ${brand.name}` : LEGAL_ENTITY;
    const shortId = saleId.slice(0, 8).toUpperCase();

    // ── email HTML: table-based, inline styles, hosted logo ────────────────
    const rows = lines.map((l) =>
      `<tr>
        <td style="padding:6px 4px;border-bottom:1px solid #eee;color:#777;width:26px">${l.qty ?? 1}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #eee">${esc(l.label)}</td>
        <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${money(l.line_total_cents)}</td>
      </tr>`).join("");

    const totals =
      `<tr><td></td><td style="padding:4px">Subtotal</td><td style="padding:4px;text-align:right">${money(s.subtotal_cents)}</td></tr>` +
      (s.discount_cents ? `<tr><td></td><td style="padding:4px">Discount</td><td style="padding:4px;text-align:right">−${money(s.discount_cents)}</td></tr>` : "") +
      (s.admin_fee_cents ? `<tr><td></td><td style="padding:4px">Admin fee</td><td style="padding:4px;text-align:right">${money(s.admin_fee_cents)}</td></tr>` : "") +
      `<tr><td></td><td style="padding:4px">Sales tax</td><td style="padding:4px;text-align:right">${money(s.tax_cents)}</td></tr>` +
      `<tr><td></td><td style="padding:7px 4px;font-weight:bold;border-top:1.5px solid #111;font-size:15px">${paid ? "Total paid" : "Total"}</td>
        <td style="padding:7px 4px;text-align:right;font-weight:bold;border-top:1.5px solid #111;font-size:15px">${money(s.total_cents)}</td></tr>` +
      (!paid && paidNet > 0
        ? `<tr><td></td><td style="padding:4px">Paid so far</td><td style="padding:4px;text-align:right">${money(paidNet)}</td></tr>
           <tr><td></td><td style="padding:4px;font-weight:bold;color:#c8102e">Balance due</td><td style="padding:4px;text-align:right;font-weight:bold;color:#c8102e">${money(balance)}</td></tr>`
        : "");

    const stamp = paid
      ? `<div style="text-align:center;margin:14px 0"><span style="display:inline-block;border:3px solid #1e9e54;color:#1e9e54;border-radius:6px;padding:2px 16px;font-weight:bold;font-size:19px;letter-spacing:3px">PAID</span></div>`
      : `<div style="text-align:center;margin:14px 0"><span style="display:inline-block;border:3px solid #c8102e;color:#c8102e;border-radius:6px;padding:2px 16px;font-weight:bold;font-size:19px;letter-spacing:3px">BALANCE DUE</span></div>`;

    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:440px;margin:0 auto;padding:18px 14px">
        ${brand.logo
          ? `<div style="text-align:center;margin-bottom:6px"><img src="${brand.logo}" alt="${esc(headName)}" style="max-width:230px;max-height:90px"></div>`
          : `<h1 style="font-size:18px;text-align:center;margin:0 0 2px">${esc(headName)}</h1>`}
        <div style="font-size:11px;color:#555;text-align:center;margin-bottom:10px;line-height:1.5">
          1901 Deerbrook Dr, Tyler, TX 75703<br>903-561-2966 · barestkd.fit</div>
        ${stamp}
        <table style="width:100%;border-collapse:collapse;font-size:13px">${rows}${totals}</table>
        <div style="font-size:11.5px;color:#555;margin-top:14px;line-height:1.7">
          ${paid ? `Paid by: ${esc(s.tender_method ?? "—")}` : "Payment: not yet received"}<br>
          Date: ${esc(s.sale_date)}<br>
          Invoice: ${shortId}</div>
        <div style="font-size:10px;color:#888;text-align:center;margin-top:18px;line-height:1.6">
          ${esc(legalLine)}<br>Thank you!</div>
      </div>`;

    // ── send via Resend ─────────────────────────────────────────────────────
    const subject = paid
      ? `Receipt ${shortId} — ${headName}`
      : `Invoice ${shortId} (${money(balance)} due) — ${headName}`;
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${headName} <receipts@barestkd.fit>`,
        to: [to],
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    });
    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(() => "");
      console.error("resend failed", resendRes.status, detail);
      return json({ error: "Email send failed (" + resendRes.status + ")" }, 502, cors);
    }

    // ── stamp the sale so the CRM shows it went out ────────────────────────
    const upd = await admin.from("pos_sales")
      .update({ receipt_email: to, receipt_sent_at: new Date().toISOString() })
      .eq("id", saleId);
    if (upd.error) console.error("receipt stamp failed", upd.error); // email DID send — report success

    return json({ ok: true, to, paid }, 200, cors);
  } catch (e) {
    console.error("send-receipt error", e);
    return json({ error: "Internal error" }, 500, cors);
  }
});
