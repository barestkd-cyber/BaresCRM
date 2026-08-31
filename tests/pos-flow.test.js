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
const A = require(CRM + 'agreements.js');

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
  'attYMD', 'fmtDate',
  'planByCode', 'householdOf', 'pricingContext', 'loadCatalog', 'loadHouseholds',
  'posBlank', 'posStaffList', 'myStaffName', 'posBuyerName',
  'posLineDisc', 'posLineNet', 'posLineTaxable', 'posTotals',
  'renderPOS',
  'posStudentContext', 'posForgetStudent', 'posStudentName',
  'posQuote', 'posMemDueCents', 'posMemLineDueCents', 'posMemRecurringNote', 'posProgramBuckets',
  'posSuggestedAdminFeeCents', 'posSaveAmount',
  'posPayOpen', 'posPayTab', 'posPayRender', 'posPayChange', 'posPayEffectiveCents', 'posPayQuick',
  'posPayFeePrompt', 'posPayFeeAnswer', 'posPayAskClose', 'posPayRestoreFee', 'posPaySubmit', 'posPayClose', 'pmHasBuyer',
  'posAutoReceipt',
  // keyed-card entry: lifted so posPayRender's mount call resolves
  'pmCardMount', 'pmCardErr', 'pmLoadStripeJs', 'pmChargeCard',
  // cards already on file: posPayRender draws the picker and posPaySubmit
  // routes past the card field when one is chosen
  'pmLoadSaved', 'pmDrawPicker', 'pmPick', 'pmBuyerId', 'pmChargeSaved', 'profFnError',
  // a card belongs to the family, so every card list asks the household
  'householdSiblings', 'loadHouseholds', 'householdOf',
  'pmNowParts', 'pmOccurredAt',
  'posAddMembership', 'posPickProgram', 'posAddMemLine',
  // belt testing at the desk: seats hang off testing_dates, tender writes
  // testing_signups (2026-08-28)
  'posAddTesting', 'posTestingSeatCents', 'posAddTestingLine',
  'posAttachSheet', 'posAttachSearch', 'posPickStudentForLine', 'posRequoteLine', 'posSetBuyer',
  'posTkdTrackFor', 'posMemRosterPrograms',
  // agreement capture — renderPOS/posPayOpen/posTender all reach into these
  'agrResolve', 'agrApplyAddOns', 'agrBuildDoc', 'agrDocText', 'agrDocHtml', 'agrUnsignedLines',
  'agrGate', 'agrWaive', 'agrShowBlocked', 'agrShowBlockedFor', 'agrOpenSign', 'agrRenderSheet',
  'agrSigInit', 'agrSigClear', 'agrAccept', 'agrField', 'agrSaveBackToProfile',
  'posTender', 'posBuildSaleIntent',
  'posEditMemLine', 'posSaveMemLine',
  'posOpenMembershipFor',
  // add a membership from the profile, in three steps
  'memAddOpen', 'memAddClose', 'memAddPickProgram', 'memAddPickOption', 'memAddQuote',
  'memAddOverride', 'memAddDueCents', 'memAddSet', 'memAddDueHtml', 'memAddRender',
  'memAddStep1', 'memAddStep2', 'memAddStep3', 'memAddPay', 'memAddLoadCards',
  'memAddSign', 'memAddBack', 'memAddNext', 'memAddToPayment', 'memAddTakePayment',
  'memAddChargeNewCard', 'memAddFinish',
  'openSheet', 'closeSheet', 'setNavActive', 'closeNav', 'showSection', 'posCloseInvoice', 'posReopenAfterRefund'
];
const VARS = ['\\$', 'escHtml', 'escAttr', 'escJs', 'money', 'centsFromInput', 'dollarsFromCents', 'POS_ANON_CTX', 'POS_STUDENT_CTX', 'POS_ADD', 'PAY', 'PAY_DETAIL', 'IV_ICO',
  'LEGAL_ENTITY', 'RECEIPT_BRANDS', 'POS_LAST_RECEIPT', 'INV_BANNER',
  'STAFF_DIR', 'STAFF_LIST', 'CURRENT_STAFF_EMAIL', 'POS_SERVER_SALES', 'PM_SAVED', 'MADD', 'selectedId'];

