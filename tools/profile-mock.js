/* ===========================================================================
 * Student profile mock  ->  tools/profile-mock.html
 * ---------------------------------------------------------------------------
 * A design surface, not the CRM. Owner, 2026-08-21: "lets just make a fake
 * profile and edit from there and then when im ready we implement rather than
 * touching the crm for every edit."
 *
 * The BODY below is hand-written and free to redesign. The STYLES are pulled
 * live from index.html at build time, so what is on screen here is what the
 * CRM would look like, and porting an approved design back is a copy rather
 * than a translation.
 *
 * Desktop first, per his instruction; the phone pass comes after.
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
  first: 'Jamie', last: 'Lee', segment: 'Active',
  program: 'Little Kickers', belt: 'White', beltHex: '#F4F5F7',
  rankDate: 'Aug 17, 2026',
  born: '05-04-2023', age: 3, since: '08-17-2026',
  phone: '(903) 555-0100', email: 'pat.lee@example.com',
  address: '1234 Taekwondo Way<br>Tyler, TX 75701',
  guardian: { name: 'Pat Lee', rel: 'Mother', phone: '(903) 555-0100', email: 'pat.lee@example.com' },
  household: { name: 'Alex Lee', program: 'Juniors', belt: 'Green Belt' },
  rosters: ['Little Kickers', 'Juniors'],
  card: 'Visa •••• 4242, exp 02/27',
  attendance30: 11,
  balance: '$109.04', balanceCount: '2 invoices',
};

/* ── the tabs and what sits under them ──────────────────────────────────── */
const TABS = [
  { key: 'invoices', label: 'Invoices and Payments' },
  { key: 'memberships', label: 'Memberships and Agreements' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'notes', label: 'Notes' },
  { key: 'email', label: 'Email History', soon: true },
  { key: 'docs', label: 'Documents', soon: true },
];

const panels = {
  invoices: `
    <div class="mk-tablewrap">
      <table class="mk-table">
        <thead><tr><th>Date</th><th>For</th><th class="r">Amount</th><th class="r">Status</th></tr></thead>
        <tbody>
          <tr><td>Aug 17, 2026</td><td>Little Kickers session</td><td class="r">$109.04</td><td class="r"><span class="mk-pill owe">Unpaid</span></td></tr>
          <tr><td>Jul 20, 2026</td><td>Uniform</td><td class="r">$45.00</td><td class="r"><span class="mk-pill ok">Paid</span></td></tr>
          <tr><td>Jul 06, 2026</td><td>Belt testing</td><td class="r">$50.00</td><td class="r"><span class="mk-pill ok">Paid</span></td></tr>
        </tbody>
      </table>
    </div>`,
  memberships: `
    <div class="card pad mk-mem">
      <div class="mk-mem-top">
        <div>
          <div class="mk-mem-name">Little Kickers</div>
          <div class="mk-mem-sub">6-week session &middot; paid in full</div>
        </div>
        <span class="mk-pill ok">Active</span>
      </div>
      <div class="mk-mem-terms">
        <span>$109.00</span><span>Started Aug 17, 2026</span><span>Ends Oct 21, 2026</span>
      </div>
      <div class="mk-mem-acts">
        <button class="vc">Edit membership</button>
        <button class="vc">Payment schedule</button>
        <button class="vc">View agreement</button>
      </div>
    </div>`,
  attendance: `
    <div class="mk-tablewrap">
      <table class="mk-table">
        <thead><tr><th>Date</th><th>Class</th><th class="r">Status</th></tr></thead>
        <tbody>
          <tr><td>Aug 19, 2026</td><td>Little Kickers 4:00 PM</td><td class="r"><span class="mk-pill ok">Present</span></td></tr>
          <tr><td>Aug 12, 2026</td><td>Little Kickers 4:00 PM</td><td class="r"><span class="mk-pill ok">Present</span></td></tr>
          <tr><td>Aug 05, 2026</td><td>Little Kickers 4:00 PM</td><td class="r"><span class="mk-pill">Missed</span></td></tr>
        </tbody>
      </table>`
    + `</div>`,
  notes: `
    <div class="card pad">
      <div class="mk-note"><div class="mk-note-meta">Aug 18, 2026 &middot; Mr. Race Bares</div>
        Loves the obstacle course. Shy with new partners, warms up after about ten minutes.</div>
      <div class="mk-note"><div class="mk-note-meta">Aug 03, 2026 &middot; Mr. Race Bares</div>
        Mum asked about moving to the Tuesday class in the autumn.</div>
      <button class="addopt" style="margin-top:12px">Add a note</button>
    </div>`,
  email: `<div class="card pad mk-soon">Email history is not built yet.</div>`,
  docs: `<div class="card pad mk-soon">Documents are not built yet.</div>`,
};

/* ── the page ───────────────────────────────────────────────────────────── */
const tabBtns = TABS.map((t) => t.soon
  ? `<button class="ptab dis">${t.label} <span class="pact-chip">COMING SOON</span></button>`
  : `<button class="ptab${t.key === 'invoices' ? ' on' : ''}" data-tab="${t.key}">${t.label}</button>`).join('');

