// ===========================================================================
// Supabase Edge Function: receipt-view
// ---------------------------------------------------------------------------
// PUBLIC view-only invoice/receipt page, addressed by bearer token:
//   GET /functions/v1/receipt-view?t=<view_token>
//
// Design contract (owner rule 2026-08-15): this page renders THE SAME CARD
// the CRM shows and prints — keep its layout aligned with buildInvoiceCard()
// in BaresCRM/index.html whenever that changes. Live view: re-renders current
// state every load (a partial payment recorded after the email was sent shows
// up here). This is also where "Pay online" will live once Stripe ships.
//
// HARD RULES:
//   1. Deploy with --no-verify-jwt (public by design). The 128-bit token is
//      the entire gate; a token grants THIS one invoice, nothing else.
//   2. Read-only. No mutations, ever. Cache-Control: no-store.
//   3. Never include contact details beyond the buyer's display name.
//   4. Explicit charset everywhere — this page previously shipped once as
//      plain text with mojibake; the meta tag AND the header both declare
//      UTF-8 HTML now.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy receipt-view --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LEGAL_ENTITY = "Grizzly Martial Arts & Fitness LLC";
const BRANDS: Record<string, { name: string; dba: boolean; logo: string | null; logoDark: string | null }> = {
  btkd: { name: "Bares Taekwondo Fitness", dba: true, logo: "https://barestkd.fit/assets/img/logo.png", logoDark: "https://barestkd.fit/assets/img/logo-reverse.png" },
  gbs: { name: "Grizzly Business Systems", dba: true, logo: "https://crm.barestkd.fit/gbs-logo.png", logoDark: null },
  gmaf: { name: LEGAL_ENTITY, dba: false, logo: null, logoDark: null },
};

const esc = (v: unknown) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const fmtDate = (ymd: unknown) => {
  const p = String(ymd ?? "").slice(0, 10).split("-");
  return p.length === 3 ? p[1] + "-" + p[2] + "-" + p[0] : String(ymd ?? "");
};

const money = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Mirrors the CRM's largest-remainder allocateCents so per-line tax display
// reconciles exactly to the stored invoice totals.
function allocateCents(total: number, weights: number[]): number[] {
  total = Math.max(Math.round(total || 0), 0);
  const w = weights.map((x) => Math.max(Math.round(x || 0), 0));
  const sum = w.reduce((a, b) => a + b, 0);
  const out = w.map(() => 0);
  if (!total || !sum) return out;
  const exact = w.map((x) => total * x / sum);
  const floors = exact.map(Math.floor);
  let rem = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < rem; k++) floors[order[k % order.length].i] += 1;
  return floors;
}

