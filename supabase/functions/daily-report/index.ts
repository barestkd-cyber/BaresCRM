// ===========================================================================
// Supabase Edge Function: daily-report - the nightly email
// ---------------------------------------------------------------------------
// Replaces the batch-settlement email Spark sent Race every night. His spec,
// given 2026-08-18/19 and unchanged since:
//
//   Sections, in this order: Money in today, Needs you, Tomorrow, New contacts.
//   NO attendance. "That's useless information in an email" - he checks it
//   himself when he wants it.
//   Do NOT list the day's classes. He knows them.
//   A section with nothing in it does not render AT ALL. A quiet Sunday is the
//   money block and little else.
//   It still sends on a quiet day, so a night with no email means something
//   broke.
//
// WHY THIS DECIDES ITS OWN SEND TIME: pg_cron runs in UTC, so a fixed UTC
// schedule drifts an hour every time Texas changes clocks. Instead cron pokes
// this every 15 minutes and this compares the studio-local clock to
// settings.daily_report_hour/minute. DST-proof, the time is changeable without
// touching a schedule, and it self-heals - a missed poke is caught by the next.
// settings.daily_report_last_sent stops that becoming 96 emails a day.
//
// It reads OUR OWN tables and never calls Stripe. The webhook already wrote
// everything that matters into pos_payments as it happened.
//
// Deploy:  supabase functions deploy daily-report --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TZ = "America/Chicago";
const CRM = "https://crm.barestkd.fit";
const SITE = "https://www.barestkd.fit";
const FROM = "Bares Taekwondo Fitness <receipts@barestkd.fit>";
const REPLY_TO = "race@barestkd.fit";

const money = (c: number) => "$" + (Math.round(c || 0) / 100).toFixed(2);
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

/** Studio-local calendar date, n days from now. Built with en-CA so it comes
 *  out yyyy-mm-dd, and never with new Date(str), which parses as UTC and reads
 *  a day early in Central. */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}
/** Studio-local wall clock as minutes since midnight. */
function localMinutes(): number {
  const t = new Date().toLocaleTimeString("en-GB", {
    timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit",
  });
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function prettyDate(ymd: string): string {
  const p = ymd.split("-").map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString("en-US", {
    timeZone: "UTC", weekday: "long", month: "long", day: "numeric",
  });
}
/** "5:30 PM" from a timestamptz, in studio time. */
function localTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    timeZone: TZ, hour: "numeric", minute: "2-digit",
  });
}

// ── rendering ─────────────────────────────────────────────────────────────
// Sections build themselves from rows. A section with no rows returns "" and
// therefore never appears, which is the whole point of the format.

function section(title: string, rows: string[], accent = false): string {
  if (!rows.length) return "";
  return `
    <tr><td style="padding:22px 0 0">
      <p style="margin:0 0 10px;font:700 11px/1.2 Arial,Helvetica,sans-serif;
                letter-spacing:.12em;text-transform:uppercase;color:#8a939c">${esc(title)}</p>
      <div style="${accent ? "border-left:3px solid #EA0000;padding-left:13px" : ""}">
        ${rows.join("")}
      </div>
    </td></tr>`;
}

/** One line: a bold thing on the left, an optional amount on the right, and a
 *  quiet second line underneath. */
