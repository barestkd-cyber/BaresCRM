/* ============================================================================
 * BaresTKD POS — catalog-first / profile-first membership flow tests
 * ----------------------------------------------------------------------------
 * Plain Node, no framework. Run from the BaresCRM repo root:
 *
 *     node tests/pos-flow.test.js
 *
 * Runs the REAL functions lifted out of index.html against a minimal DOM +
 * Supabase shim (see the lift()/scan() helpers below — they brace/string/
 * regex-aware scan the actual source so single-line bodies, nested object
 * literals, and regex literals containing quote chars all lift correctly).
 * Complements tests/pos-membership.test.js (pure pricing-quote logic) by
 * exercising the surrounding flow/state machine:
 *   - catalog-first browsing needs no student and shows BASE pricing, never
 *     an invented family/member/household rate;
 *   - a membership line can be added unattached, but posTender BLOCKS the
 *     sale until every membership line has a student — the one genuinely
 *     safety-critical rule this phase adds;
 *   - attaching a student re-quotes to the real household rate and clears
 *     any stale override (it was computed against the wrong base number);
 *   - profile-first quotes the real rate from the very first screen;
 *   - switching "Sold to" to walk-in clears the default member for NEW
 *     membership lines without retargeting lines already on the invoice
 *     (regression, reported 2026-08-03);
 *   - POS never creates a contact during membership checkout;
 *   - a completed sale writes frozen snapshots + enrollments per STUDENT,
 *     independent of the invoice's "Sold to".
 * ========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const CRM = path.join(__dirname, '..') + path.sep;
const html = fs.readFileSync(CRM + 'index.html', 'utf8');
const P = require(CRM + 'pricing.js');

// A '/' opens a regex literal (not division) only in an "expression expected"
// position — after (,=:[!&|?;{ or 'return'. escAttr's /"/g would otherwise
// have its embedded '"' mistaken for a real string delimiter.
function isRegexStart(i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(html[j])) j--;
  if (j < 0) return true;
  if ('(,=:[!&|?;{'.includes(html[j])) return true;
  return /\breturn$/.test(html.slice(Math.max(0, j - 5), j + 1));
}
// Shared character-class-aware scanner: walks from `start`, tracking
// strings/templates, // and /* */ comments, and /regex/ literals so that any
// {}/[]/() or ';' *inside* one of those never affects real depth/termination.
// `onChar(c, depth)` fires for each char outside those constructs; returning
// 'stop' ends the scan at this index (inclusive).
function scan(start, onChar) {
  let i = start, depth = 0, quote = null, inLineComment = false, inBlockComment = false, inRegex = false, inCharClass = false;
  for (; i < html.length; i++) {
    const c = html[i], next = html[i + 1];
    if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i++; } continue; }
    if (inRegex) {
      if (c === '\\') { i++; continue; }
      if (c === '[') inCharClass = true;
      else if (c === ']') inCharClass = false;
      else if (c === '/' && !inCharClass) inRegex = false;
      continue;
    }
    if (quote) { if (c === quote && html[i - 1] !== '\\') quote = null; continue; }
    if (c === '/' && next === '/') { inLineComment = true; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; continue; }
    if (c === '/' && isRegexStart(i)) { inRegex = true; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    if (onChar(c, depth) === 'stop') return i;
  }
  throw new Error('scan ran off the end of the file from index ' + start);
}
// Brace-counts from the function's `{` to its matching `}` (depth returns to
// 0 right as the closing brace itself is processed).
function liftFn(name) {
  const startRe = new RegExp('\\n(?:async )?function ' + name + '\\s*\\(');
  const m = startRe.exec(html);
  if (!m) throw new Error('could not lift function ' + name);
  const braceStart = html.indexOf('{', m.index);
  if (braceStart === -1) throw new Error('no body found for ' + name);
  let started = false;
  const end = scan(braceStart, (c, depth) => {
    if (c === '{') started = true;
    if (started && c === '}' && depth === 0) return 'stop';
  });
  return html.slice(m.index + 1, end + 1);
}
// Depth-tracks {}/[]/() too: some initializers (centsFromInput) are
// block-bodied arrows with a ';' inside, not just an expression.
function liftVar(name) {
  const startRe = new RegExp('\\n(?:const|let) ' + name + '\\s*=');
  const m = startRe.exec(html);
  if (!m) throw new Error('could not lift var ' + name);
  const start = m.index + m[0].length;
  const end = scan(start, (c, depth) => { if (c === ';' && depth === 0) return 'stop'; });
  return html.slice(m.index + 1, end + 1);
}