const CSS = [
  "*{box-sizing:border-box}",
  "body{font-family:Arial,Helvetica,sans-serif;color:#1A1D23;background:#EEF1F4;margin:0;padding:16px 10px}",
  ".iv-wrap{max-width:560px;margin:0 auto}",
  ".iv-card{background:#fff;border:1px solid #E2E6EB;border-radius:14px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 10px rgba(16,18,22,.06)}",
  ".iv-brandrow{display:flex;gap:14px;align-items:center;padding:16px 16px 12px}",
  ".iv-logo{width:62px;height:62px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#15171C}",
  ".iv-logo img{max-width:76%;max-height:76%}",
  ".iv-logo.light{background:#fff;border:1px solid #E2E6EB}",
  ".iv-logo .ini{color:#fff;font-weight:700;font-size:19px}",
  ".iv-bname{font-weight:700;font-size:19px;line-height:1.25}",
  ".iv-line{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#6A727E;margin-top:4px}",
  ".iv-line svg{width:14px;height:14px;flex-shrink:0}",
  ".iv-div{border-top:1px solid #E2E6EB;margin:0 16px}",
  ".iv-daterow{display:flex;align-items:center;justify-content:space-between;gap:10px 12px;padding:12px 16px;flex-wrap:wrap}",
  ".iv-daterow>span:last-child{margin-left:auto}",
  ".iv-daterow .dt{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:600}",
  ".iv-daterow .dt svg{width:16px;height:16px;color:#6A727E}",
  ".chip{font-size:11px;font-weight:700;padding:2px 9px;border-radius:9px;text-transform:capitalize}",
  ".iv-cols{display:flex;padding:12px 16px;gap:14px}",
  ".iv-col{flex:1;min-width:0}",
  ".iv-col + .iv-col{border-left:1px solid #E2E6EB;padding-left:14px}",
  ".iv-k{font-size:10.5px;color:#6A727E;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:3px}",
  ".iv-v{font-weight:600;font-size:14.5px}",
  ".inv-scroll{overflow-x:auto}",
  "table.inv-tbl{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}",
  "@media(max-width:480px){table.inv-tbl{font-size:12px}.inv-tbl th,.inv-tbl td{padding:8px 5px}}",
  ".inv-tbl th{font-size:10.5px;text-transform:uppercase;letter-spacing:.6px;color:#6A727E;text-align:left;padding:6px 8px;border-bottom:1px solid #E2E6EB}",
  ".inv-tbl th,.inv-tbl td{padding:9px 7px;border-bottom:none;vertical-align:top;white-space:nowrap}",
  ".inv-tbl th.c-item,.inv-tbl td.c-item{white-space:normal;min-width:8em}",
  "table.inv-tbl{table-layout:auto}",
  ".inv-tbl th.c-qty,.inv-tbl th.c-price,.inv-tbl th.c-disc,.inv-tbl th.c-tax{width:1%;white-space:nowrap}",
  ".inv-tbl th.c-item{width:auto}",
  ".inv-tbl thead tr,.inv-tbl tbody tr{border-bottom:1px solid #EEF1F4}",
  ".inv-tbl tbody tr:last-child{border-bottom:none}",
      "@media(min-width:640px){.inv-tbl th,.inv-tbl td{padding:10px 9px}}",
  ".inv-tbl th:first-child,.inv-tbl td:first-child{padding-left:16px}",
  ".inv-tbl th:last-child,.inv-tbl td:last-child{padding-right:16px}",
  ".inv-tbl .r{text-align:right;white-space:nowrap}",
  ".inv-tbl td.qty{color:#6A727E}",
  ".trow{display:flex;justify-content:space-between;padding:3px 0;font-size:12.5px}",
  ".trow.m{color:#6A727E}",
  ".iv-total{background:#15171C;color:#fff;display:flex;justify-content:space-between;align-items:center;padding:15px 16px;border-radius:12px;margin:12px 16px 14px}",
  ".iv-total .lbl{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9AA1AC}",
  ".iv-total .amt{font-weight:700;font-size:25px}",
  ".iv-total.paid{background:#18A974}",
  ".iv-total.paid .lbl{color:#D8F3E6}",
  ".iv-stamp{display:inline-block;border:2.5px solid #18A974;color:#18A974;border-radius:7px;padding:2px 13px;font-weight:700;font-size:16px;letter-spacing:3px;transform:rotate(-6deg)}",
  ".iv-stamp.due{border-color:#c8102e;color:#c8102e}",
  ".iv-stamp.closed{border-color:#6A727E;color:#6A727E}",
  ".iv-stamp.part{border-color:#C98A1A;color:#C98A1A;font-size:12px;letter-spacing:1.5px}",
  ".iv-stampwrap{display:inline-flex;flex-direction:column;align-items:flex-end;gap:5px}",
  ".iv-stampsub{font-size:10.5px;color:#6A727E;letter-spacing:0;font-weight:600;white-space:nowrap}",
  ".iv-foot{background:#EEF1F4;color:#6A727E;font-size:12px;text-align:center;padding:9px;border-top:1px solid #E2E6EB;line-height:1.6}",
  ".iv-payhd{display:flex;align-items:center;gap:9px;padding:14px 16px 8px;font-weight:700;font-size:13px;letter-spacing:1.5px}",
  ".iv-payhd svg{width:17px;height:17px}",
  ".stampwrap{text-align:center;margin:16px 0}",
  ".stamp{display:inline-block;border:3px solid;border-radius:6px;padding:3px 18px;font-weight:700;font-size:22px;letter-spacing:4px;transform:rotate(-7deg)}",
  ".stamp.paid{color:#1e9e54}",
  ".lg-light{display:none}",
  "@media print{.iv-logo{background:#fff;border:1px solid #E2E6EB}.lg-dark{display:none}.lg-light{display:block}.iv-total,.iv-total.paid,.iv-foot{-webkit-print-color-adjust:exact;print-color-adjust:exact}}",
].join("");

const ICO = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3A19.5 19.5 0 0 1 5.1 13 19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2L8 9.5a16 16 0 0 0 6.5 6.5l1.1-1.1a2 2 0 0 1 2-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
};