function row(main: string, right: string, sub: string, href?: string): string {
  const label = href
    ? `<a href="${href}" style="color:#15171C;text-decoration:none;border-bottom:1px solid #d8dde2">${main}</a>`
    : main;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-bottom:1px solid #eef1f4">
      <tr>
        <td style="padding:9px 0;font:400 14px/1.45 Arial,Helvetica,sans-serif;color:#15171C">
          <span style="font-weight:700">${label}</span>
          ${sub ? `<br><span style="font-size:12.5px;color:#6b757e">${sub}</span>` : ""}
        </td>
        ${right ? `<td align="right" style="padding:9px 0;font:700 14px/1.45 Arial,Helvetica,sans-serif;
                     color:#15171C;white-space:nowrap;vertical-align:top">${right}</td>` : ""}
      </tr>
    </table>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const setRes = await admin.from("settings")
      .select("daily_report_enabled,daily_report_hour,daily_report_minute,daily_report_to,daily_report_last_sent,daily_report_token")
      .limit(1).maybeSingle();
    if (setRes.error || !setRes.data) {
      return new Response(JSON.stringify({ error: "settings unreadable" }), { status: 500 });
    }
    const cfg = setRes.data;

    // Only the scheduler (or a hand-run with the token) gets in.
    const token = req.headers.get("x-report-token") ?? url.searchParams.get("token") ?? "";
    if (token !== String(cfg.daily_report_token)) {
      return new Response(JSON.stringify({ error: "bad token" }), { status: 403 });
    }

    const force = url.searchParams.get("force") === "1";
    const preview = url.searchParams.get("preview") === "1";
    const today = localDate(0);
    const tomorrow = localDate(1);

    if (!force && !preview) {
      if (cfg.daily_report_enabled === false) {
        return new Response(JSON.stringify({ skipped: "disabled" }), { status: 200 });
      }
      if (cfg.daily_report_last_sent === today) {
        return new Response(JSON.stringify({ skipped: "already sent today" }), { status: 200 });
      }
      const due = (cfg.daily_report_hour ?? 19) * 60 + (cfg.daily_report_minute ?? 55);
      if (localMinutes() < due) {
        return new Response(JSON.stringify({ skipped: "not yet", due, now: localMinutes() }), { status: 200 });
      }
    }

    // ── gather ────────────────────────────────────────────────────────────
    // Everything below reads our own ledger. Stripe is never called: the
    // webhook already recorded every payment as it landed.

    const [payRes, unpaidRes, contactsRes, trialsRes, calRes, expiringRes] = await Promise.all([
      admin.from("pos_payments").select("amount_cents,kind,method,note,occurred_at,sale_id"),
      admin.from("pos_sales")
        .select("id,total_cents,sale_date,view_token,buyer_contact_id,notes,receipt_email")
        .eq("status", "unpaid").order("sale_date"),
      admin.from("contacts")
        .select("id,first_name,last_name,email,phone,source,created_at")
        .gte("created_at", today + "T00:00:00Z"),
      admin.from("trial_bookings")
        .select("id,program,class_label,class_datetime,student_age,booked_by,contact_id"),
      admin.from("calendar_events")
        .select("id,type,title,event_date,event_time,notes,paid")
        .eq("event_date", tomorrow),
      admin.from("memberships")
        .select("id,contact_id,program,plan_code,ended_on")
        .eq("status", "active").not("ended_on", "is", null)
        .lte("ended_on", localDate(30)).gte("ended_on", today),
    ]);

    const pays = (payRes.data ?? []).filter((p: Record<string, unknown>) =>
      new Date(String(p.occurred_at)).toLocaleDateString("en-CA", { timeZone: TZ }) === today);
    const unpaid = unpaidRes.data ?? [];
    const newContacts = (contactsRes.data ?? []).filter((c: Record<string, unknown>) =>
      new Date(String(c.created_at)).toLocaleDateString("en-CA", { timeZone: TZ }) === today);
    const trialsTomorrow = (trialsRes.data ?? []).filter((t: Record<string, unknown>) =>
      t.class_datetime &&
      new Date(String(t.class_datetime)).toLocaleDateString("en-CA", { timeZone: TZ }) === tomorrow);
    const cal = calRes.data ?? [];
    const expiring = expiringRes.data ?? [];

    // names for anything that only carries a contact id
    const ids = [
      ...unpaid.map((s: Record<string, unknown>) => s.buyer_contact_id),
      ...trialsTomorrow.map((t: Record<string, unknown>) => t.contact_id),
      ...expiring.map((m: Record<string, unknown>) => m.contact_id),
    ].filter(Boolean) as string[];
    const nameById: Record<string, string> = {};
    if (ids.length) {
      const cRes = await admin.from("contacts").select("id,first_name,last_name")
        .in("id", [...new Set(ids)]);
      (cRes.data ?? []).forEach((c: Record<string, unknown>) => {
        nameById[String(c.id)] = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";
      });
    }

    // ── 1. money in today ─────────────────────────────────────────────────
    const charges = pays.filter((p: Record<string, unknown>) => Number(p.amount_cents) > 0);
    const refunds = pays.filter((p: Record<string, unknown>) => Number(p.amount_cents) < 0);
    const collected = charges.reduce((a, p) => a + Number(p.amount_cents), 0);
    const refunded = refunds.reduce((a, p) => a + Number(p.amount_cents), 0);

    const byMethod: Record<string, { n: number; cents: number }> = {};
    charges.forEach((p: Record<string, unknown>) => {
      const m = String(p.method ?? "other");
      byMethod[m] = byMethod[m] ?? { n: 0, cents: 0 };
      byMethod[m].n++;
      byMethod[m].cents += Number(p.amount_cents);
    });

    const moneyRows: string[] = [];
    if (charges.length) {
      moneyRows.push(
        `<p style="margin:0 0 12px;font:700 30px/1.1 Arial,Helvetica,sans-serif;color:#15171C">${money(collected)}</p>`);
      Object.keys(byMethod).sort().forEach((m) => {
        moneyRows.push(row(m.charAt(0).toUpperCase() + m.slice(1), money(byMethod[m].cents),
          `${byMethod[m].n} payment${byMethod[m].n === 1 ? "" : "s"}`));
      });
    }
    if (refunds.length) {
      moneyRows.push(row("Refunded", money(refunded),
        `${refunds.length} refund${refunds.length === 1 ? "" : "s"} today`));
    }

    // ── 2. needs you ──────────────────────────────────────────────────────
    const needRows: string[] = [];
    if (unpaid.length) {
      const owed = unpaid.reduce((a: number, s: Record<string, unknown>) => a + Number(s.total_cents), 0);
      needRows.push(row(
        `${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`,
        money(owed), "Nobody is chasing these but you."));
      // No per-invoice rows. Owner, 2026-08-25: "i dont want the nightly
      // report to list each open invoice. just how many and for how much."
      // The CRM\u0027s Transactions view is where the individual ones live.
    }
    const failed = pays.filter((p: Record<string, unknown>) =>
      ["ach_return", "dispute"].includes(String(p.kind)));
    failed.forEach((p: Record<string, unknown>) => {
      needRows.push(row("Payment failed", money(Number(p.amount_cents)),
        esc(String(p.note ?? "")) || "Check Stripe for the reason."));
    });
    expiring.forEach((m: Record<string, unknown>) => {
      needRows.push(row(esc(nameById[String(m.contact_id)] ?? "A member"), "",
        `${esc(String(m.program ?? ""))} membership ends ${esc(prettyDate(String(m.ended_on)))}`));
    });

    // ── 3. tomorrow ───────────────────────────────────────────────────────
    const tomRows: string[] = [];
    trialsTomorrow.forEach((t: Record<string, unknown>) => {
      const who = t.contact_id ? nameById[String(t.contact_id)] : String(t.booked_by ?? "Someone");
      tomRows.push(row(esc(who), localTime(String(t.class_datetime)),
        `Trial: ${esc(String(t.program ?? t.class_label ?? ""))}${t.student_age ? `, age ${esc(String(t.student_age))}` : ""}`));
    });
    cal.forEach((e: Record<string, unknown>) => {
      tomRows.push(row(esc(String(e.title ?? e.type ?? "Event")), esc(String(e.event_time ?? "")),
        esc(String(e.notes ?? e.type ?? ""))));
    });

    // ── 4. new contacts ───────────────────────────────────────────────────
    const contactRows: string[] = [];
    newContacts.forEach((c: Record<string, unknown>) => {
      const nm = [c.first_name, c.last_name].filter(Boolean).join(" ") || "(no name)";
      const bits = [c.email, c.phone].filter(Boolean).map(String).map(esc).join(" · ");
      contactRows.push(row(esc(nm), "", `${bits}${c.source ? ` · ${esc(String(c.source))}` : ""}`));
    });

    // ── assemble ──────────────────────────────────────────────────────────
    const body =
      section("Money in today", moneyRows) +
      section("Needs you", needRows, true) +
      section("Tomorrow", tomRows) +
      section("New contacts", contactRows);

    const quiet = !body;
    const html = `
<div style="background:#f4f6f8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="max-width:460px;margin:0 auto;background:#fff;border-radius:14px;padding:24px 22px">
    <tr><td style="padding:0 0 4px">
      <p style="margin:0;font:700 11px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.14em;
                text-transform:uppercase;color:#EA0000">Bares Taekwondo Fitness</p>
      <p style="margin:4px 0 0;font:700 19px/1.3 Arial,Helvetica,sans-serif;color:#15171C">
        ${esc(prettyDate(today))}</p>
    </td></tr>
    ${quiet ? `
    <tr><td style="padding:20px 0 0">
      <p style="margin:0;font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#6b757e">
        Nothing happened today: no money in, nothing waiting on you, nothing on
        the calendar tomorrow, no new contacts. This email still sends on a
        quiet day, so if it ever stops arriving, something is broken.</p>
    </td></tr>` : body}
    <tr><td style="padding:24px 0 0;border-top:1px solid #eef1f4">
      <p style="margin:14px 0 0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#8a939c">
        <a href="${CRM}" style="color:#15171C;font-weight:700;text-decoration:none">Open the CRM</a>
      </p>
    </td></tr>
  </table>
</div>`;

    if (preview) {
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // ── send ──────────────────────────────────────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return new Response(JSON.stringify({ error: "RESEND_API_KEY missing" }), { status: 500 });
    const to = String(cfg.daily_report_to ?? "").trim() ||
      (Deno.env.get("OWNER_NOTIFY_EMAIL") ?? REPLY_TO).trim();

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [to], reply_to: REPLY_TO,
        subject: "Nightly Report BaresTKD",
        html,
      }),
    });
    const sendBody = await send.text();
    if (!send.ok) {
      console.error("[daily-report] resend failed", send.status, sendBody);
      return new Response(JSON.stringify({ error: "send failed", status: send.status }), { status: 500 });
    }

    // Stamp only after a confirmed send, so a failure retries on the next poke
    // rather than being silently skipped for the day.
    await admin.from("settings").update({ daily_report_last_sent: today }).eq("id", true);

    return new Response(JSON.stringify({
      ok: true, to, date: today, quiet,
      collected_cents: collected, payments: charges.length,
      unpaid: unpaid.length, tomorrow: tomRows.length, new_contacts: newContacts.length,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[daily-report] failed:", e);
    return new Response(JSON.stringify({ error: String((e as { message?: string })?.message ?? e) }), { status: 500 });
  }
});