// ── minimal DOM ──────────────────────────────────────────────────────────────
const registry = {};
let tmpN = 0;
function ensureEl(id) {
  if (!registry[id]) {
    const el = {
      id, value: '', checked: false, style: {}, _html: '', textContent: '', disabled: false,
      insertAdjacentHTML(pos, html){ this.innerHTML = (pos==='afterbegin') ? (html + this._html) : (this._html + html); },
      remove(){ delete registry[this.id]; },
      // Enough <canvas> for the signature pad to initialise and be drawn on.
      // Handlers are kept so a test can fire a real pointerdown rather than
      // reaching past the code and setting a flag.
      getBoundingClientRect(){ return { left: 0, top: 0, width: 300, height: 150 }; },
      getContext(){ return { scale(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){}, clearRect(){} }; },
      toDataURL(){ return 'data:image/png;base64,TESTSIGNATURE'; },
      addEventListener(type, fn){ (this.__on = this.__on || {})[type] = fn; },
      setPointerCapture(){},
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
  createElement: () => ensureEl('__tmp' + (++tmpN)),
  body: { style: {} }
};

// ── Supabase shim ────────────────────────────────────────────────────────────
const SB_CALLS = [];
const ALL_CALLS = [];   // never reset: suite-wide invariants read this
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
      SB_CALLS.push({ table, op: 'insert', rows }); ALL_CALLS.push({ table, op: 'insert', rows });
      return qb(table, { lastOp: 'insert', err: SB_INSERT_ERROR[table] || null, resultRow: SB_INSERT_RESULT[table] || null });
    },
    update(patch) {
      SB_CALLS.push({ table, op: 'update', patch }); ALL_CALLS.push({ table, op: 'update', patch });
      return qb(table, { lastOp: 'insert', err: null, resultRow: null });  // resolves like any write
    },
    single() {
      return Promise.resolve(opts.err ? { data: null, error: opts.err } : { data: opts.resultRow, error: null });
    },
    maybeSingle() {
      // First scripted row for the table, or the insert result, or nothing -
      // and "nothing" is data:null with no error, exactly like the real one.
      const row = (SB_SELECT[table] && SB_SELECT[table][0]) || opts.resultRow || null;
      return Promise.resolve(opts.err ? { data: null, error: opts.err } : { data: row, error: null });
    },
    then(resolve) {
      if (opts.lastOp === 'insert') resolve(opts.err ? { error: opts.err } : { error: null, data: opts.resultRow ? [opts.resultRow] : [] });
      else resolve({ data: SB_SELECT[table] || [], error: null });
    }
  };
  return self;
}
// Edge Function calls are recorded, not made. RECEIPTS holds every
// send-receipt invocation so tests can assert automatic receipts fire.
const RECEIPTS = [];
// pos-charge is scripted per test: CHARGE decides whether the intent or the
// finalize fails; CHARGES records every call so tests can assert order.
const CHARGES = [];
const CHARGE = { intentError: null, finalizeError: null, savedError: null, amount: null, receiptSent: true };
// Cards Stripe says are on file for the buyer, and every ask for them.
let SAVED_CARDS = [];
const PM_CALLS = [];
let LAST_INTENT_AMOUNT = 0;
const sbShim = {
  from: table => qb(table),
  functions: {
    invoke: (name, opts) => {
      const body = (opts && opts.body) || {};
      if (name === 'payment-methods') {
        PM_CALLS.push(body);
        return Promise.resolve({ data: { cards: SAVED_CARDS, usage: {}, email: 'buyer@test' }, error: null });
      }
      if (name === 'send-receipt') { RECEIPTS.push(body); return Promise.resolve({ data: { ok: true, to: ['buyer@test'] }, error: null }); }
      if (name === 'pos-charge') {
        if (body.action === 'config') { CHARGES.push(body); return Promise.resolve({ data: { publishable_key: 'pk_test_x', live: false }, error: null }); }
        if (body.action === 'intent') {
          // the amount is the LEDGER's: the sale row must already exist
          const sale = ALL_CALLS.filter(c => c.table === 'pos_sales' && c.op === 'insert' && c.rows && c.rows.id === body.sale_id).pop();
          CHARGES.push(Object.assign({}, body, { saleKnown: !!sale }));
          if (CHARGE.intentError) return Promise.resolve({ data: { error: CHARGE.intentError }, error: null });
          LAST_INTENT_AMOUNT = CHARGE.amount != null ? CHARGE.amount : (sale ? sale.rows.total_cents : 0);
          return Promise.resolve({ data: { client_secret: 'cs_test_' + body.sale_id, amount_cents: LAST_INTENT_AMOUNT, id: 'pi_' + body.sale_id }, error: null });
        }
        if (body.action === 'charge-saved') {
          const sale = ALL_CALLS.filter(c => c.table === 'pos_sales' && c.op === 'insert' && c.rows && c.rows.id === body.sale_id).pop();
          CHARGES.push(Object.assign({}, body, { saleKnown: !!sale }));
          if (CHARGE.savedError) return Promise.resolve({ data: { error: CHARGE.savedError }, error: null });
          const amt = CHARGE.amount != null ? CHARGE.amount : (sale ? sale.rows.total_cents : 0);
          return Promise.resolve({ data: { ok: true, amount_cents: amt, paid_in_full: true, receipt_sent: CHARGE.receiptSent }, error: null });
        }
        if (body.action === 'finalize') {
          CHARGES.push(body);
          if (CHARGE.finalizeError) return Promise.resolve({ data: { error: CHARGE.finalizeError }, error: null });
          return Promise.resolve({ data: { ok: true, amount_cents: LAST_INTENT_AMOUNT, paid_in_full: true, receipt_sent: CHARGE.receiptSent }, error: null });
        }
      }
      return Promise.resolve({ data: { ok: true }, error: null });
    }
  }
};
// Stripe.js stand-in: Elements that mount, a PaymentMethod that is created
// (or refused), and a confirm that approves or declines, all scripted.
const STRIPE_STUB = {
  confirm: 'succeeded', pmError: null,
  elements() { return { create() { return { mount() {}, on() {} }; } }; },
  async createPaymentMethod() {
    return STRIPE_STUB.pmError ? { error: { message: STRIPE_STUB.pmError } } : { paymentMethod: { id: 'pm_test' } };
  },
  async confirmCardPayment(cs) {
    return STRIPE_STUB.confirm === 'succeeded'
      ? { paymentIntent: { id: 'pi_' + String(cs).replace('cs_test_', ''), status: 'succeeded' } }
      : { error: { message: 'Your card was declined.' } };
  }
};

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
  BTKDAgreements: A,
  PLAN_ROWS,
  PRICE_SETTINGS: { household_specialty_discount_cents: 1000, weekly_household_discount_cents: 0 },
  MB_PROGRAM_CARDS: [
    { key: 'Cubs', title: 'Cubs', ages: 'Ages 3–4' },
    { key: 'Juniors', title: 'Juniors Taekwondo', ages: 'Ages 5–12' },
    { key: 'Kickboxing', title: 'Kickboxing', ages: 'Ages 13+' }
  ],
  HH_ROWS: [], HH_LINKS: [], HH_LOADED: true, CATALOG_LOADED: true,
  PRODUCTS: [], PACKETS: [], EVENTS: [],
  PM_STRIPE: null, PM_CARD: null, PM_ELEMENTS: null, PM_LIVE: false,
  CATALOG: { products: 'ready', events: 'ready' },
  MEMBERS: [
    { id: 'kidA', first: 'Jamie', last: 'Lee', age: 9, role: '', segment: 'Active', rank: '', memberships: [], guardians: [] },
    { id: 'kidB', first: 'Sam', last: 'Lee', age: 11, role: '', segment: 'Active', rank: '', memberships: [], guardians: [] },
    // The paying parent. Buyer and participant are different people whenever a
    // parent enrols a child, which is the case the agreement has to get right.
    { id: 'parentP', first: 'Pat', last: 'Lee', age: 41, email: 'pat@example.com', role: '', segment: 'Active', rank: '', memberships: [], guardians: [] }
  ],
  document: documentShim,
  console,
  sb: sbShim,
  // Native confirm(), scripted: CONFIRM_OK decides the answer, CONFIRMS
  // records every question so tests can assert what was asked.
  confirm: msg => { CONFIRMS.push(msg); return CONFIRM_OK.value; },
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
  loadProfileMemberships: id => { REFRESHED.push('profile:' + id); },
  dashLoadUnsigned: () => { REFRESHED.push('dash'); },
  agrSignMembership: id => { REFRESHED.push('sign:' + id); },
  agrSendMembership: id => { REFRESHED.push('send:' + id); },
  // ONE window only — a second `window:` key in this literal silently wins and
  // would leave agrResolve believing the templates never loaded.
  window: { open: () => null, BTKDAgreements: A, devicePixelRatio: 1, Stripe: () => STRIPE_STUB },
  navigator: { userAgent: 'test-agent/1.0' },   // stamped onto signed agreements
};
const REFRESHED = [];
const CONFIRMS = [];
const CONFIRM_OK = { value: false };
const sandboxNav = [];
sandbox.sandboxNav = sandboxNav;
vm.createContext(sandbox);
vm.runInContext(VARS.map(liftVar).join('\n') + '\n' + FNS.map(liftFn).join('\n'), sandbox);
sandbox.posSale = sandbox.posBlank();

function dollarsFromCentsHost(c){ return (c/100).toFixed(2); }
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
  // Since 2026-08-15 a membership cannot tender unsigned. This test is about
  // where the snapshot lands, not about papering, so take the documented
  // "continue without signing" path explicitly.
  sandbox.posSale.lines[i].__agreementWaived = true;
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

await test('8 A2 intent: cents-only, plan codes not prices, server-priced products', async () => {
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'kidB';
  sandbox.posSale.discountCents = 500;
  SB_SELECT['memberships'] = [];
  await call('posAddMembership(null)');
  run("posPickProgram('Juniors Taekwondo')");
  run("posAddMemLine('juniors_option_c')");
  const i = sandbox.posSale.lines.length - 1;
  await call('posPickStudentForLine(' + i + ", 'kidA', true)");
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Beginner uniform', amount: 82.25, retail: 82.25, productDbId: 'prod-uuid-1', qty: 2, discType: 'pct', discVal: 10 });
  const intent = run("posBuildSaleIntent('11111111-2222-3333-4444-555555555555', 'Cash')");
  assert.strictEqual(intent.tender_method, 'cash');
  assert.strictEqual(intent.discount_cents, 500);
  const mem = intent.lines.find(l => l.kind === 'mem');
  assert.strictEqual(mem.student_id, 'kidA');
  assert.strictEqual(mem.plan_code, 'juniors_option_c', 'server re-quotes from the CODE — no client price rides the wire');
  assert.strictEqual(mem.cents, undefined, 'membership lines carry NO amount');
  const prod = intent.lines.find(l => l.kind === 'prod');
  assert.strictEqual(prod.product_id, 'prod-uuid-1');
  assert.strictEqual(prod.disc_type, 'pct');
  assert.strictEqual(prod.cents, undefined, 'product lines carry NO amount — server prices from the products table');
  assert.strictEqual(typeof intent.client_total_cents, 'number', 'client total rides along as a checksum only');
  assert.ok(Number.isInteger(intent.client_total_cents));
});