const FNS = [
  'attYMD',
  'planByCode', 'householdOf', 'pricingContext', 'loadCatalog', 'loadHouseholds',
  'posBlank', 'posStaffList', 'myStaffName', 'posBuyerName',
  'posLineDisc', 'posLineNet', 'posLineTaxable', 'posTotals',
  'renderPOS',
  'posStudentContext', 'posForgetStudent', 'posStudentName',
  'posQuote', 'posMemDueCents', 'posMemLineDueCents', 'posMemRecurringNote', 'posProgramBuckets',
  'posAddMembership', 'posPickProgram', 'posAddMemLine',
  'posAttachSheet', 'posAttachSearch', 'posPickStudentForLine', 'posRequoteLine', 'posSetBuyer',
  'posTkdTrackFor', 'posMemRosterPrograms',
  'posTender',
  'posEditMemLine', 'posSaveMemLine',
  'posOpenMembershipFor',
  'openSheet', 'closeSheet', 'setNavActive', 'closeNav', 'showSection'
];
const VARS = ['\\$', 'escHtml', 'escAttr', 'money', 'centsFromInput', 'dollarsFromCents', 'POS_ANON_CTX', 'POS_STUDENT_CTX', 'POS_ADD',
  'LEGAL_ENTITY', 'RECEIPT_BRANDS', 'POS_LAST_RECEIPT', 'INV_BANNER',
  'STAFF_DIR', 'STAFF_LIST', 'CURRENT_STAFF_EMAIL'];

