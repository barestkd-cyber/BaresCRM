// ===========================================================================
// Supabase Edge Function: receipt-view
// ---------------------------------------------------------------------------
// PUBLIC view-only invoice/receipt page, addressed by bearer token:
//   GET /functions/v1/receipt-view?t=<view_token>
//
// Linked from receipt emails ("View receipt"). LIVE view: renders the
// invoice's current state on every load, so a partial payment recorded after
// the email was sent shows up when the parent opens the link. This page is
// also where "Pay online" will live once Stripe ships.
//
// HARD RULES:
//   1. Deploy with --no-verify-jwt (public by design). The 128-bit token is
//      the entire gate; token grants THIS one invoice, nothing else.
//   2. Read-only. No mutations, ever. Cache-Control: no-store.
//   3. Never include contact details beyond the buyer's display name.
//   4. Keep brand identity aligned with RECEIPT_BRANDS in BaresCRM/index.html.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy receipt-view --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LEGAL_ENTITY = "Grizzly Martial Arts and Fitness LLC";
const BRANDS: Record<string, { name: string; dba: boolean; logo: string | null }> = {
  btkd: { name: "Bares Taekwondo Fitness", dba: true, logo: "https://barestkd.fit/assets/img/logo.png" },
  gbs: { name: "Grizzly Business Systems", dba: true, logo: "https://crm.barestkd.fit/gbs-logo.png" },
  gmaf: { name: LEGAL_ENTITY, dba: false, logo: null },
};