await test('9 vendored pricing_esm.js has not drifted from pricing.js', () => {
  const gen = require(path.join(__dirname, '..', 'tools', 'gen-esm-pricing.js'));
  const expected = gen.generate(fs.readFileSync(gen.SRC, 'utf8'));
  const committed = fs.readFileSync(gen.OUT, 'utf8');
  assert.strictEqual(committed, expected,
    'supabase/functions/_shared/pricing_esm.js is stale — run: node tools/gen-esm-pricing.js');
});

await test('11 admin fee rides every invoice by default; manual edit and paper-tender removal stick', async () => {
  // Card pass-through rates, as seeded in pricing_settings.
  sandbox.PRICE_SETTINGS.admin_fee_bps = 290;
  sandbox.PRICE_SETTINGS.admin_fee_flat_cents = 30;
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Beginner uniform', amount: 82.25, qty: 1, taxable: true });

  // Built, not tendered: the fee is already on the invoice.
  run('renderPOS()');
  // GROSSED UP since 2026-08-22: the fee is whatever makes the TOTAL net the
  // base after Stripe takes its percentage of that total. .25 + .77 =
  // .02, Stripe takes .77, the studio nets .25 exactly. The old
  // subtotal fee of .69 netted .17.
  assert.strictEqual(sandbox.posSale.adminFeeCents,
    sandbox.BTKDPricing.cardFeeCents(8225, 290, 30),
    'fee is grossed up from the pre-fee pre-tax base, applied at build time');
  assert.strictEqual(sandbox.posSale.adminFeeCents, 277);

  // It tracks line changes while untouched.
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Testing fee', amount: 60, qty: 1, taxable: true });
  run('renderPOS()');
  assert.strictEqual(sandbox.posSale.adminFeeCents,
    sandbox.BTKDPricing.cardFeeCents(14225, 290, 30));

  // Tax is computed on goods only — the fee is never taxed.
  const t = run('posTotals()');
  assert.strictEqual(t.cents.taxCents, Math.floor(14225 * 0.0825 + 0.5),
    'admin fee must not enter the tax base');
  assert.strictEqual(t.cents.totalCents, 14225 + sandbox.posSale.adminFeeCents + t.cents.taxCents);

  // A manual edit stops the auto-tracking for this invoice.
  ensureEl('edAmt').value = '5.00';
  run("posSaveAmount('fee')");
  assert.strictEqual(sandbox.posSale.adminFeeManual, true);
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Extra', amount: 10, qty: 1, taxable: true });
  run('renderPOS()');
  assert.strictEqual(sandbox.posSale.adminFeeCents, 500, 'manual fee survives later line changes');

  // The modal opens on Card and only asks about the fee when a PAPER tab is
  // chosen — the fee is a card-processing pass-through.
  await call("posPayOpen({mode:'sale'})");
  assert.ok(!/Remove admin fee\?/.test(ensureEl('sheet').innerHTML), 'card tab never asks');
  run("posPayTab('Cash')");
  assert.ok(/Remove admin fee\?/.test(ensureEl('pmAsk').innerHTML),
    'paper tab asks at selection time, in its own centered dialog');

  // Answering No keeps the fee; the modal still pays.
  await call('posPayFeeAnswer(false)');
  assert.strictEqual(sandbox.posSale.adminFeeCents, 500, 'No leaves the fee alone');

  // Answering Yes zeroes it and re-quotes the balance.
  run("posPayTab('Check')");
  await call('posPayFeeAnswer(true)');
  assert.strictEqual(sandbox.posSale.adminFeeCents, 0, 'Yes removes the fee from the sale');
  assert.strictEqual(run('PAY.feeCents'), 0);
});

await test('12 payment modal: change, partial, and the detail handed to posTender', async () => {
  sandbox.PRICE_SETTINGS.admin_fee_bps = 0;      // isolate the money math
  sandbox.PRICE_SETTINGS.admin_fee_flat_cents = 0;
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'kidA';
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Beginner uniform', amount: 82.25, qty: 1, taxable: true });
  run('renderPOS()');
  const total = run('posTotals()').cents.totalCents;   // 8225 + 8.25% tax

  await call("posPayOpen({mode:'sale'})");
  assert.strictEqual(run('PAY.balanceCents'), total, 'modal opens owing the full invoice');
  assert.strictEqual(ensureEl('pmAmt').value, run('dollarsFromCents(' + total + ')'), 'amount prefills to the balance');

  // Cash: tender more than due -> change, and it is only ever a display value.
  run("posPayTab('Cash')");
  ensureEl('pmTendered').value = '100.00';
  run('posPayChange()');
  assert.strictEqual(ensureEl('pmChangeV').textContent, run('money(' + ((10000 - total) / 100) + ')'),
    'change = tendered − amount due');

  // Handing over LESS than the asked amount is a PARTIAL payment, not an
  // error (reported 2026-08-15: $40 cash against an $89.04 invoice). The cash
  // that changed hands is the payment, there is no change, and the invoice
  // stays open for the rest.
  ensureEl('pmAmt').value = dollarsFromCentsHost(total);
  ensureEl('pmTendered').value = '50.00';
  run('posPayChange()');
  assert.strictEqual(ensureEl('pmChangeV').textContent, run('money(0)'),
    'short cash gives no change');
  assert.ok(/still be owed/.test(ensureEl('pmRemaining').innerHTML),
    'and says plainly what is left owed');

  SB_CALLS.length = 0;
  await call('posPaySubmit()');
  const sale = SB_CALLS.find(c => c.table === 'pos_sales' && c.op === 'insert');
  const pay = SB_CALLS.find(c => c.table === 'pos_payments' && c.op === 'insert');
  assert.ok(sale && pay, 'both the invoice and the payment were written');
  assert.strictEqual(pay.rows.amount_cents, 5000, 'the cash actually taken is the payment');
  assert.strictEqual(pay.rows.method, 'cash');
  assert.strictEqual(sale.rows.status, 'unpaid', 'a partial leaves the invoice open');
  assert.strictEqual(sale.rows.tender_method, null, 'no tender method until it is actually paid');
  assert.strictEqual(sale.rows.total_cents, total, 'the invoice still owes the full amount');
});