const panelDivs = TABS.map((t) =>
  `<div class="sec mk-panel" data-tab="${t.key}"${t.key === 'invoices' ? '' : ' style="display:none"'}>${panels[t.key]}</div>`).join('');

const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Student profile mock</title>
<style>${styles}</style>
<style>
/* ── mock-only styling. Anything here is a candidate to move into the CRM
      once the design is agreed. ─────────────────────────────────────────── */
body{margin:0;background:var(--bg)}
.mk-note-bar{background:#1D2026;color:#fff;font:600 12px/1.6 system-ui,sans-serif;
  padding:7px 14px;text-align:center;letter-spacing:.02em}
.mk-wrap{max-width:1100px;margin:0 auto;padding:0 26px 60px}

/* top bar */
.mk-top{display:flex;align-items:center;justify-content:space-between;padding:18px 0 6px}
.mk-back{background:none;border:none;color:var(--accent);font:800 15px/1 inherit;cursor:pointer;padding:0}
.mk-actions{border:1.5px solid var(--line);background:#fff;border-radius:10px;
  padding:9px 14px;font:700 14px/1 inherit;cursor:pointer}

/* stat strip */
.mk-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px}
.mk-stat{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px;
  display:flex;align-items:center;gap:14px}
.mk-stat .ico{width:42px;height:42px;border-radius:11px;background:var(--surface);
  display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}
.mk-stat .n{font-size:26px;font-weight:800;line-height:1.1}
.mk-stat .l{font-size:12.5px;color:var(--muted);font-weight:700;margin-top:2px}
.mk-stat.owe{background:#FFF6F6;border-color:#F0C9C9}
.mk-stat.owe .ico{background:#fff}
.mk-stat.owe .n{color:var(--accent)}

/* header card */
.mk-head{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;margin-top:12px;
  display:flex;gap:22px;align-items:flex-start}
.mk-av{width:104px;height:104px;border-radius:50%;flex:none;background:var(--surface);
  display:flex;align-items:center;justify-content:center;font:800 32px/1 inherit;color:var(--ink);
  box-shadow:0 0 0 4px #fff, 0 0 0 7px var(--gold)}
.mk-hbody{flex:1;min-width:0}
.mk-name{font-size:30px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.mk-prog{color:var(--muted);font-size:15px;font-weight:600;margin-top:4px}
.mk-seg{background:#E4F5EE;color:var(--go);font-size:12px;font-weight:800;
  padding:4px 11px;border-radius:7px;letter-spacing:.01em}
.mk-belt{display:flex;align-items:center;gap:8px;margin-top:14px}
.mk-beltdot{width:15px;height:15px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.22)}
.mk-beltname{font-size:13.5px;font-weight:800}
.mk-beltsince{font-size:12px;color:var(--muted);font-weight:700}
.mk-facts{display:flex;gap:32px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line);flex-wrap:wrap}
.mk-fact{font-size:13.5px}
.mk-fact .fl{color:var(--muted);font-weight:700;font-size:12px;display:block;margin-bottom:2px}

/* overview cards */
.mk-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
.mk-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px}
.mk-card h3{margin:0 0 14px;font-size:15px;display:flex;justify-content:space-between;align-items:center}
.mk-card h3 .edit{color:var(--accent);font-size:12.5px;cursor:pointer;font-weight:700}
.mk-row{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:14px}
.mk-row .ic{width:18px;text-align:center;color:var(--muted);flex:none}
.mk-row a{color:var(--accent);text-decoration:none;font-weight:600}
.mk-sub{font-size:12px;font-weight:800;color:var(--muted);letter-spacing:.04em;
  text-transform:uppercase;margin:14px 0 8px}
.mk-sub:first-of-type{margin-top:0}
.mk-chip{display:inline-block;background:var(--surface);border-radius:99px;
  padding:4px 12px;font-size:12.5px;font-weight:700;margin:0 6px 6px 0}
.mk-viewlink{color:var(--accent);font-weight:700;font-size:13px;cursor:pointer;
  display:block;text-align:right;margin-top:10px}

/* the strip and its panel */
.mk-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;margin-top:26px;
  border-bottom:2px solid var(--line)}
.mk-tabs::-webkit-scrollbar{display:none}
.ptab{flex:0 0 auto;white-space:nowrap;padding:13px 16px;font:700 13.5px/1 inherit;color:var(--muted);
  border:none;background:none;cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-2px;
  display:flex;align-items:center;gap:7px}
