/* ===========================================================================
 * Student profile mock  ->  profile-mock.html  (served at
 * https://crm.barestkd.fit/profile-mock.html so it opens on a phone)
 * ---------------------------------------------------------------------------
 * A design surface, not the CRM. Owner, 2026-08-21: "lets just make a fake
 * profile and edit from there and then when im ready we implement rather than
 * touching the crm for every edit."
 *
 * Built to the layout he sent back on 2026-08-21:
 *   - the avatar carries the belt colour, ringed in near-black
 *   - Actions sits inside the header card, under the belt line
 *   - the header's fact row is two columns: dates left, CREDITS right
 *   - Contact, Guardian and Household are ONE card, not two
 *   - six tabs, Notes first: Notes, Invoices & Payments, Membership,
 *     Attendance, History, Documents
 *
 * The BODY here is hand-written and free to redesign. The STYLES are pulled
 * live from index.html at build time, so this looks like the CRM and porting
 * an approved design back is a copy rather than a translation.
 *
 *   node tools/profile-mock.js
 * ===========================================================================*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const crm = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const styles = [...crm.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

/* ── the fake student ───────────────────────────────────────────────────── */
const S = {
  first: 'Jamie', last: 'Lee', initials: 'JL', segment: 'Active',
  program: 'Little Kickers',
  belt: 'Senior Green Belt', beltHex: '#1FA463', beltInk: '#fff',
  rankDate: 'Aug 17, 2026',
  born: '05-04-2023', age: 3, since: '08-17-2026',
  lessonCredits: 0, moneyCredits: '$0.00',
  phone: '(903) 555-0100', email: 'pat.lee@example.com',
  address: '1234 Taekwondo Way<br>Tyler, TX 75701',
  guardian: { name: 'Pat Lee', rel: 'Mother', phone: '(903) 555-0100', email: 'pat.lee@example.com' },
  household: { name: 'Alex Lee', program: 'Juniors', belt: 'Green Belt' },
  attendance30: 11,
  balance: '$109.04', balanceCount: '2 invoices',
};

/* ── the payment schedule ───────────────────────────────────────────────
   Twelve monthly payments, four behind us. The one that was moved and
   repriced is there on purpose: it is the case the whole screen exists for
   ("could you bill me 2 weeks late in october"). */
const SCHEDULE = [
  { n: 1, due: '2026-06-17', amount: 110, status: 'paid' },
  { n: 2, due: '2026-07-17', amount: 110, status: 'paid' },
  { n: 3, due: '2026-08-17', amount: 110, status: 'paid' },
  { n: 4, due: '2026-09-17', amount: 110, status: 'scheduled' },
  { n: 5, due: '2026-10-31', amount: 90, status: 'scheduled', note: 'moved and repriced' },
  { n: 6, due: '2026-11-17', amount: 110, status: 'scheduled' },
  { n: 7, due: '2026-12-17', amount: 110, status: 'waived', note: 'injured, owner waived' },
  { n: 8, due: '2027-01-17', amount: 110, status: 'scheduled' },
];

/* ── tabs ───────────────────────────────────────────────────────────────── */
// Notes first: it is what he reaches for mid-conversation with a parent.
// Then the money. Then the rest in the order they were already in.
const TABS = [
  { key: 'notes', label: 'Notes' },
  { key: 'membership', label: 'Membership' },
  { key: 'invoices', label: 'Invoices &amp; Payments' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'docs', label: 'Documents', soon: true },
  { key: 'history', label: 'History', soon: true },
];
const FIRST_TAB = 'notes';

const panels = {
  membership: `
    <div class="mk-card">
      <div class="mk-mem-top">
        <div>
          <div class="mk-mem-name">Taekwondo &mdash; Juniors</div>
          <div class="mk-mem-sub">Option C &middot; 12 months</div>
        </div>
        <span class="mk-pill ok">Active</span>
      </div>
      <div class="mk-mem-terms">
        <span><b>$110.00</b> monthly</span>
        <span>Next bills Sep 17</span>
        <span>4 of 12 paid</span>
      </div>
      <div class="mk-mem-who">Paid by <b>Pat Lee</b> &middot; Visa &bull;&bull;&bull;&bull; 4242</div>
      <div class="mk-mem-acts">
        <button onclick="memEdit()">Edit membership</button>
        <button onclick="memSched()">Payment schedule</button>
        <button>View agreement</button>
      </div>
    </div>`,
  invoices: `
    <div class="mk-card np">
      <table class="mk-table">
        <thead><tr><th>Date</th><th>For</th><th class="r">Amount</th><th class="r">Status</th></tr></thead>
        <tbody>
          <tr><td>Aug 17, 2026</td><td>Little Kickers session</td><td class="r">$109.04</td><td class="r"><span class="mk-pill owe">Unpaid</span></td></tr>
          <tr><td>Jul 20, 2026</td><td>Uniform</td><td class="r">$45.00</td><td class="r"><span class="mk-pill ok">Paid</span></td></tr>
          <tr><td>Jul 06, 2026</td><td>Belt testing</td><td class="r">$50.00</td><td class="r"><span class="mk-pill ok">Paid</span></td></tr>
        </tbody>
      </table>
    </div>`,
  attendance: `
    <div class="mk-card np">
      <table class="mk-table">
        <thead><tr><th>Date</th><th>Class</th><th class="r">Status</th></tr></thead>
        <tbody>
          <tr><td>Aug 19, 2026</td><td>Little Kickers 4:00 PM</td><td class="r"><span class="mk-pill ok">Present</span></td></tr>
          <tr><td>Aug 12, 2026</td><td>Little Kickers 4:00 PM</td><td class="r"><span class="mk-pill ok">Present</span></td></tr>
          <tr><td>Aug 05, 2026</td><td>Little Kickers 4:00 PM</td><td class="r"><span class="mk-pill">Missed</span></td></tr>
        </tbody>
      </table>
    </div>`,
  notes: `
    <div class="mk-card">
      <div class="mk-note">
        <div class="mk-note-meta">Aug 18, 2026 &middot; Mr. Race Bares</div>
        Loves the obstacle course. Shy with new partners, warms up after about ten minutes.
      </div>
      <div class="mk-note">
        <div class="mk-note-meta">Aug 03, 2026 &middot; Mr. Race Bares</div>
        Mum asked about moving to the Tuesday class in the autumn.
      </div>
      <button class="mk-addnote">+ Add a note</button>
    </div>`,
  history: `<div class="mk-card mk-soon">History is not built yet.</div>`,
  docs: `<div class="mk-card mk-soon">Documents are not built yet.</div>`,
};