await test('13 a paid sale emails its receipt automatically; an unpaid one does not', async () => {
  sandbox.PRICE_SETTINGS.admin_fee_bps = 0;
  sandbox.PRICE_SETTINGS.admin_fee_flat_cents = 0;

  // Saved unpaid: nothing to receipt yet.
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'kidA';
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Beginner uniform', amount: 82.25, qty: 1, taxable: true });
  RECEIPTS.length = 0;
  await call("posTender('Unpaid')");
  assert.strictEqual(RECEIPTS.length, 0, 'an unpaid invoice must not send a receipt');

  // Paid at the desk: the receipt goes out on its own, addressed by sale id
  // only — the server resolves who to send it to.
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'kidA';
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Beginner uniform', amount: 82.25, qty: 1, taxable: true });
  RECEIPTS.length = 0;
  await call("posTender('Cash')");
  assert.strictEqual(RECEIPTS.length, 1, 'a paid sale sends exactly one receipt');
  assert.ok(RECEIPTS[0].sale_id, 'the receipt is addressed by sale id');
  assert.strictEqual(RECEIPTS[0].to, undefined,
    'the client never picks the recipient — the server reads the buyer on file');

  // A PARTIAL payment emails too — that is how they get the balance and the
  // link to finish paying online (owner call 2026-08-15).
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'kidA';
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Beginner uniform', amount: 82.25, qty: 1, taxable: true });
  run('renderPOS()');
  await call("posPayOpen({mode:'sale'})");
  run("posPayTab('Cash')");
  ensureEl('pmTendered').value = '40.00';
  RECEIPTS.length = 0;
  await call('posPaySubmit()');
  assert.strictEqual(RECEIPTS.length, 1, 'a partial payment still sends the invoice email');
});

await test('14 admin fee follows the METHOD: off for cash, back on for card', async () => {
  sandbox.PRICE_SETTINGS.admin_fee_bps = 290;
  sandbox.PRICE_SETTINGS.admin_fee_flat_cents = 30;
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'kidA';
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Sparring gear package', amount: 242.50, qty: 1, taxable: true });
  run('renderPOS()');
  const fee = sandbox.BTKDPricing.cardFeeCents(24250, 290, 30);   // 755, grossed up
  assert.strictEqual(sandbox.posSale.adminFeeCents, fee, 'card-priced by default');

  await call("posPayOpen({mode:'sale'})");
  assert.strictEqual(run('PAY.feeOriginal'), fee, 'the modal remembers what to restore to');

  // Cash: drop it, and it must STAY dropped through re-renders.
  await call("posPayTab('Cash')");
  await call('posPayFeeAnswer(true)');
  assert.strictEqual(sandbox.posSale.adminFeeCents, 0, 'cash drops the fee');
  assert.strictEqual(sandbox.posSale.adminFeeSuppressed, true);
  run('renderPOS()');
  assert.strictEqual(sandbox.posSale.adminFeeCents, 0,
    'a re-render must not silently put it back while cash is selected');

  // Back to Card: it returns on its own. This is the bug Race reported.
  await call("posPayTab('Card')");
  assert.strictEqual(sandbox.posSale.adminFeeCents, fee, 'card restores the fee');
  assert.strictEqual(sandbox.posSale.adminFeeSuppressed, false);
  assert.strictEqual(run('PAY.feeCents'), fee);

  // An explicitly typed fee outranks all of it.
  ensureEl('edAmt').value = '1.00';
  run("posSaveAmount('fee')");
  await call("posPayTab('Cash')");
  await call('posPayFeeAnswer(true)');
  await call("posPayTab('Card')");
  assert.strictEqual(sandbox.posSale.adminFeeCents, 0,
    'a manual fee is never auto-restored — the operator is in charge');
});

await test('15 a membership cannot tender unsigned; a signed one files its agreement', async () => {
  // The agreement carries the authorization to charge, so an unsigned
  // membership must not reach the ledger at all.
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'parentP';   // the parent is paying
  SB_SELECT['memberships'] = [];
  SB_SELECT['enrollments'] = [];
  await call('posAddMembership(null)');
  run("posPickProgram('Cubs')");
  run("posAddMemLine('cubs_option_a')");
  const i = sandbox.posSale.lines.length - 1;
  await call('posPickStudentForLine(' + i + ", 'kidA', true)");   // ...for the child

  SB_CALLS.length = 0;
  await call("posTender('Cash')");
  assert.ok(!SB_CALLS.some(c => c.table === 'pos_sales' && c.op === 'insert'),
    'an unsigned membership reached the ledger');
  assert.ok(!SB_CALLS.some(c => c.table === 'memberships' && c.op === 'insert'),
    'an unsigned membership was committed');

  // Now sign it through the REAL flow — open the sheet, fill the fields, draw
  // on the pad, accept — rather than planting a fake __agreement. This is the
  // path a parent actually takes at the desk.
  await call('agrOpenSign(' + i + ')');
  const doc = ensureEl('sheet')._html;
  assert.ok(/CUBS MEMBERSHIP AGREEMENT/.test(doc), 'the Cubs document did not render');
  assert.ok(/electronic debit \(ACH\)/.test(doc), 'the payment authorization is missing');
  assert.ok(/twelve \(12\) months/.test(doc), 'Cubs did not render as a twelve-month agreement');

  // The document is about the CHILD, and the sheet has to say so — the parent
  // is only paying and signing.
  assert.ok(/Agreement for/.test(doc), 'the sheet never says who the agreement is for');
  assert.ok(/Jamie Lee/.test(doc), 'the participant is not named on the sheet');
  assert.ok(/agr-minor/.test(doc), 'a 9-year-old was not flagged as a minor');
  assert.ok(/Paid by/.test(doc) && /Pat Lee/.test(doc), 'the paying parent is not shown');
  // Signer defaults to the parent, never the child.
  assert.strictEqual(ensureEl('agrSigner').value, 'Pat Lee', 'signer did not default to the parent');
  assert.strictEqual(ensureEl('agrGuardian').value, 'Pat Lee', 'guardian did not default to the parent');
  assert.strictEqual(ensureEl('agrRel').value, 'Parent', 'relationship did not default to Parent');

  // A minor with no guardian named must not be signable.
  ensureEl('agrGuardian').value = '';
  const pad0 = ensureEl('agrPad');
  pad0.__on.pointerdown({ clientX: 10, clientY: 10, pointerId: 1, preventDefault(){} });
  await call('agrAccept()');
  assert.ok(!sandbox.posSale.lines[i].__agreement, "a minor's agreement was signed with no guardian named");
  ensureEl('agrGuardian').value = 'Pat Lee';

  ensureEl('agrDob').value = '2016-04-02';
  run("agrField('dobYMD', '2016-04-02')");
  ensureEl('agrPayDate').value = 'the 1st of each month';
  run("agrField('agreedPaymentDate', 'the 1st of each month')");
  // A real stroke on the pad, through the handler agrSigInit registered.
  const pad = ensureEl('agrPad');
  assert.ok(pad.__on && pad.__on.pointerdown, 'the signature pad never bound its handlers');
  pad.__on.pointerdown({ clientX: 20, clientY: 40, pointerId: 1, preventDefault(){} });

  SB_CALLS.length = 0;
  SB_INSERT_RESULT['memberships'] = { id: 'mem-1' };
  await call('agrAccept()');
  assert.ok(sandbox.posSale.lines[i].__agreement, 'signing did not attach the agreement to the line');

  // Detail typed on the contract is saved back, so it is entered once.
  const dobUpd = SB_CALLS.find(c => c.table === 'contacts' && c.op === 'update');
  assert.ok(dobUpd, 'date of birth was not written back to the contact');
  assert.strictEqual(dobUpd.patch.dob, '2016-04-02', 'the wrong date of birth was saved');
  const gLink = SB_CALLS.find(c => c.table === 'student_guardians' && c.op === 'insert');
  assert.ok(gLink, 'the signing parent was not linked as a guardian');
  assert.strictEqual(gLink.rows.student_id, 'kidA', 'guardian linked to the wrong student');
  assert.strictEqual(gLink.rows.email, 'pat@example.com', 'guardian linked with the wrong email');

  await call("posTender('Cash')");
  const agr = SB_CALLS.find(c => c.table === 'membership_agreements' && c.op === 'insert');
  assert.ok(agr, 'a signed agreement was not filed');
  const row = agr.rows[0];
  assert.strictEqual(row.membership_id, 'mem-1', 'agreement not tied to the membership row');
  assert.strictEqual(row.contact_id, 'kidA', 'agreement filed against the wrong person');
  assert.strictEqual(row.template_key, 'cubs', 'the wrong document was filed');
  assert.strictEqual(row.signer_name, 'Pat Lee');
  assert.strictEqual(row.signer_relationship, 'Parent');
  assert.strictEqual(row.agreed_payment_date, 'the 1st of each month');
  assert.ok(/^data:image\/png/.test(row.signature_png), 'no signature image was captured');
  // The stored text must be the whole executed document, not a summary.
  assert.ok(/Smith County, Texas/.test(row.body_text), 'the waiver is missing from the stored document');
  assert.ok(/Jamie Lee/.test(row.body_text), 'the participant is missing from the stored document');
  assert.ok(row.body_text.length > 8000, 'the stored document looks truncated');
  assert.ok(row.body_json && row.body_json.title === 'Cubs Membership Agreement',
    'the frozen render was not stored');
});


