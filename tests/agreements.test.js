/* ============================================================================
 * BaresTKD — membership agreement tests
 * ----------------------------------------------------------------------------
 * Plain Node, no framework. Run from the BaresCRM repo root:
 *
 *     node tests/agreements.test.js
 *
 * Two layers:
 *   1. agreements.js as data — every program a membership can be sold under
 *      resolves to exactly one document, the attorney's prose is present and
 *      unmangled, and the per-program terms really do differ where the
 *      business differs (12-month vs month-to-month vs one session).
 *   2. The CRM's agreement functions, lifted out of index.html and run for
 *      real, so the money on the page comes from the sale and the signed
 *      document is frozen rather than regenerated.
 *
 * The rule these tests exist to protect: a member must never be handed a
 * document whose terms do not match what they are actually buying. Where the
 * right document does not exist, the code must REFUSE rather than guess.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const CRM = path.join(__dirname, '..') + path.sep;
const html = fs.readFileSync(CRM + 'index.html', 'utf8');
const A = require(CRM + 'agreements.js');

let passed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); passed++; }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + (e && e.message)); process.exitCode = 1; }
}

/* ── lift the real functions out of index.html ─────────────────────────────*/
function isRegexStart(i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(html[j])) j--;
  if (j < 0) return true;
  if ('(,=:[!&|?;{'.includes(html[j])) return true;
  return /\breturn$/.test(html.slice(Math.max(0, j - 5), j + 1));
}
function scan(start, onChar) {
  let i = start, depth = 0, quote = null, lineC = false, blockC = false, re = false, cls = false;
  for (; i < html.length; i++) {
    const c = html[i], next = html[i + 1];
    if (lineC) { if (c === '\n') lineC = false; continue; }
    if (blockC) { if (c === '*' && next === '/') { blockC = false; i++; } continue; }
    if (re) {
      if (c === '\\') { i++; continue; }
      if (c === '[') cls = true; else if (c === ']') cls = false;
      else if (c === '/' && !cls) re = false;
      continue;
    }
    if (quote) { if (c === quote && html[i - 1] !== '\\') quote = null; continue; }
    if (c === '/' && next === '/') { lineC = true; continue; }
    if (c === '/' && next === '*') { blockC = true; continue; }
    if (c === '/' && isRegexStart(i)) { re = true; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    if (onChar(c, depth) === 'stop') return i;
  }
  throw new Error('scan ran off the end from ' + start);
}
function liftFn(name) {
  const m = new RegExp('\\n(?:async )?function ' + name + '\\s*\\(').exec(html);
  if (!m) throw new Error('could not lift function ' + name);
  const braceStart = html.indexOf('{', m.index);
  let started = false;
  const end = scan(braceStart, (c, depth) => {
    if (c === '{') started = true;
    if (started && c === '}' && depth === 0) return 'stop';
  });
  return html.slice(m.index + 1, end + 1);
}
function liftVar(name) {
  const m = new RegExp('\\n(?:const|let) ' + name + '\\s*=').exec(html);
  if (!m) throw new Error('could not lift var ' + name);
  const start = m.index + m[0].length;
  const end = scan(start, (c, depth) => { if (c === ';' && depth === 0) return 'stop'; });
  return html.slice(m.index + 1, end + 1);
}

const sandbox = {
  window: { BTKDAgreements: A }, BTKDAgreements: A,
  console, Math, JSON, Date, String, Number, Array, Object,
  posSale: { lines: [], date: '2026-08-15', staff: 'Race Bares' },
  MEMBERS: [], PLAN_ROWS: [],
  toast() {}, fmtDate: (ymd) => { const p = String(ymd).split('-'); return p.length === 3 ? p[1] + '-' + p[2] + '-' + p[0] : String(ymd); },
  planByCode: (code) => sandbox.PLAN_ROWS.find(p => p.code === code) || null,
  addWeeksYMD: (ymd, w) => { const d = new Date(ymd + 'T00:00:00'); d.setDate(d.getDate() + w * 7); return d.toISOString().slice(0, 10); },
  attYMD: () => '2026-08-15'
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  [liftVar('money'), liftVar('escHtml'), liftVar('escAttr'),
   liftFn('agrResolve'), liftFn('agrBuildDoc'), liftFn('agrDocText'),
   liftFn('agrDocHtml'), liftFn('agrUnsignedLines')].join('\n'),
  sandbox
);
const { agrResolve, agrBuildDoc, agrDocText, agrDocHtml, agrUnsignedLines } = sandbox;

/* ── 1. the templates as data ──────────────────────────────────────────────*/
console.log('\nagreements.js — the documents');

test('every sellable program maps to exactly one document', () => {
  const expect = {
    'Juniors': 'taekwondo', 'Teens/Adults': 'taekwondo', 'Cubs': 'cubs',
    'Kickboxing': 'kickboxing', 'Jiu Jitsu': 'jiujitsu',
    "AMP'D": 'ampd', 'Little Kickers': 'little_kickers'
  };
  Object.keys(expect).forEach(prog => {
    const t = A.forProgram(prog);
    assert.ok(t, prog + ' has no agreement template');
    assert.strictEqual(t.key, expect[prog], prog + ' resolved to ' + t.key);
  });
});

test("AMP'D matches whichever apostrophe the caller happens to have", () => {
  assert.strictEqual(A.forProgram("AMP'D").key, 'ampd');
  assert.strictEqual(A.forProgram('AMP’D').key, 'ampd');
  assert.strictEqual(A.forProgram("amp'd").key, 'ampd');
});

test('the bundle program has NO document and is not silently mapped to one', () => {
  // Kickboxing + Jiu Jitsu is sold as one membership but no combined
  // agreement was ever written. Guessing here would put a member on terms
  // nobody reviewed, so resolution must come back empty.
  assert.strictEqual(A.forProgram('Kickboxing + Jiu Jitsu'), null);
});

test('every document carries the full attorney-reviewed spine', () => {
  const need = ['MEMBERSHIP', 'WAIVER', 'NOTICE & AGREEMENT', 'CANCELLATION', 'FULL AGREEMENT'];
  A.TEMPLATES.forEach(t => {
    const got = t.sections.map(s => s.h);
    need.forEach(h => assert.ok(got.indexOf(h) !== -1, t.key + ' is missing ' + h));
    assert.ok(t.signNote && /^Sign only after/.test(t.signNote), t.key + ' has no signature note');
    assert.ok(t.feesTail.length, t.key + ' has no payment-authorization paragraph');
  });
});

test('the waiver is the SAME text in all six', () => {
  // One universal waiver was a deliberate decision: six AI-tailored variants
  // would each need their own legal review, and the Little Kickers variant in
  // particular described the activity as gentle while still waiving death.
  const waivers = A.TEMPLATES.map(t => t.sections.find(s => s.h === 'WAIVER').p.join(' '));
  waivers.forEach(w => assert.strictEqual(w, waivers[0], 'waiver text drifted between documents'));
  assert.ok(waivers[0].length > 3000, 'waiver looks truncated');
  assert.ok(/Smith County, Texas/.test(waivers[0]), 'venue clause missing from the waiver');
});

test('every document authorizes ACH, not just cards', () => {
  A.TEMPLATES.forEach(t => {
    const auth = t.feesTail.join(' ');
    assert.ok(/electronic debit \(ACH\)/.test(auth), t.key + ' lost its ACH authorization');
    assert.ok(/Grizzly Martial Arts & Fitness LLC/.test(auth), t.key + ' does not name the legal entity');
    assert.ok(!/charge my card/.test(auth), t.key + ' still says "charge my card"');
  });
});

test('term language actually differs where the business differs', () => {
  const tkd = A.byKey('taekwondo').sections.find(s => s.h === 'CANCELLATION').p.join(' ');
  const kb  = A.byKey('kickboxing').sections.find(s => s.h === 'CANCELLATION').p.join(' ');
  const lk  = A.byKey('little_kickers').sections.find(s => s.h === 'CANCELLATION').p.join(' ');
  assert.ok(/twelve \(12\) months/.test(tkd), 'Taekwondo lost its 12-month term');
  assert.ok(/month to month/.test(kb), 'Kickboxing is not month-to-month');
  assert.ok(!/twelve \(12\) month/.test(kb), 'Kickboxing picked up a 12-month term');
  assert.ok(/may not be cancelled/.test(lk), 'Little Kickers is cancellable');
  assert.ok(/non-refundable/.test(lk), 'Little Kickers lost its non-refundable term');
});

test('month-to-month members still owe 30 days written notice', () => {
  // The failure this guards against: scoping cancellation rules to the
  // 12-month programs once accidentally exempted month-to-month members
  // from giving any notice at all.
  ['kickboxing', 'jiujitsu', 'ampd'].forEach(k => {
    const c = A.byKey(k).sections.find(s => s.h === 'CANCELLATION').p.join(' ');
    assert.ok(/thirty \(30\) days' written notice/.test(c), k + ' lost the 30-day notice');
    assert.ok(/Cancellation Notice must be filled out/.test(c), k + ' lost the Cancellation Notice form');
  });
});

/* ── 2. the CRM filling one in ─────────────────────────────────────────────*/
console.log('\nindex.html — building and signing');

const TKD_ROWS = [
  { code: 'juniors_option_b', name: 'Juniors Taekwondo — Option B', program: 'Juniors', billing_frequency: 'monthly', down_cents: 35900, recurring_cents: 9500, display_order: 2, sellable: true },
  { code: 'juniors_option_d', name: 'Juniors Taekwondo — Option D', program: 'Juniors', billing_frequency: 'monthly', down_cents: 12900, recurring_cents: 12900, display_order: 4, sellable: true },
  { code: 'juniors_pif',      name: 'Juniors Taekwondo — Paid in Full', program: 'Juniors', billing_frequency: 'one_time', pif_cents: 140000, display_order: 1, sellable: true }
];
function tkdLine(over) {
  return Object.assign({
    kind: 'mem', studentId: 's1', program: 'Juniors', label: 'Juniors Taekwondo',
    calc: { planCode: 'juniors_option_d', planName: 'Juniors Taekwondo — Option D', program: 'Juniors',
            billingFrequency: 'monthly', finalDownCents: 12900, finalRecurringCents: 12900 }
  }, over || {});
}

test('a program with no document refuses instead of guessing', () => {
  const r = agrResolve({ kind: 'mem', program: 'Kickboxing + Jiu Jitsu', calc: { program: 'Kickboxing + Jiu Jitsu' } });
  assert.ok(!r.template, 'a template was produced for the bundle');
  assert.ok(/No approved agreement/.test(r.reason), 'reason did not explain the gap: ' + r.reason);
});

test('weekly is the same twelve-month agreement, billed weekly', () => {
  // Owner correction 2026-08-15: weekly is NOT a no-contract plan. It is the
  // same twelve-month term with no down payment, so it takes the same
  // document. The catalog's "Pay weekly, no contract" description is the
  // thing that is wrong.
  const r = agrResolve(tkdLine({ calc: { planCode: 'juniors_weekly', program: 'Juniors', billingFrequency: 'weekly', finalDownCents: 0, finalRecurringCents: 3395 } }));
  assert.ok(r.template, 'weekly was refused a document: ' + r.reason);
  assert.strictEqual(r.template.key, 'taekwondo');
  assert.strictEqual(r.template.term, 'twelve_month');
});

test('a weekly row on the fee table reads like the other options', () => {
  const rows = TKD_ROWS.concat([{ code: 'juniors_weekly', name: 'Juniors Taekwondo — Weekly', program: 'Juniors', billing_frequency: 'weekly', down_cents: 0, recurring_cents: 3395, display_order: 5, sellable: true }]);
  const doc = agrBuildDoc(A.byKey('taekwondo'), {
    program: 'Juniors', planCode: 'juniors_weekly', planName: 'Juniors Taekwondo — Weekly',
    downCents: 0, recurringCents: 3395, catalogRows: rows
  });
  const wk = doc.fees.rows.find(r => /Weekly/.test(r.label));
  assert.ok(wk.selected, 'the weekly option was not marked as chosen');
  assert.strictEqual(wk.terms, 'Down payment $0.00 and weekly payment $33.95');
  assert.ok(!/no contract/i.test(wk.terms), 'the agreement still calls weekly a no-contract plan');
});

test('a normal membership resolves to its document', () => {
  const r = agrResolve(tkdLine());
  assert.ok(r.template, r.reason);
  assert.strictEqual(r.template.key, 'taekwondo');
});

test('the fee table is priced from the catalog, with the bought option marked', () => {
  const doc = agrBuildDoc(A.byKey('taekwondo'), {
    program: 'Juniors', planCode: 'juniors_option_d', planName: 'Juniors Taekwondo — Option D',
    participant: 'Jane Doe', today: '08-15-2026', start: '08-15-2026',
    downCents: 12900, recurringCents: 12900, catalogRows: TKD_ROWS
  });
  assert.strictEqual(doc.fees.rows.length, 3, 'wrong number of options on the page');
  const chosen = doc.fees.rows.filter(r => r.selected);
  assert.strictEqual(chosen.length, 1, 'exactly one option must be marked');
  assert.strictEqual(chosen[0].label, 'Juniors Taekwondo — Option D');
  assert.ok(/\$129\.00/.test(chosen[0].terms), 'selected option shows the wrong money: ' + chosen[0].terms);
  const pif = doc.fees.rows.find(r => /Paid in Full/.test(r.label));
  // money() is the CRM's own formatter and does not group thousands — the
  // agreement matches every other surface rather than forking the format.
  assert.ok(/\$1400\.00/.test(pif.terms), 'PIF row is not priced from the catalog: ' + pif.terms);
  assert.ok(/twelve \(12\) month term/.test(pif.terms), 'PIF row lost its term wording');
});

test('a price change in the catalog shows up on the next agreement by itself', () => {
  const rows = JSON.parse(JSON.stringify(TKD_ROWS));
  rows[1].recurring_cents = 13900;   // Race raises Option D
  const doc = agrBuildDoc(A.byKey('taekwondo'), {
    program: 'Juniors', planCode: 'juniors_option_d', planName: 'D',
    downCents: 12900, recurringCents: 13900, catalogRows: rows
  });
  const row = doc.fees.rows.find(r => r.selected);
  assert.ok(/\$139\.00/.test(row.terms), 'agreement did not pick up the new price: ' + row.terms);
});

test('month-to-month documents show down, monthly and the agreed payment date', () => {
  const doc = agrBuildDoc(A.byKey('kickboxing'), {
    program: 'Kickboxing', planCode: 'specialty_kickboxing', planName: 'Kickboxing',
    downCents: 5000, recurringCents: 11900, agreedPaymentDate: 'the 1st of each month', catalogRows: []
  });
  // Joined rather than deep-compared: these arrays are built inside the vm
  // context, so they fail a prototype-strict comparison against host arrays.
  const labels = doc.fees.rows.map(r => r.label).join(' | ');
  assert.strictEqual(labels, 'Down payment | Monthly payment | Agreed payment date | Participant initials');
  assert.strictEqual(doc.fees.rows[1].terms, '$119.00');
  assert.strictEqual(doc.fees.rows[2].terms, 'the 1st of each month');
});

test('Little Kickers states one payment and never authorizes recurring charges', () => {
  const doc = agrBuildDoc(A.byKey('little_kickers'), {
    program: 'Little Kickers', planCode: 'little_kickers_session', planName: 'Little Kickers',
    recurringCents: 10900, sessionStart: '09-01-2026', sessionEnd: '10-13-2026', catalogRows: []
  });
  assert.ok(/\$109\.00/.test(doc.fees.note), 'session price missing: ' + doc.fees.note);
  assert.ok(/due in full at enrollment/.test(doc.fees.note));
  const auth = doc.feesTail.join(' ');
  assert.ok(/no recurring membership charges/.test(auth), 'Little Kickers authorized recurring billing');
  assert.ok(!/each billing period/.test(auth), 'Little Kickers carries recurring-billing wording');
  const fieldKeys = doc.fields.map(f => f.key);
  assert.ok(fieldKeys.indexOf('sessionStart') !== -1 && fieldKeys.indexOf('sessionEnd') !== -1, 'session dates missing');
});

test('the participant and the money both land in the flattened text', () => {
  const doc = agrBuildDoc(A.byKey('taekwondo'), {
    program: 'Juniors', planCode: 'juniors_option_d', planName: 'Juniors Taekwondo — Option D',
    participant: 'Jane Doe', dob: '04-02-2015', guardian: 'John Doe',
    today: '08-15-2026', start: '08-15-2026', initials: 'JD',
    agreedPaymentDate: 'the 1st', downCents: 12900, recurringCents: 12900, catalogRows: TKD_ROWS
  });
  const text = agrDocText(doc);
  assert.ok(/Jane Doe/.test(text), 'participant not in the document');
  assert.ok(/Participant \(Student\) Name: Jane Doe/.test(text), 'name field not filled');
  assert.ok(/\[X\] Juniors Taekwondo — Option D/.test(text), 'chosen option not marked in the text');
  assert.ok(/Selected option: Juniors Taekwondo — Option D/.test(text));
  assert.ok(/Smith County, Texas/.test(text), 'waiver body missing from the flattened text');
  assert.ok(text.length > 8000, 'flattened agreement looks truncated (' + text.length + ' chars)');
});

test('a signed agreement renders from its frozen copy, not the live template', () => {
  // The whole point of storing body_json: revising a template later must not
  // change what somebody already signed.
  const frozen = agrBuildDoc(A.byKey('kickboxing'), {
    program: 'Kickboxing', planName: 'Kickboxing', recurringCents: 9900, downCents: 0, catalogRows: []
  });
  frozen.sections[0].p[0] = 'ORIGINAL TERM AS SIGNED.';
  const out = agrDocHtml(frozen, { signer_name: 'John Doe', signer_relationship: 'Parent', signed_at: '2026-08-15T15:00:00Z', signature_png: 'data:image/png;base64,AAA' });
  assert.ok(/ORIGINAL TERM AS SIGNED\./.test(out), 'viewer re-rendered from the template instead of the stored copy');
  assert.ok(/John Doe/.test(out) && /Parent/.test(out), 'signer block missing');
  assert.ok(/<img class="agr-sig"/.test(out), 'signature image missing');
});

test('html output escapes what a person typed', () => {
  const doc = agrBuildDoc(A.byKey('kickboxing'), {
    program: 'Kickboxing', planName: 'KB', participant: '<script>alert(1)</script>',
    recurringCents: 5000, downCents: 0, catalogRows: []
  });
  const out = agrDocHtml(doc, null);
  assert.ok(!/<script>/.test(out), 'unescaped markup reached the document');
  assert.ok(/&lt;script&gt;/.test(out), 'name was dropped instead of escaped');
});

test('the tender gate counts exactly the memberships still unsigned', () => {
  sandbox.posSale.lines = [
    tkdLine(),                                          // 0 unsigned
    { kind: 'product', label: 'Uniform' },              // not a membership
    tkdLine({ __agreement: { signer_name: 'John Doe' } }), // signed
    tkdLine({ __agreementWaived: true })                // knowingly skipped
  ];
  const pending = agrUnsignedLines();
  assert.strictEqual(pending.length, 1, 'gate miscounted unsigned memberships');
  assert.strictEqual(pending[0].i, 0, 'gate pointed at the wrong line');
});

console.log('\n' + passed + ' passed' + (process.exitCode ? ' — SEE FAILURES ABOVE' : '') + '\n');