function page(title: string, body: string, status = 200) {
  return new Response(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta name="robots" content="noindex, nofollow">' +
      "<title>" + esc(title) + "</title><style>" + CSS + "</style></head><body>" + body + "</body></html>",
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return page("Receipt", '<div class="iv-wrap"><div class="iv-card" style="padding:20px">GET only.</div></div>', 405);
  const token = (new URL(req.url).searchParams.get("t") ?? "").trim();
  if (!/^[0-9a-f]{32}$/i.test(token)) {
    return page("Receipt not found", '<div class="iv-wrap"><div class="iv-card" style="padding:20px"><b>Receipt not found.</b><br>This link looks incomplete — ask the studio to resend it.</div></div>', 404);
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const saleRes = await admin.from("pos_sales").select("*").eq("view_token", token).single();
    if (saleRes.error || !saleRes.data) {
      return page("Receipt not found", '<div class="iv-wrap"><div class="iv-card" style="padding:20px"><b>Receipt not found.</b><br>This link may have been replaced — ask the studio to resend it.</div></div>', 404);
    }
    const s = saleRes.data;
    const [linesRes, paysRes, buyerRes, staffRes] = await Promise.all([
      admin.from("pos_sale_lines").select("*").eq("sale_id", s.id),
      admin.from("pos_payments").select("kind,amount_cents,occurred_at,note").eq("sale_id", s.id).order("occurred_at"),
      s.buyer_contact_id
        ? admin.from("contacts").select("first_name,last_name").eq("id", s.buyer_contact_id).single()
        : Promise.resolve({ data: null } as { data: { first_name: string; last_name: string } | null }),
      s.staff_email
        ? admin.from("profiles").select("name").ilike("email", s.staff_email).maybeSingle()
        : Promise.resolve({ data: null } as { data: { name: string } | null }),
    ]);
    const lines = linesRes.data ?? [];
    const pays = paysRes.data ?? [];
    const discAlloc = allocateCents(s.discount_cents, lines.map((l) => l.line_total_cents));
    const taxAlloc = allocateCents(s.tax_cents, lines.map((l, i) => l.taxable ? (l.line_total_cents - discAlloc[i]) : 0));
    const paidNet = pays.reduce((a, p) => a + p.amount_cents, 0);
    const balance = Math.max(s.total_cents - paidNet, 0);
    const refunded = -pays.filter((p) => p.amount_cents < 0).reduce((a, p) => a + p.amount_cents, 0);
    const paid = s.status === "paid";
    const closed = s.status === "closed";

    const brand = BRANDS[s.brand as string] ?? BRANDS.btkd;
    const buyerName = buyerRes.data ? `${buyerRes.data.first_name ?? ""} ${buyerRes.data.last_name ?? ""}`.trim() : "Walk-in";
    const staffName = staffRes.data?.name || s.staff_email || "—";
    const shortId = String(s.id).slice(0, 8).toUpperCase();

    // A partially-paid invoice reads differently from an untouched one.
    const partial = !paid && !closed && paidNet > 0;
    const stampCls = paid ? "" : closed ? " closed" : partial ? " part" : " due";
    const stampTxt = paid ? "PAID" : closed ? "CLOSED" : partial ? "PAYMENT APPLIED" : s.status === "unpaid" ? "UNPAID" : String(s.status).toUpperCase();

    const logoCircle = brand.logoDark && brand.logo
      ? '<div class="iv-logo"><img class="lg-dark" src="' + brand.logoDark + '" alt=""><img class="lg-light" src="' + brand.logo + '" alt=""></div>'
      : brand.logo
      ? '<div class="iv-logo light"><img src="' + brand.logo + '" alt=""></div>'
      : '<div class="iv-logo"><span class="ini">G</span></div>';

    // Disc only earns a column when something is actually discounted —
    // otherwise it is a column of dashes eating width on a phone.
    const anyDisc = lines.some((l, i) => (l.discount_cents || 0) + discAlloc[i] > 0);
    const rows = lines.map((l, i) =>
      '<tr><td class="qty">' + (l.qty ?? 1) + '</td><td class="c-item">' + esc(l.label) + "</td>" +
      '<td class="r">' + money(l.unit_cents) + "</td>" +
      (anyDisc ? '<td class="r">' + ((l.discount_cents || discAlloc[i]) ? "−" + money((l.discount_cents || 0) + discAlloc[i]) : "—") + "</td>" : "") +
      '<td class="r">' + (taxAlloc[i] ? money(taxAlloc[i]) : "—") + "</td>" +
      '<td class="r">' + money(l.line_total_cents - discAlloc[i] + taxAlloc[i]) + "</td></tr>").join("");

    const trow = (k: string, v: number, neg = false) =>
      '<div class="trow' + (neg ? " m" : "") + '"><span>' + k + "</span><span>" + (neg ? "−" : "") + money(v) + "</span></div>";

    // Payments render INSIDE the invoice card (owner redesign 2026-08-15),
    // with their own green total bar mirroring the black one above.
    const payCard = pays.length
      ? '<div class="iv-payhd">' + ICO.wallet + "<span>PAYMENTS</span></div>" +
        '<div class="inv-scroll"><table class="inv-tbl"><thead><tr><th>Date</th><th>Type</th><th class="r">Amount</th></tr></thead><tbody>' +
        pays.map((p) =>
          "<tr><td>" + esc(fmtDate(String(p.occurred_at).slice(0, 10))) + "</td>" +
          '<td style="text-transform:capitalize">' + esc(p.kind) + (p.note ? '<div style="font-size:11px;color:#6A727E">' + esc(p.note) + "</div>" : "") + "</td>" +
          '<td class="r"' + (p.amount_cents < 0 ? ' style="color:#c8102e"' : "") + ">" + (p.amount_cents < 0 ? "−" : "") + money(Math.abs(p.amount_cents)) + "</td></tr>").join("") +
        "</tbody></table></div>" +
        '<div class="iv-total paid"><span class="lbl">Total paid</span><span class="amt">' + money(paidNet) + "</span></div>" +
        (balance > 0 && !closed ? '<div style="padding:0 16px 12px;font-size:12.5px;font-weight:700;color:#c8102e">Still owed: ' + money(balance) + "</div>" : "")
      : "";

    const body = '<div class="iv-wrap"><div class="iv-card">' +
      '<div class="iv-brandrow">' + logoCircle +
      '<div><div class="iv-bname">' + esc(brand.name) + "</div>" +
      '<div class="iv-line">' + ICO.pin + "<span>1901 Deerbrook Dr, Tyler, TX 75703</span></div>" +
      '<div class="iv-line">' + ICO.phone + "<span>(903) 561-2966 · barestkd.fit</span></div>" +
      "</div></div>" +
      '<div class="iv-div"></div>' +
      '<div class="iv-daterow"><span class="dt">' + ICO.cal + "<span>" + fmtDate(s.sale_date) + "</span></span>" +
      '<span>' + (partial
        ? '<span class="iv-stampwrap"><span class="iv-stamp part">PAYMENT APPLIED</span><span class="iv-stampsub">' + money(balance) + ' balance remains</span></span>'
        : '<span class="iv-stamp' + stampCls + '">' + esc(stampTxt) + "</span>") +
      (refunded ? ' <span style="font-size:11px;color:#6A727E">refunded ' + money(refunded) + "</span>" : "") + "</span></div>" +
      '<div class="iv-div"></div>' +
      '<div class="iv-cols">' +
      '<div class="iv-col"><div class="iv-k">Sold to</div><div class="iv-v">' + esc(buyerName) + "</div></div>" +
      '<div class="iv-col"><div class="iv-k">Created by</div><div class="iv-v">' + esc(staffName) + "</div></div>" +
      "</div>" +
      '<div class="iv-div"></div>' +
      '<div style="padding:12px 16px 4px"><div class="iv-k">' + (paid ? "Paid by" : "Payment") + '</div><div class="iv-v" style="text-transform:capitalize">' + esc(s.tender_method || (closed ? "Closed — no balance due" : "Not Yet Received")) + "</div></div>" +
      '<div class="inv-scroll"><table class="inv-tbl"><thead><tr><th class="c-qty">Qty</th><th class="c-item">Item</th><th class="r c-price">Price</th>' +
      (anyDisc ? '<th class="r c-disc">Disc</th>' : "") +
      '<th class="r c-tax">Tax</th><th class="r">Total</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>" +
      '<div style="padding:8px 16px 2px">' +
      trow("Subtotal", s.subtotal_cents) +
      (s.discount_cents ? trow("Discount", s.discount_cents, true) : "") +
      (s.admin_fee_cents ? trow("Card processing", s.admin_fee_cents) : "") +
      trow("Sales tax", s.tax_cents) +
      "</div>" +
      '<div class="iv-total"><span class="lbl">' + (closed ? "Closed · balance waived" : "Total due") + '</span><span class="amt">' + money(s.total_cents) + "</span></div>" +
      payCard +
      '<div class="iv-foot">Invoice #' + shortId + "<br>" + esc(brand.dba ? LEGAL_ENTITY + " · DBA " + brand.name : LEGAL_ENTITY) + " · Thank you!</div>" +
      "</div>" +
      "</div>";

    // Fragment mode: the customer-facing page at www.barestkd.fit/invoice/
    // pulls this and injects it, so the card is rendered in ONE place and
    // the customer never sees a supabase.co URL. The full page below stays
    // as a fallback for anyone hitting this function directly.
    if ((new URL(req.url).searchParams.get("f") ?? "") === "frag") {
      return new Response(
        "<style>" + CSS + "</style>" + body +
          `<script id="iv-state" type="application/json">${JSON.stringify({ status: s.status, balance_cents: balance, total_cents: s.total_cents, short_id: shortId, brand: brand.name })}</script>`,
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
      );
    }
    return page((paid ? "Receipt " : "Invoice ") + shortId, body);
  } catch (e) {
    console.error("receipt-view error", e);
    return page("Receipt", '<div class="iv-wrap"><div class="iv-card" style="padding:20px">Something went wrong loading this receipt. Try again shortly.</div></div>', 500);
  }
});