/* ── Card at the desk on a NEW sale (2026-08-21) ──────────────────────────
 * The membership never waits for the money: the sale is saved exactly as
 * "Save unpaid" saves it, then the invoice is charged through pos-charge.
 * The client records nothing about the card; the server does, after Stripe
 * confirms, and the server sends the receipt. */
function cardSale() {
  sandbox.PRICE_SETTINGS.admin_fee_bps = 0;
  sandbox.PRICE_SETTINGS.admin_fee_flat_cents = 0;
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'parentP';
  sandbox.posSale.lines.push({ kind: 'prod', label: 'Beginner uniform', amount: 82.25, qty: 1, taxable: true });
  run('renderPOS()');
  STRIPE_STUB.confirm = 'succeeded'; STRIPE_STUB.pmError = null;
  CHARGE.intentError = null; CHARGE.finalizeError = null; CHARGE.amount = null;
  SB_CALLS.length = 0; CHARGES.length = 0; RECEIPTS.length = 0; sandboxNav.length = 0;
}
async function openCard() {
  await call("posPayOpen({mode:'sale'})");
  assert.strictEqual(run('PAY.method'), 'Card', 'the modal opens on Card');
  sandbox.PM_STRIPE = STRIPE_STUB; sandbox.PM_CARD = { stub: true };
}
const saleInsert = () => SB_CALLS.find(c => c.table === 'pos_sales' && c.op === 'insert');
const clientCardRow = () => SB_CALLS.find(c => c.table === 'pos_payments' && c.op === 'insert' && c.rows && c.rows.method === 'card');
const paidFlip = () => SB_CALLS.find(c => c.table === 'pos_sales' && c.op === 'update' && c.patch && c.patch.status === 'paid');

await test('16 new sale + Card: saved UNPAID with membership and roster, then charged; nothing paid until Stripe says so', async () => {
  cardSale();
  SB_SELECT['memberships'] = []; SB_SELECT['enrollments'] = [];
  await call('posAddMembership(null)');
  run("posPickProgram('Cubs')");
  run("posAddMemLine('cubs_option_a')");
  const i = sandbox.posSale.lines.length - 1;
  await call('posPickStudentForLine(' + i + ", 'kidA', true)");
  sandbox.posSale.lines[i].__agreementWaived = true;   // documented "continue without signing" path, as in test 7
  SB_CALLS.length = 0;
  await openCard();
  CHARGE.intentError = 'Payments are not configured yet.';
  await call('posPaySubmit()');
  const sale = saleInsert();
  assert.ok(sale, 'the sale is saved');
  assert.strictEqual(sale.rows.status, 'unpaid', 'saved UNPAID, never paid by the client');
  assert.strictEqual(sale.rows.tender_method, null, 'no tender method until the card clears');
  assert.strictEqual(sale.rows.confirmed_at, null);
  assert.ok(SB_CALLS.find(c => c.table === 'memberships' && c.op === 'insert'), 'membership created before the charge (activation does not wait for money)');
  assert.ok(SB_CALLS.find(c => c.table === 'enrollments' && c.op === 'insert'), 'roster seeded before the charge');
  assert.ok(!clientCardRow(), 'the client never writes a card payment row');
  assert.ok(!paidFlip(), 'the client never flips the invoice to paid');
  const intent = CHARGES.find(c => c.action === 'intent');
  assert.ok(intent && intent.sale_id === sale.rows.id, 'pos-charge is asked for THIS sale id');
  assert.ok(intent.saleKnown, 'the sale row exists before the intent is requested');
  assert.ok(!CHARGES.find(c => c.action === 'finalize'), 'no finalize without an intent');
  assert.strictEqual(RECEIPTS.length, 0, 'no receipt for money that did not move');
  const banner = run('INV_BANNER');
  assert.ok(banner && banner.saleId === sale.rows.id && banner.problems.some(p => /Card not charged/.test(p)), 'staff are told the card did not charge');
  assert.ok(banner.problems.some(p => /unpaid/.test(p)), 'and that the invoice is unpaid and retryable');
  const nav = sandboxNav[sandboxNav.length - 1];
  assert.ok(nav && nav.id === sale.rows.id, 'lands on the unpaid invoice');
  assert.strictEqual(sandbox.posSale.lines.length, 0, 'builder resets for the next sale');
});

await test('17 new sale + Card approved: the server records the payment, the client sends nothing else', async () => {
  cardSale();
  await openCard();
  await call('posPaySubmit()');
  const sale = saleInsert();
  assert.ok(sale && sale.rows.status === 'unpaid', 'still saved unpaid first');
  const intent = CHARGES.find(c => c.action === 'intent');
  assert.ok(intent && intent.sale_id === sale.rows.id && intent.saleKnown, 'intent for the already-saved sale');
  const fin = CHARGES.find(c => c.action === 'finalize');
  assert.ok(fin && fin.sale_id === sale.rows.id && /^pi_/.test(fin.payment_intent_id), 'finalize with the confirmed intent');
  assert.ok(!clientCardRow() && !paidFlip(), 'the server owns the payment row and the paid flip');
  assert.strictEqual(RECEIPTS.length, 0, 'the receipt is sent by pos-charge, not by the client');
  const banner = run('INV_BANNER');
  assert.ok(banner.badges.some(b => /Card approved/.test(b)), 'success badge rides the invoice');
  assert.strictEqual(banner.problems.length, 0);
  const nav = sandboxNav[sandboxNav.length - 1];
  assert.ok(nav && nav.id === sale.rows.id, 'lands on the invoice');
});

await test('18 new sale + Card declined: invoice stays unpaid, nothing fake recorded, staff told to retry', async () => {
  cardSale();
  await openCard();
  STRIPE_STUB.confirm = 'declined';
  await call('posPaySubmit()');
  const sale = saleInsert();
  assert.ok(sale && sale.rows.status === 'unpaid');
  assert.ok(CHARGES.find(c => c.action === 'intent'), 'the charge was attempted');
  assert.ok(!CHARGES.find(c => c.action === 'finalize'), 'no finalize after a decline');
  assert.ok(!clientCardRow() && !paidFlip());
  assert.strictEqual(RECEIPTS.length, 0);
  const banner = run('INV_BANNER');
  assert.ok(banner.problems.some(p => /declined/.test(p)), "Stripe's reason reaches the invoice banner");
  assert.ok(banner.problems.some(p => /unpaid/.test(p) && /Add payment/.test(p)), 'says how to retry');
});