const esc = (v: unknown) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const money = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#f2f3f5;margin:0;padding:18px 10px}
  .card{background:#fff;max-width:460px;margin:0 auto;border-radius:12px;box-shadow:0 2px 14px rgba(0,0,0,.08);padding:22px 18px}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  td{padding:6px 4px;border-bottom:1px solid #eee;vertical-align:top}
  .r{text-align:right;white-space:nowrap}.q{width:26px;color:#777}
  .tot td{border-bottom:none;padding:4px}
  .g td{font-weight:bold;border-top:1.5px solid #111;padding-top:8px;font-size:15px}
  .closed{color:#6A727E}.stamp{display:inline-block;border:3px solid;border-radius:6px;padding:2px 16px;font-weight:bold;font-size:19px;letter-spacing:3px}
  .paid{color:#1e9e54}.due{color:#c8102e}
  .meta{font-size:11.5px;color:#555;margin-top:14px;line-height:1.7}
  .legal{font-size:10px;color:#888;text-align:center;margin-top:18px;line-height:1.6}
</style></head><body>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return page("Receipt", `<div class="card">GET only.</div>`, 405);
  const token = (new URL(req.url).searchParams.get("t") ?? "").trim();
  if (!/^[0-9a-f]{32}$/i.test(token)) {
    return page("Receipt not found", `<div class="card"><b>Receipt not found.</b><br>This link looks incomplete — ask the studio to resend it.</div>`, 404);
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const saleRes = await admin.from("pos_sales").select("*").eq("view_token", token).single();
    if (saleRes.error || !saleRes.data) {
      return page("Receipt not found", `<div class="card"><b>Receipt not found.</b><br>This link may have been replaced — ask the studio to resend it.</div>`, 404);
    }
    const s = saleRes.data;
    const [linesRes, paysRes, buyerRes] = await Promise.all([
      admin.from("pos_sale_lines").select("*").eq("sale_id", s.id),
      admin.from("pos_payments").select("kind,amount_cents,occurred_at,note").eq("sale_id", s.id).order("occurred_at"),
      s.buyer_contact_id
        ? admin.from("contacts").select("first_name,last_name").eq("id", s.buyer_contact_id).single()
        : Promise.resolve({ data: null, error: null } as { data: { first_name: string; last_name: string } | null; error: null }),
    ]);
    const lines = linesRes.data ?? [];
    const pays = paysRes.data ?? [];
    const paidNet = pays.reduce((a, p) => a + p.amount_cents, 0);
    const balance = Math.max(s.total_cents - paidNet, 0);
    const paid = s.status === "paid";
    const closed = s.status === "closed";
    const buyerName = buyerRes.data ? `${buyerRes.data.first_name ?? ""} ${buyerRes.data.last_name ?? ""}`.trim() : null;

    const brand = BRANDS[s.brand as string] ?? BRANDS.btkd;
    const legalLine = brand.dba ? `${LEGAL_ENTITY} · DBA ${brand.name}` : LEGAL_ENTITY;
    const shortId = String(s.id).slice(0, 8).toUpperCase();

    const rows = lines.map((l) =>
      `<tr><td class="q">${l.qty ?? 1}</td><td>${esc(l.label)}</td><td class="r">${money(l.line_total_cents)}</td></tr>`).join("");

    const payRows = pays.length
      ? `<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#999;margin:16px 0 4px">Payments</div>
         <table>${pays.map((p) =>
           `<tr><td>${esc(new Date(p.occurred_at).toLocaleDateString("en-US"))}</td>
            <td style="color:#777;font-size:12px">${esc(p.note ?? p.kind)}</td>
            <td class="r"${p.amount_cents < 0 ? ' style="color:#c8102e"' : ""}>${p.amount_cents < 0 ? "−" : ""}${money(Math.abs(p.amount_cents))}</td></tr>`).join("")}
         </table>`
      : "";

    const body = `<div class="card">
      ${brand.logo
        ? `<div style="text-align:center;margin-bottom:6px"><img src="${brand.logo}" alt="${esc(brand.name)}" style="max-width:230px;max-height:90px"></div>`
        : `<h1 style="font-size:18px;text-align:center;margin:0 0 2px">${esc(brand.name)}</h1>`}
      <div style="font-size:11px;color:#555;text-align:center;margin-bottom:10px;line-height:1.5">
        1901 Deerbrook Dr, Tyler, TX 75703<br>903-561-2966 · barestkd.fit</div>
      <div style="text-align:center;margin:12px 0"><span class="stamp ${paid ? "paid" : closed ? "closed" : "due"}">${paid ? "PAID" : closed ? "CLOSED" : "BALANCE DUE"}</span></div>
      <table>${rows}</table>
      <table class="tot">
        <tr><td>Subtotal</td><td class="r">${money(s.subtotal_cents)}</td></tr>
        ${s.discount_cents ? `<tr><td>Discount</td><td class="r">−${money(s.discount_cents)}</td></tr>` : ""}
        ${s.admin_fee_cents ? `<tr><td>Admin fee</td><td class="r">${money(s.admin_fee_cents)}</td></tr>` : ""}
        <tr><td>Sales tax</td><td class="r">${money(s.tax_cents)}</td></tr>
        <tr class="g"><td>${paid ? "Total paid" : "Total"}</td><td class="r">${money(s.total_cents)}</td></tr>
        ${!paid && !closed && paidNet > 0 ? `<tr><td>Paid so far</td><td class="r">${money(paidNet)}</td></tr>
          <tr><td style="font-weight:bold;color:#c8102e">Balance due</td><td class="r" style="font-weight:bold;color:#c8102e">${money(balance)}</td></tr>` : ""}
      </table>
      ${payRows}
      <div class="meta">
        ${buyerName ? `Sold to: ${esc(buyerName)}<br>` : ""}
        ${paid ? `Paid by: ${esc(s.tender_method ?? "—")}` : closed ? "Closed — no balance due" : "Payment: not yet received"}<br>
        Date: ${esc(s.sale_date)}<br>
        Invoice: ${shortId}</div>
      <div class="legal">${esc(legalLine)}<br>Thank you!</div>
    </div>`;

    return page((paid ? "Receipt " : "Invoice ") + shortId, body);
  } catch (e) {
    console.error("receipt-view error", e);
    return page("Error", `<div class="card">Something went wrong loading this receipt. Try again in a minute.</div>`, 500);
  }
});