const tabBtns = TABS.map((t) => t.soon
  ? `<button class="mk-tab dis">${t.label} <span class="mk-soonchip">COMING SOON</span></button>`
  : `<button class="mk-tab${t.key === FIRST_TAB ? ' on' : ''}" data-tab="${t.key}">${t.label}</button>`).join('');

const panelDivs = TABS.map((t) =>
  `<div class="mk-panel" data-tab="${t.key}"${t.key === FIRST_TAB ? '' : ' style="display:none"'}>${panels[t.key]}</div>`).join('');

/* ── the page ───────────────────────────────────────────────────────────── */
const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Student profile mock</title>
<style>${styles}</style>
<style>
/* ── mock-only styling. Candidates to move into the CRM once agreed. ────── */
body{margin:0;background:#fff}
.mk-note-bar{background:#1D2026;color:#fff;font:600 11.5px/1.6 system-ui,sans-serif;
  padding:6px 14px;text-align:center;letter-spacing:.02em}
.mk-wrap{max-width:980px;margin:0 auto;padding:0 16px 60px}

.mk-back{background:none;border:none;color:var(--accent);font:800 17px/1 inherit;
  cursor:pointer;padding:18px 0 12px;display:flex;align-items:center;gap:10px}

/* Two thin read-only bars. Nothing here is tappable, so they get the least
   height that still reads at a glance, and they come first because that is
   what he looks for on opening a profile. */
.mk-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.mk-stat{background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 12px;
  display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
.mk-stat .n{font-size:16px;font-weight:800;line-height:1.1;flex:none;white-space:nowrap}
/* Never wrap: a wrapped label is what made one bar taller than the other. */
.mk-stat .l{font-size:11px;color:var(--muted);font-weight:700;line-height:1.2;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* The long label on a wide screen, the short one on a phone, so neither
   wraps to a second line and doubles the height of a read-only bar. */
.mk-stat .narrow{display:none}
.mk-stat.owe{background:#FFF6F6;border-color:#F3D2D2}
.mk-stat.owe .n{color:var(--accent)}

/* header */
.mk-head{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;margin-top:14px}
.mk-head-top{display:flex;gap:20px;align-items:center}
.mk-av{width:108px;height:108px;border-radius:50%;flex:none;
  display:flex;align-items:center;justify-content:center;font:800 38px/1 inherit;
  box-shadow:0 0 0 5px #15171C}
.mk-avcol{flex:none;display:flex;flex-direction:column;align-items:center;gap:12px}
.mk-hbody{flex:1;min-width:0}
.mk-name{font-size:31px;font-weight:800;letter-spacing:-.02em;display:flex;
  align-items:center;gap:12px;flex-wrap:wrap;line-height:1.15}
.mk-seg{background:#E4F5EE;color:var(--go);font-size:13px;font-weight:700;
  padding:5px 13px;border-radius:8px}
.mk-prog{color:var(--muted);font-size:16px;font-weight:700;margin-top:5px}
.mk-belt{display:flex;align-items:center;gap:9px;margin-top:11px;flex-wrap:wrap}
.mk-beltdot{width:15px;height:15px;border-radius:50%;flex:none;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.18)}
.mk-beltname{font-size:16px;font-weight:800}
.mk-beltsince{font-size:14px;color:var(--muted);font-weight:600}
.mk-actions{border:1.5px solid var(--line);background:#fff;border-radius:11px;
  padding:10px 14px;font:700 14.5px/1 inherit;cursor:pointer;display:inline-flex;
  align-items:center;gap:8px;white-space:nowrap}

/* header facts: dates left, credits right */
.mk-facts{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px;
  padding-top:16px;border-top:1px solid var(--line)}
.mk-facts > div + div{border-left:1px solid var(--line);padding-left:20px}
.mk-fl{color:var(--muted);font-weight:700;font-size:14px}
.mk-fv{font-size:14.5px;margin:3px 0 14px}
.mk-fv:last-child{margin-bottom:0}

/* one card for contact, guardian and household */
.mk-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-top:14px}
.mk-card.np{padding:0;overflow:hidden}
.mk-card h3{margin:0 0 12px;font-size:19px;display:flex;justify-content:space-between;align-items:center}
.mk-edit{color:var(--accent);font-size:15px;cursor:pointer;font-weight:700;display:flex;align-items:center;gap:7px}
.mk-row{display:flex;align-items:center;gap:12px;padding:7px 0;font-size:15px}
.mk-row .ic{width:20px;text-align:center;flex:none;opacity:.55}
.mk-row a{color:var(--accent);text-decoration:none;font-weight:700}
.mk-hr{border:none;border-top:1px solid var(--line);margin:14px 0}
.mk-sub{font-size:13px;font-weight:800;color:var(--muted);letter-spacing:.05em;
  text-transform:uppercase;margin:0 0 8px}
.mk-chip{display:inline-block;background:var(--surface);border-radius:99px;
  padding:5px 13px;font-size:13.5px;font-weight:700;margin-left:4px}
.mk-viewlink{color:var(--accent);font-weight:800;font-size:15px;cursor:pointer;
  display:block;text-align:right;margin-top:12px}

/* tabs, under everything above */
.mk-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin-top:22px;
  border-bottom:1px solid var(--line)}
.mk-tabs::-webkit-scrollbar{display:none}
.mk-tab{flex:0 0 auto;white-space:nowrap;padding:14px 16px;font:700 16px/1 inherit;
  color:var(--muted);border:none;background:none;cursor:pointer;
  border-bottom:3px solid transparent;margin-bottom:-1px;display:flex;align-items:center;gap:9px}
.mk-tab.on{color:var(--accent);border-color:var(--accent)}
.mk-tab.dis{color:#AEB4BD;cursor:default}
.mk-soonchip{background:var(--surface);color:var(--muted);border-radius:5px;
  padding:3px 7px;font-size:10.5px;font-weight:800;letter-spacing:.05em}

/* panels */
.mk-mem-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.mk-mem-name{font-size:21px;font-weight:800}
.mk-mem-sub{font-size:14.5px;color:var(--muted);margin-top:3px}
.mk-mem-terms{display:flex;gap:26px;flex-wrap:wrap;margin-top:14px;font-size:15px}
.mk-mem-acts{display:flex;margin:18px -18px -18px;border-top:1px solid var(--line)}
.mk-mem-acts button{flex:1;padding:15px 8px;background:none;border:none;cursor:pointer;
  font:700 14.5px/1.3 inherit;color:var(--ink)}
.mk-mem-acts button + button{border-left:1px solid var(--line)}
.mk-pill{display:inline-block;border-radius:99px;padding:5px 13px;font-size:13px;font-weight:700;
  background:var(--surface);color:var(--muted)}
.mk-pill.ok{background:#E4F5EE;color:var(--go)}
.mk-pill.owe{background:#FBE9E9;color:var(--accent)}
.mk-table{width:100%;border-collapse:collapse;font-size:14.5px}
.mk-table th{text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase;
  color:var(--muted);padding:12px 16px;border-bottom:1px solid var(--line);background:var(--surface)}
.mk-table td{padding:14px 16px;border-bottom:1px solid var(--line)}
.mk-table tr:last-child td{border-bottom:none}
.mk-table .r{text-align:right}
.mk-note{padding:13px 0;border-bottom:1px solid var(--line);font-size:15px;line-height:1.6}
.mk-note:first-of-type{padding-top:0}
.mk-note-meta{font-size:12.5px;color:var(--muted);font-weight:700;margin-bottom:5px}
.mk-addnote{margin-top:14px;border:1.5px dashed var(--line);background:none;border-radius:11px;
  padding:12px 16px;font:700 14.5px/1 inherit;color:var(--muted);cursor:pointer;width:100%}
.mk-soon{color:var(--muted);font-size:15px;text-align:center;padding:38px 18px}
.mk-mem-who{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);
  font-size:14px;color:var(--muted)}

/* ── edit membership sheet ─────────────────────────────────────────────── */
.mk-scrim{position:fixed;inset:0;background:rgba(10,12,15,.45);opacity:0;pointer-events:none;
  transition:opacity .18s;z-index:80}
.mk-scrim.on{opacity:1;pointer-events:auto}
.mk-sheet{position:fixed;left:0;right:0;bottom:0;z-index:90;background:#fff;
  border-radius:18px 18px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.22);
  transform:translateY(100%);transition:transform .22s ease;
  display:flex;flex-direction:column;max-height:92vh}
.mk-sheet.on{transform:none}
.mk-sheet-grab{width:38px;height:4px;border-radius:99px;background:var(--line);
  margin:9px auto 0}
.mk-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;
  gap:12px;padding:12px 18px 14px;border-bottom:1px solid var(--line)}
.mk-sheet-head h3{margin:0;font-size:19px}
.mk-sheet-sub{font-size:13.5px;color:var(--muted);margin-top:3px}
.mk-x{border:none;background:none;font-size:27px;line-height:1;color:var(--muted);
  cursor:pointer;padding:0 2px}
.mk-sheet-body{padding:16px 18px 4px;overflow-y:auto}
.mk-sheet-foot{display:flex;gap:10px;padding:14px 18px calc(14px + env(safe-area-inset-bottom));
  border-top:1px solid var(--line);background:#fff}
.mk-btn{flex:1;border:none;border-radius:12px;background:var(--accent);color:#fff;
  padding:14px;font:800 15.5px/1 inherit;cursor:pointer}
.mk-btn.ghost{background:none;border:1.5px solid var(--line);color:var(--ink);flex:0 0 34%}
.mk-btn[disabled]{opacity:.45;cursor:default}

.mk-locked{background:var(--surface);border-radius:10px;padding:11px 13px;
  font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:16px}
.mk-f{display:block;margin-bottom:16px}
.mk-f-l{display:block;font-size:13px;font-weight:800;margin-bottom:6px}
.mk-req{background:#FBE9E9;color:var(--accent);border-radius:5px;padding:2px 7px;
  font-size:10.5px;letter-spacing:.04em;margin-left:6px}
.mk-f input,.mk-f select{width:100%;font:inherit;font-size:15.5px;padding:12px 13px;
  border:1.5px solid var(--line);border-radius:11px;background:#fff;color:inherit}
.mk-f-h{display:block;font-size:12.5px;color:var(--muted);line-height:1.5;margin-top:6px}
.mk-money{display:flex;align-items:center;border:1.5px solid var(--line);border-radius:11px;
  background:#fff;overflow:hidden}
.mk-money-sym{padding:0 4px 0 13px;font-weight:800;color:var(--muted)}
.mk-money input{border:none;border-radius:0}
.mk-seg{display:flex;gap:6px;flex-wrap:wrap}
.mk-seg button{flex:1;min-width:92px;border:1.5px solid var(--line);background:#fff;
  border-radius:11px;padding:11px 8px;font:700 14px/1 inherit;cursor:pointer;color:var(--muted)}
.mk-seg button.on{border-color:var(--accent);color:var(--accent);background:#FFF6F6}

.mk-warn{display:none;background:#FFFBEF;border:1px solid #EBD9A6;border-radius:10px;
  padding:11px 13px;font-size:13px;line-height:1.55;margin:-8px 0 16px}
.mk-warn.on{display:block}
.mk-changed{display:none;background:#F4F6F8;border-radius:10px;padding:12px 13px;
  font-size:13px;line-height:1.7;margin-bottom:16px}
.mk-changed.on{display:block}
.mk-changed b{font-weight:800}

.mk-history{border-top:1px solid var(--line);padding-top:14px;margin-bottom:6px}
.mk-history-h{font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.05em;
  text-transform:uppercase;margin-bottom:10px}
.mk-history-row{font-size:13.5px;line-height:1.5;margin-bottom:10px}
.mk-history-row span{display:block;font-size:12px;color:var(--muted);margin-top:1px}

/* ── payment schedule ──────────────────────────────────────────────────── */
.mk-sum{background:var(--surface);border-radius:10px;padding:11px 13px;font-size:13.5px;
  font-weight:700;margin-bottom:14px;display:flex;justify-content:space-between;gap:10px}
.mk-sum span{color:var(--muted);font-weight:600}
.mk-row2{border:1.5px solid var(--line);border-radius:12px;margin-bottom:8px;overflow:hidden}
.mk-row2.settled{background:var(--surface);border-style:dashed}
.mk-row2-top{display:flex;align-items:center;gap:11px;padding:12px 13px;cursor:pointer}
.mk-row2.settled .mk-row2-top{cursor:default}
.mk-row2-n{width:22px;font-weight:800;color:var(--muted);flex:none;font-size:13px}
.mk-row2-d{font-weight:700;font-size:14.5px;flex:1;min-width:0}
.mk-row2-a{font-weight:800;font-size:14.5px;white-space:nowrap}
.mk-row2-s{font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  border-radius:5px;padding:3px 7px;white-space:nowrap}
.mk-row2-s.paid{background:#E4F5EE;color:var(--go)}
.mk-row2-s.sched{background:var(--surface);color:var(--muted)}
.mk-row2-s.waived{background:#FBE9E9;color:var(--accent)}
.mk-row2-note{font-size:12px;color:var(--muted);padding:0 13px 11px;margin-top:-4px}
.mk-row2-body{display:none;padding:0 13px 13px;border-top:1px solid var(--line);margin-top:2px}
.mk-row2.open .mk-row2-body{display:block}
.mk-row2-fields{display:flex;gap:9px;margin-top:12px}
.mk-row2-fields label{flex:1;min-width:0}
.mk-row2-fields .mk-f-l{font-size:11.5px;margin-bottom:4px}
.mk-row2-fields input{width:100%;font:inherit;font-size:14.5px;padding:10px 11px;
  border:1.5px solid var(--line);border-radius:10px;background:#fff;color:inherit}
.mk-row2-acts{display:flex;gap:8px;margin-top:11px}
.mk-row2-acts button{flex:1;border:1.5px solid var(--line);background:#fff;border-radius:10px;
  padding:11px 8px;font:700 13.5px/1 inherit;cursor:pointer;color:var(--ink)}
.mk-row2-acts button.bill{border-color:var(--accent);color:var(--accent);background:#FFF6F6}
.mk-addrow{width:100%;border:1.5px dashed var(--line);background:none;border-radius:12px;
  padding:13px;font:700 14px/1 inherit;color:var(--muted);cursor:pointer;margin-top:4px}

.mk-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);
  background:#15171C;color:#fff;padding:12px 18px;border-radius:11px;font:700 14px/1.4 inherit;
  opacity:0;pointer-events:none;transition:all .2s;z-index:120;max-width:88vw;text-align:center}
.mk-toast.on{opacity:1;transform:translate(-50%,0)}

@media (min-width:700px){
  .mk-sheet{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-46%) scale(.98);
    width:520px;border-radius:18px;opacity:0;max-height:88vh}
  .mk-sheet.on{transform:translate(-50%,-50%) scale(1);opacity:1}
  .mk-sheet-grab{display:none}
}

@media (min-width:900px){
  .mk-wrap{padding:0 26px 60px}
}
@media (max-width:560px){
  .mk-stat .wide{display:none}
  .mk-stat .narrow{display:inline}
  /* Avatar stays BESIDE the name, per his reference. */
  .mk-head{padding:16px}
  .mk-head-top{gap:14px}
  .mk-av{width:74px;height:74px;font-size:26px;box-shadow:0 0 0 4px #15171C}
  .mk-name{font-size:22px;gap:9px}
  .mk-seg{font-size:12px;padding:4px 10px}
  .mk-prog{font-size:14px;margin-top:3px}
  .mk-beltname{font-size:14px}
  .mk-beltsince{font-size:12.5px}
  .mk-belt{margin-top:8px;gap:7px}
  .mk-actions{padding:9px 12px;font-size:13.5px}
  .mk-facts{grid-template-columns:1fr;gap:0}
  .mk-facts > div + div{border-left:none;border-top:1px solid var(--line);
    padding-left:0;padding-top:14px;margin-top:14px}
}
</style>
</head><body>

<div class="mk-note-bar">PROFILE MOCK &middot; made-up student &middot; not connected to any data</div>

<div class="mk-wrap">

  <button class="mk-back">&larr; Members</button>

  <div class="mk-stats">
    <div class="mk-stat">
      <div class="l"><span class="wide">Attendance, last 30 days</span>
        <span class="narrow">Attendance 30d</span></div>
      <div class="n">${S.attendance30}</div>
    </div>
    <div class="mk-stat owe">
      <div class="l"><span class="wide">Balance owed &middot; ${S.balanceCount}</span>
        <span class="narrow">Balance</span></div>
      <div class="n">${S.balance}</div>
    </div>
  </div>

  <div class="mk-head">
    <div class="mk-head-top">
      <div class="mk-avcol">
        <div class="mk-av" style="background:${S.beltHex};color:${S.beltInk}">${S.initials}</div>
        <button class="mk-actions">Actions &#9662;</button>
      </div>
      <div class="mk-hbody">
        <div class="mk-name">${S.first} ${S.last} <span class="mk-seg">${S.segment}</span></div>
        <div class="mk-prog">${S.program}</div>
        <div class="mk-belt">
          <span class="mk-beltdot" style="background:${S.beltHex}"></span>
          <span class="mk-beltname">${S.belt}</span>
          <span class="mk-beltsince">earned ${S.rankDate}</span>
        </div>
      </div>
    </div>

    <div class="mk-facts">
      <div>
        <div class="mk-fl">DOB</div>
        <div class="mk-fv">${S.born} (age ${S.age})</div>
        <div class="mk-fl">Member since</div>
        <div class="mk-fv">${S.since}</div>
      </div>
      <div>
        <div class="mk-fl">Credits</div>
        <div class="mk-fv">Private lesson credits: ${S.lessonCredits}</div>
        <div class="mk-fv">Money credits: ${S.moneyCredits}</div>
      </div>
    </div>
  </div>

  <div class="mk-card">
    <h3>Contact <span class="mk-edit">&#9998; Edit</span></h3>
    <div class="mk-row"><span class="ic">&#9742;</span><a href="#">${S.phone}</a></div>
    <div class="mk-row"><span class="ic">&#9993;</span><a href="#">${S.email}</a></div>
    <div class="mk-row"><span class="ic">&#127968;</span><span>${S.address}</span></div>

    <hr class="mk-hr">
    <div class="mk-sub">Guardian</div>
    <div class="mk-row"><span class="ic">&#128100;</span><b>${S.guardian.name}</b><span class="mk-chip">${S.guardian.rel}</span></div>
    <div class="mk-row"><span class="ic">&#9742;</span><a href="#">${S.guardian.phone}</a></div>
    <div class="mk-row"><span class="ic">&#9993;</span><a href="#">${S.guardian.email}</a></div>

    <hr class="mk-hr">
    <div class="mk-sub">Household</div>
    <div class="mk-row"><span class="ic">&#128100;</span><b>${S.household.name}</b>
      <span class="mk-chip">${S.household.program}</span><span class="mk-chip">${S.household.belt}</span></div>
    <span class="mk-viewlink">View profile &rsaquo;</span>
  </div>

  <div class="mk-tabs">${tabBtns}</div>
  <div id="mk-panels">${panelDivs}</div>

</div>

<!-- ── edit membership ──────────────────────────────────────────────────
     Program and plan are deliberately NOT here. Those are what the signed
     agreement is about; changing one is a different contract, not an edit.
     What can move is the money, the dates, who pays, and whether it is
     still running. Every change wants a reason, and the reason is asked
     for BEFORE the save, not after. -->
<div class="mk-scrim" id="mk-scrim" onclick="memClose()"></div>
<div class="mk-sheet" id="mk-sheet" role="dialog" aria-modal="true" aria-label="Edit membership">
  <div class="mk-sheet-grab"></div>
  <div class="mk-sheet-head">
    <div>
      <h3 id="mk-sheet-title">Edit membership</h3>
      <div class="mk-sheet-sub" id="mk-sheet-sub">Taekwondo &mdash; Juniors &middot; Option C</div>
    </div>
    <button class="mk-x" onclick="memClose()">&times;</button>
  </div>

  <div class="mk-sheet-body" id="mk-sheet-body">

    <div class="mk-locked">
      Program and plan cannot be changed here. A different program is a new
      agreement, not an edit to this one.
    </div>

    <label class="mk-f">
      <span class="mk-f-l">Price</span>
      <span class="mk-money">
        <span class="mk-money-sym">$</span>
        <input id="mk-price" type="number" step="0.01" min="0" value="110.00" oninput="memDrift()">
      </span>
    </label>
    <div class="mk-warn" id="mk-warn">
      The signed agreement says <b>$110.00</b> a month. Changing it here does not
      change the agreement.
    </div>

    <div class="mk-f">
      <span class="mk-f-l">Billed</span>
      <div class="mk-seg" id="mk-freq">
        <button class="on" onclick="memSeg(this)">Monthly</button>
        <button onclick="memSeg(this)">Weekly</button>
        <button onclick="memSeg(this)">Paid in full</button>
      </div>
    </div>

    <label class="mk-f">
      <span class="mk-f-l">Next bills on</span>
      <input id="mk-next" type="date" value="2026-09-17">
    </label>

    <label class="mk-f">
      <span class="mk-f-l">Who pays</span>
      <select id="mk-payer">
        <option>Pat Lee &middot; Visa &bull;&bull;&bull;&bull; 4242</option>
        <option>Jamie Lee &middot; no card on file</option>
        <option>Someone else&hellip;</option>
      </select>
      <span class="mk-f-h">The card charged for this membership. For a child that
        is usually a parent, not the student.</span>
    </label>

    <div class="mk-f">
      <span class="mk-f-l">Status</span>
      <div class="mk-seg" id="mk-status">
        <button class="on" onclick="memSeg(this)">Active</button>
        <button onclick="memSeg(this)">Paused</button>
        <button onclick="memSeg(this)">Ended</button>
      </div>
      <span class="mk-f-h" id="mk-status-h">Paused stops the billing but keeps
        the place on the mat.</span>
    </div>

    <label class="mk-f">
      <span class="mk-f-l">Why <span class="mk-req">required</span></span>
      <input id="mk-reason" maxlength="200" placeholder="Family discount agreed at the desk"
        oninput="memReason()">
      <span class="mk-f-h">Goes on the record with what changed, so the next
        person to look knows why it is not what the agreement says.</span>
    </label>

    <div class="mk-changed" id="mk-changed"></div>

    <div class="mk-history">
      <div class="mk-history-h">Earlier changes</div>
      <div class="mk-history-row"><b>Price</b> $119.00 &rarr; $110.00
        <span>Jul 02 &middot; Mr. Race Bares &middot; sibling discount</span></div>
      <div class="mk-history-row"><b>Next bills on</b> Jun 17 &rarr; Jun 24
        <span>Jun 10 &middot; Mr. Race Bares &middot; asked to move a week after payday</span></div>
    </div>
  </div>

  <div class="mk-sheet-foot">
    <button class="mk-btn ghost" onclick="memClose()">Cancel</button>
    <button class="mk-btn" id="mk-save" onclick="memSave()">Save changes</button>
  </div>
</div>

<!-- ── payment schedule ─────────────────────────────────────────────────
     One row per payment. A row that has settled is read-only, because
     rewriting history is not editing. A scheduled row opens to reveal its
     date and amount, and the two things you can do to it: waive it, or
     bill it now. -->
<div class="mk-sheet" id="mk-sched" role="dialog" aria-modal="true" aria-label="Payment schedule">
  <div class="mk-sheet-grab"></div>
  <div class="mk-sheet-head">
    <div>
      <h3>Payment schedule</h3>
      <div class="mk-sheet-sub">Taekwondo &mdash; Juniors &middot; $110.00 monthly</div>
    </div>
    <button class="mk-x" onclick="schedClose()">&times;</button>
  </div>

  <div class="mk-sheet-body">
    <div class="mk-sum" id="mk-sum"></div>
    <div id="mk-rows"></div>
    <button class="mk-addrow" onclick="schedAdd()">+ Add a payment</button>

    <label class="mk-f" style="margin-top:18px">
      <span class="mk-f-l">Why <span class="mk-req">required</span></span>
      <input id="mk-sreason" maxlength="200" placeholder="She asked to be billed two weeks late in October"
        oninput="schedRefresh()">
    </label>
    <div class="mk-changed" id="mk-schanged"></div>
  </div>

  <div class="mk-sheet-foot">
    <button class="mk-btn ghost" onclick="schedClose()">Cancel</button>
    <button class="mk-btn" id="mk-ssave" onclick="schedSave()">Save changes</button>
  </div>
</div>

<div class="mk-toast" id="mk-toast"></div>

<script>
  document.querySelectorAll('.mk-tab[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-tab');
      document.querySelectorAll('.mk-tab').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      document.querySelectorAll('#mk-panels > .mk-panel').forEach(function (p) {
        p.style.display = (p.getAttribute('data-tab') === key) ? '' : 'none';
      });
    });
  });

  /* ── edit membership ────────────────────────────────────────────────────
     What the membership was when the sheet opened. Every comparison is
     against this, so "what changed" is answered by the data rather than by
     watching keystrokes. */
  var WAS = { price: '110.00', freq: 'Monthly', next: '2026-09-17',
              payer: 'Pat Lee · Visa •••• 4242', status: 'Active' };
  var AGREEMENT_PRICE = '110.00';
  var $ = function (id) { return document.getElementById(id); };

  function memNow() {
    return {
      price: $('mk-price').value.trim(),
      freq: $('mk-freq').querySelector('.on').textContent.trim(),
      next: $('mk-next').value,
      payer: $('mk-payer').value.trim(),
      status: $('mk-status').querySelector('.on').textContent.trim()
    };
  }
  function memDiff() {
    var now = memNow(), out = [];
    var label = { price: 'Price', freq: 'Billed', next: 'Next bills on',
                  payer: 'Who pays', status: 'Status' };
    Object.keys(label).forEach(function (k) {
      var a = String(WAS[k]), b = String(now[k]);
      if (k === 'price') { a = (+a).toFixed(2); b = (+b || 0).toFixed(2); }
      if (a !== b) out.push({ what: label[k], from: a, to: b });
    });
    return out;
  }
  function memDrift() {
    // Say so the moment the price leaves the agreement, not after saving.
    var off = (+$('mk-price').value || 0).toFixed(2) !== (+AGREEMENT_PRICE).toFixed(2);
    $('mk-warn').classList.toggle('on', off);
    memRefresh();
  }
  function memSeg(btn) {
    Array.prototype.forEach.call(btn.parentNode.children, function (b) { b.classList.remove('on'); });
    btn.classList.add('on');
    memRefresh();
  }
  function memReason() { memRefresh(); }
  function memRefresh() {
    var d = memDiff(), box = $('mk-changed');
    if (d.length) {
      box.innerHTML = '<b>About to change</b><br>' + d.map(function (c) {
        return c.what + ': ' + c.from + ' &rarr; <b>' + c.to + '</b>';
      }).join('<br>');
      box.classList.add('on');
    } else {
      box.classList.remove('on');
    }
    // Nothing to save with no changes, and nothing saves without a reason.
    $('mk-save').disabled = !d.length || !$('mk-reason').value.trim();
  }
  function memEdit() {
    $('mk-scrim').classList.add('on');
    $('mk-sheet').classList.add('on');
    memRefresh();
  }
  function memClose() {
    $('mk-scrim').classList.remove('on');
    $('mk-sheet').classList.remove('on');
    $('mk-sched').classList.remove('on');
  }
  function memSave() {
    var d = memDiff();
    memClose();
    memToast(d.length + (d.length === 1 ? ' change saved' : ' changes saved'));
    // The card reflects it, the way the real one would.
    var now = memNow();
    document.querySelector('.mk-mem-terms').innerHTML =
      '<span><b>$' + (+now.price).toFixed(2) + '</b> ' + now.freq.toLowerCase() + '</span>'
      + '<span>Next bills ' + now.next + '</span><span>4 of 12 paid</span>';
    WAS = now;
    memRefresh();
  }
  /* ── payment schedule ───────────────────────────────────────────────────
     A settled payment is read-only: rewriting history is not editing. A
     scheduled one opens to reveal its date, its amount, and the two things
     you can do to it. */
  var SCHED = ${JSON.stringify(SCHEDULE)};
  var SCHED_WAS = JSON.stringify(SCHED);
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function prettyDue(ymd) {
    var p = String(ymd).split('-').map(Number);
    if (p.length !== 3) return ymd;
    return MONTHS[p[1] - 1] + ' ' + p[2] + ', ' + p[0];
  }
  function schedDraw() {
    var live = SCHED.filter(function (r) { return r.status !== 'waived'; });
    var left = live.filter(function (r) { return r.status !== 'paid'; });
    var owed = left.reduce(function (t, r) { return t + r.amount; }, 0);
    $('mk-sum').innerHTML =
      '<div>' + (live.length - left.length) + ' paid <span>&middot; ' + left.length + ' to go</span></div>'
      + '<div>$' + owed.toFixed(2) + ' <span>remaining</span></div>';

    $('mk-rows').innerHTML = SCHED.map(function (r, i) {
      var settled = r.status !== 'scheduled';
      var chip = r.status === 'paid' ? '<span class="mk-row2-s paid">Paid</span>'
        : r.status === 'waived' ? '<span class="mk-row2-s waived">Waived</span>'
        : '<span class="mk-row2-s sched">Scheduled</span>';
      return '<div class="mk-row2' + (settled ? ' settled' : '') + '" data-i="' + i + '">'
        + '<div class="mk-row2-top"' + (settled ? '' : ' onclick="schedToggle(' + i + ')"') + '>'
        + '<span class="mk-row2-n">' + r.n + '</span>'
        + '<span class="mk-row2-d">' + prettyDue(r.due) + '</span>'
        + '<span class="mk-row2-a">$' + r.amount.toFixed(2) + '</span>'
        + chip + '</div>'
        + (r.note ? '<div class="mk-row2-note">' + r.note + '</div>' : '')
        + (settled ? '' :
          '<div class="mk-row2-body">'
          + '<div class="mk-row2-fields">'
          + '<label><span class="mk-f-l">Due</span>'
          + '<input type="date" value="' + r.due + '" onchange="schedSet(' + i + ',\\'due\\',this.value)"></label>'
          + '<label><span class="mk-f-l">Amount</span>'
          + '<input type="number" step="0.01" min="0" value="' + r.amount.toFixed(2)
          + '" oninput="schedSet(' + i + ',\\'amount\\',this.value)"></label>'
          + '</div>'
          + '<div class="mk-row2-acts">'
          + '<button onclick="schedWaive(' + i + ')">Waive this one</button>'
          + '<button class="bill" onclick="schedBill(' + i + ')">Bill now</button>'
          + '</div></div>')
        + '</div>';
    }).join('');
    schedRefresh();
  }
  function schedToggle(i) {
    var el = document.querySelector('.mk-row2[data-i="' + i + '"]');
    var wasOpen = el.classList.contains('open');
    document.querySelectorAll('.mk-row2').forEach(function (x) { x.classList.remove('open'); });
    if (!wasOpen) el.classList.add('open');
  }
  function schedSet(i, key, val) {
    SCHED[i][key] = key === 'amount' ? (+val || 0) : val;
    // Redrawing would collapse the row mid-edit, so only the summary moves.
    var live = SCHED.filter(function (r) { return r.status !== 'waived'; });
    var left = live.filter(function (r) { return r.status !== 'paid'; });
    var owed = left.reduce(function (t, r) { return t + r.amount; }, 0);
    $('mk-sum').innerHTML =
      '<div>' + (live.length - left.length) + ' paid <span>&middot; ' + left.length + ' to go</span></div>'
      + '<div>$' + owed.toFixed(2) + ' <span>remaining</span></div>';
    schedRefresh();
  }
  function schedWaive(i) {
    if (!$('mk-sreason').value.trim()) {
      memToast('Say why first. A waived payment needs a reason.');
      $('mk-sreason').focus();
      return;
    }
    SCHED[i].status = 'waived';
    SCHED[i].note = $('mk-sreason').value.trim();
    schedDraw();
  }
  function schedBill(i) {
    memToast('Would raise an invoice for $' + SCHED[i].amount.toFixed(2)
      + ' and email the pay link.');
  }
  function schedAdd() {
    var last = SCHED[SCHED.length - 1];
    var p = last.due.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1], p[2]));  // one month on
    SCHED.push({ n: last.n + 1, due: d.toISOString().slice(0, 10),
                 amount: last.amount, status: 'scheduled' });
    schedDraw();
  }
  function schedRefresh() {
    var changed = JSON.stringify(SCHED) !== SCHED_WAS;
    var box = $('mk-schanged');
    box.classList.toggle('on', changed);
    if (changed) box.innerHTML = '<b>Unsaved changes to the schedule.</b>';
    $('mk-ssave').disabled = !changed || !$('mk-sreason').value.trim();
  }
  function memSched() {
    $('mk-scrim').classList.add('on');
    $('mk-sched').classList.add('on');
    schedDraw();
  }
  function schedClose() {
    $('mk-scrim').classList.remove('on');
    $('mk-sched').classList.remove('on');
  }
  function schedSave() {
    schedClose();
    SCHED_WAS = JSON.stringify(SCHED);
    memToast('Schedule saved');
    schedRefresh();
  }
  var toastT;
  function memToast(msg) {
    var t = $('mk-toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') memClose(); });
</script>
</body></html>`;

// Written to the repo root so Pages serves it at
// https://crm.barestkd.fit/profile-mock.html , reachable from a phone.
const out = path.join(ROOT, 'profile-mock.html');
fs.writeFileSync(out, page);
console.log('wrote ' + path.relative(ROOT, out) + '  (' + Math.round(page.length / 1024) + ' kb)');