await test('19 new sale + Card with an incomplete card: nothing is written at all', async () => {
  cardSale();
  await openCard();
  STRIPE_STUB.pmError = 'Your card number is incomplete.';
  await call('posPaySubmit()');
  assert.strictEqual(SB_CALLS.length, 0, 'no database writes');
  assert.strictEqual(CHARGES.filter(c => c.action !== 'config').length, 0, 'pos-charge not called');
  assert.ok(run('PAY') !== null, 'the modal stays open so the card can be fixed');
  assert.strictEqual(ensureEl('pmPay').disabled, false, 'Pay Now is usable again');
  assert.strictEqual(ensureEl('pmCardErr').textContent, 'Your card number is incomplete.');
});

await test('20 posTender can no longer record a card payment on its own', async () => {
  cardSale();
  const res = await call("posTender('Card')");
  const sale = saleInsert();
  assert.ok(sale && sale.rows.status === 'unpaid' && sale.rows.tender_method === null, "'Card' is saved as unpaid");
  assert.ok(!clientCardRow(), 'no card payment row');
  assert.ok(res && res.saleId === sale.rows.id, 'posTender reports the sale id it wrote');
  assert.ok(!/Card:'card'/.test(html), 'the client tender map has no card entry');
});

await test('21 a partial amount on the Card tab is refused before any write', async () => {
  cardSale();
  await openCard();
  ensureEl('pmAmt').value = '1.00';
  await call('posPaySubmit()');
  assert.strictEqual(SB_CALLS.length, 0, 'nothing written');
  assert.strictEqual(CHARGES.filter(c => c.action !== 'config').length, 0, 'nothing charged');
  assert.ok(/full/.test(TOASTS[TOASTS.length - 1] || ''), 'asks for the full balance');
});

await test('22 invoice-mode Card: a decline or a failed finalize writes nothing from the client', async () => {
  sandbox.posSale = sandbox.posBlank();
  SB_CALLS.length = 0; CHARGES.length = 0; RECEIPTS.length = 0;
  STRIPE_STUB.confirm = 'declined'; STRIPE_STUB.pmError = null;
  CHARGE.intentError = null; CHARGE.finalizeError = null; CHARGE.amount = 5000;
  await call("posPayOpen({mode:'invoice', saleId:'11111111-2222-3333-4444-555555555555', balanceCents:5000, totalCents:5000, who:'Jamie Lee', reopen:'inv'})");
  sandbox.PM_STRIPE = STRIPE_STUB; sandbox.PM_CARD = { stub: true };
  await call('posPaySubmit()');
  assert.strictEqual(SB_CALLS.filter(c => c.op === 'insert' || c.op === 'update').length, 0, 'decline: no writes');
  assert.ok(run('PAY') !== null, 'modal stays open');
  STRIPE_STUB.confirm = 'succeeded'; CHARGE.finalizeError = 'boom';
  await call('posPaySubmit()');
  assert.strictEqual(SB_CALLS.filter(c => c.op === 'insert' || c.op === 'update').length, 0, 'finalize failure: still no client writes');
  assert.ok(/Stripe/.test(ensureEl('pmCardErr').textContent), 'tells staff to check Stripe before charging again');
  assert.strictEqual(RECEIPTS.length, 0);
  CHARGE.amount = null;
});

await test('23 the Reader tab records nothing', async () => {
  cardSale();
  await call("posPayOpen({mode:'sale'})");
  await call("posPayTab('Terminal')");
  await call('posPaySubmit()');
  assert.strictEqual(SB_CALLS.length, 0);
  assert.strictEqual(CHARGES.filter(c => c.action !== 'config').length, 0);
});

await test('24 tripwire: the server tender path stays off until it carries partial payments and agreements', async () => {
  assert.strictEqual(run('POS_SERVER_SALES'), false, 'flip this only after pos-sale writes agreements and PAY_DETAIL partials');
});

await test('25 a buyer name with markup is escaped in the POS header', async () => {
  sandbox.MEMBERS.push({ id: 'evil', first: '<b>Evil</b>', last: '<img src=x onerror=1>', age: 30, role: '', segment: 'Lead', rank: '', memberships: [], guardians: [], phones: [], email: '' });
  sandbox.posSale = sandbox.posBlank();
  sandbox.posSale.memberId = 'evil';
  run('renderPOS()');
  const out = ensureEl('view-pos').innerHTML;
  assert.ok(out.includes('&lt;b&gt;Evil&lt;/b&gt;'), 'the buyer name is escaped');
  assert.ok(!out.includes('<img src=x'), 'no raw markup from a contact name');
  sandbox.MEMBERS.pop();
});

await test('26 suite-wide: the client never wrote a card payment row', async () => {
  assert.ok(!ALL_CALLS.some(c => c.table === 'pos_payments' && c.op === 'insert' && c.rows && c.rows.method === 'card'),
    'a pos_payments row with method card may only come from pos-charge or the webhook');
});

await test('27 a paid invoice a refund re-opened can be closed; the filter never touches a closed one', async () => {
  sandbox.INV_CUR = { from: 'pos' };
  await run('posCloseInvoice("sale-refunded")');
  const upd = ALL_CALLS.filter(c => c.table === 'pos_sales' && c.op === 'update').pop();
  assert.ok(upd && upd.patch && upd.patch.status === 'closed', 'close writes status closed');
  const src = /async function posCloseInvoice\(saleId\)\{[\s\S]*?\n\}/.exec(html)[0];
  assert.ok(/\.in\('status', \['unpaid','paid'\]\)/.test(src), 'unpaid or paid-then-refunded may close');
  assert.ok(!/eq\('status','unpaid'\)/.test(src), 'the old unpaid-only filter is gone');
  assert.ok(/s\.status==='unpaid' \|\| \(s\.status==='paid' && balance>0\)\) h \+= '<button class="iv-abtn" onclick="posCloseInvoiceSheet/.test(html),
    'Close is offered on a paid invoice once a refund leaves a balance');
});

await test('28 a refund that leaves a balance puts the invoice back to unpaid and resets the receipt claim', async () => {
  // Source-level: the desk refund reopens through one helper, the helper only
  // touches a paid invoice whose net is short of the total, and the Refund
  // button no longer needs status paid (a partly refunded invoice is unpaid).
  const save = /async function posRefundSave\(saleId, maxCents\)\{[\s\S]*?\n\}/.exec(html)[0];
  assert.ok(/await posReopenAfterRefund\(saleId\);/.test(save), 'desk refund reopens the invoice');
  const helper = /async function posReopenAfterRefund\(saleId\)\{[\s\S]*?\n\}/.exec(html)[0];
  assert.ok(/status:'unpaid', receipt_sent_at:null/.test(helper), 'reopen = unpaid + receipt claim cleared');
  assert.ok(/\.eq\('status','paid'\)/.test(helper), 'only a paid invoice reopens');
  assert.ok(/net >= sRes\.data\.total_cents\) return;/.test(helper), 'an overpayment refund leaves it paid');
  assert.ok(/if\(paidNet>0 && s\.status!=='closed'\) h \+= '<button class="iv-abtn" onclick="posRefundSheet/.test(html), 'Refund offered on any open invoice with money on it');
  // Behaviour: the helper runs against the shim without throwing and never
  // writes when the sale cannot be read.
  await run('posReopenAfterRefund("sale-x")');
  assert.ok(!ALL_CALLS.some(c => c.table === 'pos_sales' && c.op === 'update' && c.patch && c.patch.status === 'unpaid'), 'no reopen without a readable paid sale');
});