.ptab.on{color:var(--accent);border-color:var(--accent)}
.ptab.dis{color:#B9BEC9;cursor:default}
.mk-panel{padding-top:18px}

/* panel contents */
.mk-tablewrap{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.mk-table{width:100%;border-collapse:collapse;font-size:14px}
.mk-table th{text-align:left;font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;
  color:var(--muted);padding:11px 16px;border-bottom:1px solid var(--line);background:var(--surface)}
.mk-table td{padding:13px 16px;border-bottom:1px solid var(--line)}
.mk-table tr:last-child td{border-bottom:none}
.mk-table .r{text-align:right}
.mk-pill{display:inline-block;border-radius:99px;padding:3px 11px;font-size:11.5px;font-weight:800;
  background:var(--surface);color:var(--muted)}
.mk-pill.ok{background:#E4F5EE;color:var(--go)}
.mk-pill.owe{background:#FBE9E9;color:var(--accent)}
.mk-mem-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.mk-mem-name{font-size:16px;font-weight:800}
.mk-mem-sub{font-size:13px;color:var(--muted);margin-top:2px}
.mk-mem-terms{display:flex;gap:22px;flex-wrap:wrap;margin-top:14px;font-size:13.5px;font-weight:700}
.mk-mem-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.mk-note{padding:12px 0;border-bottom:1px solid var(--line);font-size:14px;line-height:1.6}
.mk-note:last-of-type{border-bottom:none}
.mk-note-meta{font-size:11.5px;color:var(--muted);font-weight:700;margin-bottom:4px}
.mk-soon{color:var(--muted);font-size:14px;text-align:center;padding:34px 18px}

@media (max-width:820px){
  .mk-wrap{padding:0 14px 40px}
  .mk-grid{grid-template-columns:1fr}
  .mk-head{flex-direction:column;align-items:flex-start;gap:16px}
  .mk-name{font-size:24px}
}
</style>
</head><body>

<div class="mk-note-bar">PROFILE MOCK &middot; made-up student &middot; not connected to any data</div>

<div class="mk-wrap">

  <div class="mk-top">
    <button class="mk-back">&larr; Members</button>
    <button class="mk-actions">Actions &#9662;</button>
  </div>

  <!-- stat strip -->
  <div class="mk-stats">
    <div class="mk-stat">
      <div class="ico">&#128197;</div>
      <div><div class="n">${S.attendance30}</div><div class="l">Attendance, last 30 days</div></div>
    </div>
    <div class="mk-stat owe">
      <div class="ico">&#36;</div>
      <div><div class="n">${S.balance}</div><div class="l">Balance owed &middot; ${S.balanceCount}</div></div>
    </div>
  </div>

  <!-- header -->
  <div class="mk-head">
    <div class="mk-av">JL</div>
    <div class="mk-hbody">
      <div class="mk-name">${S.first} ${S.last} <span class="mk-seg">${S.segment}</span></div>
      <div class="mk-prog">${S.program}</div>
      <div class="mk-belt">
        <span class="mk-beltdot" style="background:${S.beltHex}"></span>
        <span class="mk-beltname">${S.belt} Belt</span>
        <span class="mk-beltsince">earned ${S.rankDate}</span>
      </div>
      <div class="mk-facts">
        <div class="mk-fact"><span class="fl">Born</span>${S.born} (age ${S.age})</div>
        <div class="mk-fact"><span class="fl">Member since</span>${S.since}</div>
        <div class="mk-fact"><span class="fl">Card on file</span>${S.card}</div>
      </div>
    </div>
  </div>

  <!-- overview -->
  <div class="mk-grid">
    <div class="mk-card">
      <h3>Contact <span class="edit">&#9998; Edit</span></h3>
      <div class="mk-row"><span class="ic">&#9742;</span><a href="#">${S.phone}</a></div>
      <div class="mk-row"><span class="ic">&#9993;</span><a href="#">${S.email}</a></div>
      <div class="mk-row"><span class="ic">&#127968;</span><span>${S.address}</span></div>
    </div>

    <div class="mk-card">
      <h3>Connected Contacts</h3>
      <div class="mk-sub">Guardian</div>
      <div class="mk-row"><span class="ic">&#128100;</span><b>${S.guardian.name}</b><span class="mk-chip">${S.guardian.rel}</span></div>
      <div class="mk-row"><span class="ic">&#9742;</span><a href="#">${S.guardian.phone}</a></div>
      <div class="mk-row"><span class="ic">&#9993;</span><a href="#">${S.guardian.email}</a></div>
      <div class="mk-sub">Household</div>
      <div class="mk-row"><span class="ic">&#128100;</span><b>${S.household.name}</b>
        <span class="mk-chip">${S.household.program}</span><span class="mk-chip">${S.household.belt}</span></div>
      <span class="mk-viewlink">View profile &rsaquo;</span>
    </div>
  </div>

  <div class="mk-card" style="margin-top:14px">
    <h3>Class Rosters</h3>
    ${S.rosters.map((r) => `<span class="mk-chip">${r}</span>`).join('')}
  </div>

  <!-- the strip, under everything above, which never moves -->
  <div class="mk-tabs">${tabBtns}</div>
  <div id="mk-panels">${panelDivs}</div>

</div>

<script>
  document.querySelectorAll('.ptab[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-tab');
      document.querySelectorAll('.ptab').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      document.querySelectorAll('#mk-panels > .mk-panel').forEach(function (p) {
        p.style.display = (p.getAttribute('data-tab') === key) ? '' : 'none';
      });
    });
  });
</script>
</body></html>`;

const out = path.join(__dirname, 'profile-mock.html');
fs.writeFileSync(out, page);
console.log('wrote ' + path.relative(ROOT, out) + '  (' + Math.round(page.length / 1024) + ' kb)');