// ── minimal DOM ──────────────────────────────────────────────────────────────
const registry = {};
function ensureEl(id) {
  if (!registry[id]) {
    const el = {
      id, value: '', checked: false, style: {}, _html: '', textContent: '',
      classList: {
        set: new Set(),
        add(c) { this.set.add(c); },
        remove(c) { this.set.delete(c); },
        toggle(c, f) { if (f === undefined) f = !this.set.has(c); if (f) this.set.add(c); else this.set.delete(c); },
        contains(c) { return this.set.has(c); }
      }
    };
    Object.defineProperty(el, 'innerHTML', {
      get() { return el._html; },
      set(v) { el._html = v; scanAndRegister(v); }
    });
    registry[id] = el;
  }
  return registry[id];
}
function scanAndRegister(htmlStr) {
  const re = /<[a-zA-Z][^>]*\bid=["']([^"']+)["'][^>]*>/g;
  let m;
  while ((m = re.exec(htmlStr))) {
    const id = m[1], tag = m[0];
    const el = ensureEl(id);
    const vm2 = tag.match(/\bvalue=["']([^"']*)["']/);
    if (vm2) el.value = vm2[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<');
    el.checked = /\bchecked\b/.test(tag);
  }
}
const documentShim = {
  getElementById: id => ensureEl(id),
  querySelector: sel => sel === 'main' ? ensureEl('__main__') : ensureEl(sel.replace(/^#/, '')),
  querySelectorAll: () => ({ forEach() {} }),
  body: { style: {} }
};

// ── Supabase shim ────────────────────────────────────────────────────────────
const SB_CALLS = [];
const SB_SELECT = {};   // table -> rows returned by a bare select/eq/in chain
const SB_INSERT_ERROR = {};  // table -> error to return from insert
const SB_INSERT_RESULT = {}; // table -> single row returned after .insert().select().single()

function qb(table, opts) {
  opts = opts || {};
  const self = {
    select() { return self; },
    order() { return self; },
    eq() { return self; },
    in() { return self; },
    insert(rows) {
      SB_CALLS.push({ table, op: 'insert', rows });
      return qb(table, { lastOp: 'insert', err: SB_INSERT_ERROR[table] || null, resultRow: SB_INSERT_RESULT[table] || null });
    },
    single() {
      return Promise.resolve(opts.err ? { data: null, error: opts.err } : { data: opts.resultRow, error: null });
    },
    then(resolve) {
      if (opts.lastOp === 'insert') resolve(opts.err ? { error: opts.err } : { error: null, data: opts.resultRow ? [opts.resultRow] : [] });
      else resolve({ data: SB_SELECT[table] || [], error: null });
    }
  };
  return self;
}
const sbShim = { from: table => qb(table) };

// ── catalog fixture (post-membership-programs.sql shape) ────────────────────
const P_ = (code, name, program, category, freq, rec, down, pay, pif, fam, hh, sellable) =>
  ({ code, name, program, category, billing_frequency: freq, recurring_cents: rec,
     down_cents: down, payment_count: pay, pif_cents: pif, family_position: fam,
     supports_household_discount: hh, sellable: sellable !== false, active: true,
     effective_date: '2026-07-01' });

const PLAN_ROWS = [
  P_('juniors_option_c', 'Juniors Taekwondo — Option C', 'Juniors', 'core_tkd', 'monthly', 11000, 25900, 12, null, null, false),
  P_('specialty_kickboxing', 'Kickboxing — Standalone', 'Kickboxing', 'specialty', 'monthly', 8900, 0, null, null, null, true),
  P_('addon_kickboxing', 'Kickboxing — TKD member add-on', 'Kickboxing', 'addon', 'monthly', 4000, 0, null, null, null, true, false),
  P_('cubs_option_a', 'Cubs — Option A', 'Cubs', 'cubs', 'monthly', 10500, 9900, 12, null, null, false)
];

// ── sandbox ───────────────────────────────────────────────────────────────────
const TOASTS = [];
const sandbox = {
  BTKDPricing: P,
  PLAN_ROWS,
  PRICE_SETTINGS: { household_specialty_discount_cents: 1000, weekly_household_discount_cents: 0 },
  MB_PROGRAM_CARDS: [
    { key: 'Cubs', title: 'Cubs', ages: 'Ages 3–4' },
    { key: 'Juniors', title: 'Juniors Taekwondo', ages: 'Ages 5–12' },
    { key: 'Kickboxing', title: 'Kickboxing', ages: 'Ages 13+' }
  ],
  HH_ROWS: [], HH_LINKS: [], HH_LOADED: true, CATALOG_LOADED: true,
  PRODUCTS: [], PACKETS: [], EVENTS: [],
  MEMBERS: [
    { id: 'kidA', first: 'Jamie', last: 'Lee', age: 9, role: '', segment: 'Active', rank: '', memberships: [] },
    { id: 'kidB', first: 'Sam', last: 'Lee', age: 11, role: '', segment: 'Active', rank: '', memberships: [] }
  ],
  document: documentShim,
  console,
  sb: sbShim,
  toast: msg => TOASTS.push(msg),
  currentStaffEmail: async () => 'staff@test',
  setInterval: () => 0, // unused no-op safety net
  // posTender mints one ledger id per tender attempt (double-tap guard).
  crypto: { _n: 0, randomUUID() { return 'test-sale-' + (++this._n); } },
  posBrand: k => ({ key: k || 'btkd', name: 'Bares Taekwondo Fitness', dba: true, effective: false }),
  posPrintReceipt: () => {},
  // A recorded tender lands on the invoice view; the view itself is
  // DB-rendering chrome, so the sim only records that we navigated there.
  showInvoice: (id, from) => { sandboxNav.push({ id, from }); },
  window: { open: () => null },
};
const sandboxNav = [];
sandbox.sandboxNav = sandboxNav;
vm.createContext(sandbox);
vm.runInContext(VARS.map(liftVar).join('\n') + '\n' + FNS.map(liftFn).join('\n'), sandbox);
sandbox.posSale = sandbox.posBlank();

function run(fn) { return vm.runInContext(fn, sandbox); }
async function call(expr) { return await vm.runInContext(expr, sandbox); }

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.stack || e.message)); }
}