/* ── cards already on file ────────────────────────────────────────────── */

await test('29 a card on file charges on the server, with no card field and no client-side confirm', async () => {
  cardSale();
  SAVED_CARDS = [{ id: 'pm_visa', brand: 'visa', last4: '4242', exp: '04/29', def: true }];
  PM_CALLS.length = 0;
  await openCard();
  await run('pmLoadSaved()');
  assert.ok(PM_CALLS.some(c => c.action === 'list'), 'the sheet asks Stripe whose cards these are');
  run("pmPick('pm_visa')");
  assert.strictEqual(run('PAY.pm'), 'pm_visa', 'the chosen card is remembered');
  await call('posPaySubmit()');
  const sale = saleInsert();
  assert.ok(sale && sale.rows.status === 'unpaid', 'the sale is still saved unpaid first');
  const cof = CHARGES.find(c => c.action === 'charge-saved');
  assert.ok(cof, 'charged through charge-saved');
  assert.strictEqual(cof.payment_method_id, 'pm_visa', 'and with the card that was picked');
  assert.ok(cof.saleKnown, 'the sale row exists before the charge');
  // The whole point: nothing about this went through the browser's card field.
  assert.ok(!CHARGES.find(c => c.action === 'intent'), 'no client-confirmed intent');
  assert.ok(!CHARGES.find(c => c.action === 'finalize'), 'no finalize; the server records it');
  assert.ok(!clientCardRow() && !paidFlip(), 'the client never writes the payment or flips the invoice');
  assert.strictEqual(RECEIPTS.length, 0, 'the receipt is the server\'s to send');
  const banner = run('INV_BANNER');
  assert.ok(banner.badges.some(b => /Card approved/.test(b)), 'success rides the invoice');
});

await test('30 a declined card on file leaves the membership standing and the invoice unpaid', async () => {
  cardSale();
  SAVED_CARDS = [{ id: 'pm_visa', brand: 'visa', last4: '4242', exp: '04/29', def: true }];
  await openCard();
  await run('pmLoadSaved()');
  run("pmPick('pm_visa')");
  CHARGE.savedError = 'The card was declined: insufficient funds';
  await call('posPaySubmit()');
  CHARGE.savedError = null;
  const sale = saleInsert();
  assert.ok(sale && sale.rows.status === 'unpaid', 'the sale stays unpaid');
  assert.ok(!clientCardRow() && !paidFlip(), 'nothing fake recorded');
  assert.strictEqual(RECEIPTS.length, 0, 'no receipt for money that did not move');
  const banner = run('INV_BANNER');
  assert.ok(banner.problems.some(p => /declined/.test(p)), "Stripe's reason reaches the banner");
  assert.ok(banner.problems.some(p => /unpaid/.test(p) && /Add payment/.test(p)), 'says how to retry');
});

await test('31 no saved cards means no picker at all, and the typed card still works', async () => {
  cardSale();
  SAVED_CARDS = [];
  await openCard();
  await run('pmLoadSaved()');
  assert.strictEqual(run('PAY.pm') || null, null, 'nothing is preselected');
  await call('posPaySubmit()');
  assert.ok(CHARGES.find(c => c.action === 'intent'), 'the keyed path is untouched');
  assert.ok(!CHARGES.find(c => c.action === 'charge-saved'), 'and charge-saved is not used');
});

await test('32 a partial amount cannot be taken from a card on file', async () => {
  // Not a limitation for its own sake: the server charges the LEDGER balance,
  // so letting a smaller number be typed would silently take the full amount.
  cardSale();
  SAVED_CARDS = [{ id: 'pm_visa', brand: 'visa', last4: '4242', exp: '04/29', def: true }];
  await openCard();
  await run('pmLoadSaved()');
  run("pmPick('pm_visa')");
  const el = sandbox.document.getElementById('pmAmt');
  if (el) { el.value = '5.00'; run('posPayChange()'); }
  SB_CALLS.length = 0; CHARGES.length = 0;
  await call('posPaySubmit()');
  assert.ok(!CHARGES.find(c => c.action === 'charge-saved'), 'refused before any charge');
  assert.ok(!saleInsert(), 'and before anything is written');
});

/* ── add a membership, in three steps ─────────────────────────────────────
 * Terms, money, paperwork. The flow owns no pricing and no ledger writes of
 * its own; these pin that it really does drive the same machinery, and that
 * the till's cart survives being interrupted by it. */

async function addOpen(opts) {
  opts = opts || {};
  sandbox.PRICE_SETTINGS.admin_fee_bps = 0;
  sandbox.PRICE_SETTINGS.admin_fee_flat_cents = 0;
  sandbox.posSale = sandbox.posBlank();
  if (opts.cartFirst) {
    sandbox.posSale.lines.push({ kind: 'prod', label: 'Belt', amount: 12, qty: 1, taxable: true });
  }
  SAVED_CARDS = opts.cards || [];
  // The flow is launched FROM a profile, so that profile is the one open.
  run("selectedId = 'kidA'");
  SB_SELECT['memberships'] = SB_SELECT['memberships'] || [];
  STRIPE_STUB.confirm = 'succeeded'; STRIPE_STUB.pmError = null;
  CHARGE.intentError = null; CHARGE.finalizeError = null; CHARGE.savedError = null; CHARGE.amount = null;
  SB_CALLS.length = 0; CHARGES.length = 0; RECEIPTS.length = 0; sandboxNav.length = 0; PM_CALLS.length = 0;
  await call("memAddOpen('kidA')");
}

await test('33 step one quotes through the pricing engine, and an override with no reason is refused', async () => {
  await addOpen();
  assert.strictEqual(run('MADD.step'), 1);
  const calc = run('MADD.calc');
  assert.ok(calc && calc.eligible, 'it opens on a real, sellable quote');
  // The engine's number, not one this sheet worked out.
  const engine = run("posQuote(MADD.code, MADD.ctx)");
  assert.strictEqual(calc.finalRecurringCents, engine.finalRecurringCents, 'the price is BTKDPricing\'s');
  assert.strictEqual(run('memAddDueCents()'), run('posMemDueCents(MADD.calc, null)'), 'due today is the engine\'s too');

  run("memAddSet('priceRaw','55.00')");
  await call('memAddNext()');
  assert.strictEqual(run('MADD.step'), 1, 'an override with no reason does not move on');
  run("memAddSet('reason','sibling rate agreed at the desk')");
  await call('memAddNext()');
  assert.strictEqual(run('MADD.step'), 2, 'with a reason it does');
  assert.strictEqual(run('memAddOverride().recurringCents'), 5500, 'and the override is what will be sold');
});

await test('34 an empty override box is left alone, never read as free', async () => {
  await addOpen();
  const asked = run('MADD.calc').finalRecurringCents;
  run("memAddSet('priceRaw','')");
  run("memAddSet('downRaw','')");
  assert.strictEqual(run('memAddOverride()'), null, 'blank boxes mean sell the recommended price');
  // Only the down payment moved: the recurring price must not fall to zero.
  run("memAddSet('downRaw','0')");
  run("memAddSet('reason','waived joining fee')");
  assert.strictEqual(run('memAddOverride()').recurringCents, asked, 'the untouched price is preserved');
  assert.strictEqual(run('memAddOverride()').downCents, 0, 'and the one he did type is honoured');
});