(async () => {

await test('1 catalog-first: no student needed, shows base rate', async () => {
  await call("posAddMembership(null)");
  // NOTE: POS_ADD is declared `let` inside the vm context, so it never
  // becomes a property of the sandbox object (a real Node vm quirk) — read
  // it by running an expression IN the context, not via sandbox.POS_ADD.
  assert.strictEqual(run('POS_ADD.studentId'), null);
  const sheetHtml = ensureEl('sheet').innerHTML;
  assert.ok(sheetHtml.includes('Base pricing shown'), 'sheet should say base pricing, not household-confirmed');
  run("posPickProgram('Kickboxing')");
  const pickHtml = ensureEl('sheet').innerHTML;
  assert.ok(pickHtml.includes('Base rate shown'), 'program list must show the anonymous banner');
  assert.ok(pickHtml.includes('$89.00'), 'standalone base rate, not the $40 member rate');
  assert.ok(!pickHtml.includes('$40.00'), 'must not invent a member rate with no one attached');
});

await test('2 an unattached membership line can be added to the invoice', async () => {
  run("posAddMemLine('specialty_kickboxing')");
  const line = sandbox.posSale.lines[sandbox.posSale.lines.length - 1];
  assert.strictEqual(line.kind, 'mem');
  assert.strictEqual(line.studentId, null);
  assert.strictEqual(line.amount, 89.00);
  const invHtml = ensureEl('view-pos').innerHTML;
  assert.ok(invHtml.includes('Member not attached'), 'invoice row must flag the missing member inline');
});

await test('3 posTender BLOCKS the sale while a membership line is unattached', async () => {
  const before = SB_CALLS.length;
  await call("posTender('Cash')");
  assert.strictEqual(SB_CALLS.length, before, 'must not touch the database at all while blocked');
  assert.ok(TOASTS.some(t => /attach a member/i.test(t)), 'must tell staff why it is blocked: ' + JSON.stringify(TOASTS));
  const viewHtml = ensureEl('view-pos').innerHTML;
  assert.ok(!viewHtml.includes('Sale complete'), 'must not show a success screen for a blocked sale');
});

await test('4 attaching an existing student re-quotes to the real household rate and clears a stale override', async () => {
  const i = sandbox.posSale.lines.length - 1;
  // stage a stale override on the still-unattached line first
  ensureEl('pmRec').value = '75.00';
  ensureEl('pmDown').value = '';
  ensureEl('pmReason').value = 'walk-in negotiation';
  ensureEl('pmNote').value = '';
  await call('posSaveMemLine(' + i + ')');
  assert.ok(sandbox.posSale.lines[i].override, 'override should be staged before attach');

  // kidB (sibling) already holds core TKD. Attaching kidA — who holds NO TKD
  // of her own — must NOT pick up the member add-on rate (that substitution
  // is gated on the PERSON's own TKD, confirmed by pricing.test.js #21). It
  // SHOULD pick up the household discount: kidA becomes household rank 2.
  SB_SELECT['memberships'] = [
    { contact_id: 'kidB', plan_code: 'juniors_option_c', status: 'active', started_on: '2026-01-05', billing_frequency: 'monthly' }
  ];
  sandbox.HH_ROWS.push({ id: 'hh1', name: 'Lee Family' });
  sandbox.HH_LINKS.push({ household_id: 'hh1', contact_id: 'kidA' }, { household_id: 'hh1', contact_id: 'kidB' });

  await call('posPickStudentForLine(' + i + ", 'kidA', false)");
  const line = sandbox.posSale.lines[i];
  assert.strictEqual(line.studentId, 'kidA');
  assert.strictEqual(line.override, null, 'stale override must be cleared on requote');
  assert.strictEqual(line.calc.planCode, 'specialty_kickboxing', 'still standalone — the rule is the PERSON\'s own TKD, not a sibling\'s');
  assert.strictEqual(line.calc.householdRank, 2, 'kidA is the 2nd ranked household member');
  assert.strictEqual(line.calc.finalRecurringCents, 7900, '8900 base - 1000 household discount, now that a real household exists');
  assert.strictEqual(line.amount, 79.00, 'the dollar invoice amount must follow the cents recompute');
});

await test('5 profile-first: student known from the first screen, real rate immediately', async () => {
  SB_SELECT['memberships'] = []; // nobody holds an active membership yet -> confirmed but unranked (founding)
  sandbox.posSale = sandbox.posBlank();
  run("posOpenMembershipFor('kidB')");
  assert.strictEqual(sandbox.posSale.memberId, 'kidB', '"Sold to" defaults for convenience');
  await new Promise(r => setTimeout(r, 0)); // let the async posAddMembership settle
  assert.strictEqual(run('POS_ADD.studentId'), 'kidB');
  const sheetHtml = ensureEl('sheet').innerHTML;
  assert.ok(sheetHtml.includes('Pricing confirmed for Sam Lee'), 'no anonymous browsing needed in this entrance');
});

/* REGRESSION (reported 2026-08-03): "Sold to" was switched from Emerson Allen
 * to Walk-in, a membership was added afterward, and the new line still read
 * "For Emerson Allen". Cause was a POS_LAST_STUDENT memory of the previously
 * attached person that survived the buyer change. The only implicit default is
 * now the CURRENT "Sold to" contact, so walk-in yields no member at all. */
await test('6 switching "Sold to" to walk-in clears the default for NEW membership lines', async () => {
  sandbox.posSale = sandbox.posBlank();
  SB_SELECT['memberships'] = [];

  // 1) a real contact is the buyer -> a new membership line defaults to them
  run("posSetBuyer('kidA')");
  await call('posAddMembership()');            // no arg = the ＋ Membership button
  assert.strictEqual(run('POS_ADD.studentId'), 'kidA', 'a real "Sold to" legitimately seeds the member');
  run("posPickProgram('Cubs')");
  run("posAddMemLine('cubs_option_a')");
  const firstLine = sandbox.posSale.lines.length - 1;
  assert.strictEqual(sandbox.posSale.lines[firstLine].studentId, 'kidA');

  // 2) switch the invoice to a walk-in
  run('posSetBuyer(null)');
  assert.strictEqual(sandbox.posSale.memberId, null);

  // the line already on the invoice keeps its own member — no silent retarget
  assert.strictEqual(sandbox.posSale.lines[firstLine].studentId, 'kidA',
    'existing lines must not retarget when the buyer changes');

  // 3) the NEXT membership must NOT inherit the old person
  await call('posAddMembership()');
  assert.strictEqual(run('POS_ADD.studentId'), null, 'THE BUG: walk-in must not inherit the previous member');
  run("posPickProgram('Cubs')");
  run("posAddMemLine('cubs_option_a')");
  const secondLine = sandbox.posSale.lines.length - 1;
  assert.strictEqual(sandbox.posSale.lines[secondLine].studentId, null,
    'THE BUG: a membership added after switching to walk-in must be unattached');

  const invHtml = ensureEl('view-pos').innerHTML;
  assert.ok(invHtml.includes('Member not attached'), 'the unattached line must say so on the invoice');
  assert.ok(invHtml.includes('For Jamie Lee'), 'the earlier attached line still names its own member');
});

await test('6b POS never creates contacts during membership checkout', async () => {
  // Membership prospects already exist from the trial funnel; the attach step
  // is search-only. A stray contacts INSERT here would be a regression.
  assert.ok(!/posNewStudentSave|posNewStudentSheet/.test(html),
    'the contact-creation path must be gone, not merely unreachable');
  const attachSheet = (() => { run('posAttachSheet(0, false)'); return ensureEl('sheet').innerHTML; })();
  assert.ok(/Search CRM contacts/.test(attachSheet), 'attach is a search over existing contacts');
  assert.ok(!/New contact/.test(attachSheet), 'no create-contact entry point in the attach sheet');
  assert.ok(!SB_CALLS.some(c => c.table === 'contacts' && c.op === 'insert'),
    'no contact was inserted anywhere in this run');
});

await test('7 a completed sale writes snapshots + enrollments per STUDENT, not per invoice buyer', async () => {
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'kidB'; // "Sold to" is the parent/payer proxy in this sim
  SB_SELECT['memberships'] = [];
  await call('posAddMembership(null)'); // browse anonymously even though the invoice has a buyer
  run("posPickProgram('Cubs')");
  run("posAddMemLine('cubs_option_a')");
  const i = sandbox.posSale.lines.length - 1;
  await call('posPickStudentForLine(' + i + ", 'kidA', true)"); // membership is for the CHILD, not "Sold to"

  SB_CALLS.length = 0;
  SB_SELECT['enrollments'] = [];
  const res = await call("posTender('Cash')");
  const memInsert = SB_CALLS.find(c => c.table === 'memberships' && c.op === 'insert');
  assert.ok(memInsert, 'must write a membership snapshot');
  assert.strictEqual(memInsert.rows[0].contact_id, 'kidA', 'snapshot belongs to the STUDENT, not posSale.memberId');
  const enrInsert = SB_CALLS.find(c => c.table === 'enrollments' && c.op === 'insert');
  assert.ok(enrInsert, 'must seed the roster');
  assert.strictEqual(enrInsert.rows[0].student_id, 'kidA');
  const student = sandbox.MEMBERS.find(m => m.id === 'kidA');
  assert.strictEqual(student.memberships.length, 1, 'bookkeeping lands on the actual student');
  // A recorded tender lands on the invoice page with a one-time banner
  // (owner decision 2026-08-10), and the builder resets behind it.
  const nav = sandboxNav[sandboxNav.length - 1];
  assert.ok(nav && nav.from === 'pos', 'must navigate to the invoice view after tender');
  const banner = run('INV_BANNER');
  assert.ok(banner && banner.saleId === nav.id, 'banner is staged for the landed-on invoice');
  assert.ok(banner.badges.some(b => /Membership saved/.test(b)), 'membership badge rides the banner');
  assert.strictEqual(sandbox.posSale.lines.length, 0, 'builder resets for the next sale');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
})();