await test('35 the money goes through posTender and the server, and the membership never waits for it', async () => {
  await addOpen({ cards: [{ id: 'pm_visa', brand: 'visa', last4: '4242', exp: '04/29', def: true }] });
  await call('memAddNext()');
  await call('memAddLoadCards()');
  assert.strictEqual(run('MADD.pay'), 'pm_visa', 'their default card is the obvious answer');
  await call('memAddNext()');

  const sale = saleInsert();
  assert.ok(sale, 'the sale is recorded');
  assert.strictEqual(sale.rows.status, 'unpaid', 'saved unpaid first, as the till does');
  assert.ok(SB_CALLS.find(c => c.table === 'memberships' && c.op === 'insert'), 'the membership exists before the money');
  const cof = CHARGES.find(c => c.action === 'charge-saved');
  assert.ok(cof && cof.payment_method_id === 'pm_visa', 'charged through charge-saved with the chosen card');
  assert.ok(!clientCardRow() && !paidFlip(), 'this flow writes no payment row and flips nothing');
  assert.strictEqual(RECEIPTS.length, 0, 'the receipt is the server\'s to send');
  assert.strictEqual(run('MADD.step'), 3, 'and it lands on the paperwork');
  assert.strictEqual(run('MADD.paidOk'), true);
});

await test('36 a declined card still leaves the membership standing, and says so', async () => {
  await addOpen({ cards: [{ id: 'pm_visa', brand: 'visa', last4: '4242', exp: '04/29', def: true }] });
  await call('memAddNext()');
  await call('memAddLoadCards()');
  CHARGE.savedError = 'The card was declined: insufficient funds';
  await call('memAddNext()');
  CHARGE.savedError = null;
  assert.ok(SB_CALLS.find(c => c.table === 'memberships' && c.op === 'insert'), 'the membership is created anyway');
  assert.strictEqual(saleInsert().rows.status, 'unpaid', 'the invoice stays open');
  assert.strictEqual(run('MADD.paidOk'), false);
  assert.ok(/declined/.test(run('MADD.paidNote')), 'the reason is carried to the last step');
  assert.ok(/retry/.test(run('MADD.paidNote')), 'and it says what to do about it');
});

await test('37 an invoice creates the membership and takes no money', async () => {
  await addOpen();
  await call('memAddNext()');
  run("memAddPay('invoice')");
  await call('memAddNext()');
  assert.ok(SB_CALLS.find(c => c.table === 'memberships' && c.op === 'insert'), 'the membership is created');
  assert.strictEqual(saleInsert().rows.status, 'unpaid');
  assert.strictEqual(CHARGES.length, 0, 'nothing was charged');
  assert.ok(/owing/.test(run('MADD.paidNote')), 'and it says the invoice is open');
});

await test('38 skipping the signature flags the membership rather than hiding it', async () => {
  await addOpen();
  await call('memAddNext()');
  run("memAddPay('invoice')");
  await call('memAddNext()');
  // Payment before signature is deliberate, so the line is waived on purpose;
  // step three is what stops that being forgotten.
  assert.ok(!/No agreement on file/.test(run('memAddStep3()')), 'no warning until skip is actually chosen');
  run("memAddSign('skip')");
  assert.ok(/No agreement on file/.test(run('memAddStep3()')), 'choosing skip says where it will show');
  assert.ok(/dashboard/.test(run('memAddStep3()')), 'and that the dashboard carries it too');
  await call('memAddNext()');
  assert.strictEqual(run('MADD'), null, 'the sheet closes');
});

await test('39 the till\'s cart survives being interrupted, and after a cancel too', async () => {
  await addOpen({ cartFirst: true });
  assert.strictEqual(sandbox.posSale.lines.length, 1, 'the cart is still there while step one is open');
  run('memAddClose()');
  assert.strictEqual(sandbox.posSale.lines.length, 1, 'and after cancelling');
  assert.strictEqual(sandbox.posSale.lines[0].label, 'Belt', 'unchanged');

  await addOpen({ cartFirst: true });
  await call('memAddNext()');
  run("memAddPay('invoice')");
  await call('memAddNext()');
  // The sale this flow recorded must not have swept the desk's cart with it.
  assert.strictEqual(sandbox.posSale.lines.length, 1, 'the cart survives a completed sale');
  assert.strictEqual(sandbox.posSale.lines[0].label, 'Belt');
  const sold = saleInsert();
  assert.ok(sold.rows.total_cents > 0, 'and the belt was not billed to the member');
  const lines = SB_CALLS.filter(c => c.table === 'pos_sale_lines' && c.op === 'insert');
  const labels = lines.flatMap(c => (Array.isArray(c.rows) ? c.rows : [c.rows])).map(r => r.label);
  assert.ok(!labels.includes('Belt'), 'the belt is not on the membership invoice');
});

await test('40 each paperwork choice goes where it says, and a lost membership row is not papered over', async () => {
  for (const pick of [['person', 'sign:'], ['email', 'send:']]) {
    await addOpen();
    await call('memAddNext()');
    run("memAddPay('invoice')");
    await call('memAddNext()');
    const mid = run('MADD.membershipId');
    assert.ok(mid, 'the membership row id came back from the tender');
    REFRESHED.length = 0;
    run("memAddSign('" + pick[0] + "')");
    await call('memAddNext()');
    assert.ok(REFRESHED.includes(pick[1] + mid), pick[0] + ' opens the right thing for THIS membership');
    assert.ok(REFRESHED.includes('profile:kidA'), 'and the profile is refreshed either way');
  }

  // If the membership row did not save, posTender has already said so. Sending
  // somebody an agreement for a membership that does not exist would be worse
  // than saying nothing.
  await addOpen();
  await call('memAddNext()');
  run("memAddPay('invoice')");
  await call('memAddNext()');
  run('MADD.membershipId = null');
  REFRESHED.length = 0; TOASTS.length = 0;
  run("memAddSign('email')");
  await call('memAddNext()');
  assert.ok(!REFRESHED.some(r => /^send:/.test(r)), 'nothing is sent without a membership to attach it to');
  assert.ok(TOASTS.some(t => /No membership row/.test(t)), 'and it says why');
});

await test('41 an unpaid invoice from the add flow offers its own email - and only sends on yes', async () => {
  // Born 2026-08-31: an agreement went out, the invoice silently did not,
  // and a member had a bill she had never seen (Christian Brown).
  SB_SELECT['pos_sales'] = [{ status: 'unpaid' }];

  // Declined: asked, but nothing sends.
  CONFIRM_OK.value = false; CONFIRMS.length = 0; RECEIPTS.length = 0;
  await addOpen();
  await call('memAddNext()');
  run("memAddPay('invoice')");
  await call('memAddNext()');
  run("memAddSign('skip')");
  await call('memAddNext()');
  assert.ok(CONFIRMS.some(q => /Email it to .*pay link/.test(q)), 'the flow offers the invoice email');
  assert.strictEqual(RECEIPTS.length, 0, 'declining sends nothing');

  // Accepted: the send-receipt call goes out for THIS sale.
  CONFIRM_OK.value = true; CONFIRMS.length = 0; RECEIPTS.length = 0;
  await addOpen();
  await call('memAddNext()');
  run("memAddPay('invoice')");
  await call('memAddNext()');
  const sale = run('MADD.saleId');
  run("memAddSign('skip')");
  await call('memAddNext()');
  assert.ok(CONFIRMS.length === 1, 'asked exactly once');
  assert.ok(RECEIPTS.some(r => r.sale_id === sale), 'accepting emails the invoice for this sale');

  CONFIRM_OK.value = false;
  delete SB_SELECT['pos_sales'];
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
})();