/* ============================================================================
 * BaresTKD POS — membership sale tests
 * ----------------------------------------------------------------------------
 * Plain Node, no framework. Run from the BaresCRM repo root:
 *
 *     node tests/pos-membership.test.js
 *
 * Exercises the REAL POS functions, lifted straight out of index.html, against
 * a catalog shaped like pricing_plans AFTER sql/membership-programs.sql (core
 * TKD split by program; addon/bundle/family rows sellable=false). Renaming one
 * of the lifted functions fails loudly rather than silently skipping.
 * All money assertions are on exact CENTS.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const CRM = path.join(__dirname, '..') + path.sep;
const html = fs.readFileSync(CRM + 'index.html', 'utf8');
const P = require(CRM + 'pricing.js');

// ── lift the functions under test straight out of the page ──────────────────
function lift(name) {
  const re = new RegExp('\\nfunction ' + name + '\\s*\\([\\s\\S]*?\\n\\}', 'm');
  const m = html.match(re);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}
const NAMES = ['posProgramBuckets', 'posQuote', 'posMemDueCents', 'posMemLineDueCents',
               'posMemRecurringNote', 'posMemRosterPrograms', 'posTkdTrackFor'];

// ── catalog fixture: post-membership-programs.sql ───────────────────────────
const P_ = (code, name, program, category, freq, rec, down, pay, pif, fam, hh, sellable) =>
  ({ code, name, program, category, billing_frequency: freq, recurring_cents: rec,
     down_cents: down, payment_count: pay, pif_cents: pif, family_position: fam,
     supports_household_discount: hh, sellable: sellable !== false, active: true,
     effective_date: '2026-07-01' });

const PLAN_ROWS = [
  P_('juniors_pif','Juniors Taekwondo — Paid in Full','Juniors','core_tkd','one_time',null,0,null,140000,null,false),
  P_('juniors_option_c','Juniors Taekwondo — Option C','Juniors','core_tkd','monthly',11000,25900,12,null,null,false),
  P_('juniors_weekly','Juniors Taekwondo — Weekly','Juniors','core_tkd','weekly',3395,0,null,null,null,false),
  P_('juniors_family_second','Juniors Taekwondo — 2nd family member','Juniors','core_tkd','monthly',11900,0,null,null,2,false,false),
  P_('juniors_family_third_plus','Juniors Taekwondo — 3rd+ family member','Juniors','core_tkd','monthly',7900,0,null,null,3,false,false),
  P_('adults_option_c','Teens/Adults Taekwondo — Option C','Teens/Adults','core_tkd','monthly',11000,25900,12,null,null,false),
  P_('adults_weekly','Teens/Adults Taekwondo — Weekly','Teens/Adults','core_tkd','weekly',3395,0,null,null,null,false),
  P_('adults_family_second','Teens/Adults Taekwondo — 2nd family member','Teens/Adults','core_tkd','monthly',11900,0,null,null,2,false,false),
  P_('cubs_option_a','Cubs — Option A','Cubs','cubs','monthly',10500,9900,12,null,null,false),
  P_('specialty_kickboxing','Kickboxing — Standalone','Kickboxing','specialty','monthly',8900,0,null,null,null,true),
  P_('specialty_jiujitsu','Jiu Jitsu — Standalone','Jiu Jitsu','specialty','monthly',8900,0,null,null,null,true),
  P_('specialty_both','Kickboxing + Jiu Jitsu — Standalone','Kickboxing + Jiu Jitsu','specialty','monthly',11900,0,null,null,null,true),
  P_('specialty_dropin','Specialty — Drop-in','Kickboxing + Jiu Jitsu','specialty','one_time',null,0,null,2000,null,false),
  P_('addon_kickboxing','Kickboxing — TKD member add-on','Kickboxing','addon','monthly',4000,0,null,null,null,true,false),
  P_('addon_jiujitsu','Jiu Jitsu — TKD member add-on','Jiu Jitsu','addon','monthly',4000,0,null,null,null,true,false),
  P_('addon_both','Kickboxing + Jiu Jitsu — TKD member add-on','Kickboxing + Jiu Jitsu','addon','monthly',6000,0,null,null,null,true,false),
  P_('bundle_tkd_one_specialty','Weekly — Taekwondo + one specialty','Teens/Adults','weekly_bundle','weekly',4395,0,null,null,null,false,false),
  P_('bundle_tkd_both_specialties','Weekly — Taekwondo + both specialties','Teens/Adults','weekly_bundle','weekly',4795,0,null,null,null,false,false),
  P_('ampd_addon',"AMP'D — Add-on","AMP'D",'other','monthly',5000,0,null,null,null,false)
];

// ── sandbox with the page globals these functions actually touch ────────────
const sandbox = {
  BTKDPricing: P,
  PLAN_ROWS,
  PRICE_SETTINGS: { household_specialty_discount_cents: 1000, weekly_household_discount_cents: 0 },
  MB_PROGRAM_CARDS: [
    { key:'Cubs', title:'Cubs', ages:'Ages 3–4' },
    { key:'Juniors', title:'Juniors Taekwondo', ages:'Ages 5–12' },
    { key:'Teens/Adults', title:'Teens/Adults Taekwondo', ages:'Ages 13+' },
    { key:'Kickboxing', title:'Kickboxing', ages:'Ages 13+' },
    { key:'Jiu Jitsu', title:'Jiu Jitsu', ages:'Ages 13+' },
    { key:'Kickboxing + Jiu Jitsu', title:'Kickboxing + Jiu Jitsu', ages:'Ages 13+' },
    { key:"AMP'D", title:"AMP'D", ages:'Strength & conditioning' }
  ],
  planByCode: code => PLAN_ROWS.find(p => p.code === code) || null,
  money: n => '$' + Number(n).toFixed(2),
  MEMBERS: [{ id:'kidA', age:9 }, { id:'teenB', age:15 }],
  posSale: { memberId: 'kidA' },
  console
};
vm.createContext(sandbox);
vm.runInContext(NAMES.map(lift).join('\n'), sandbox);

const ctx = (own = [], others = []) => ({
  person: { contact_id: 'p', activeMemberships: own },
  householdMembers: others
});
const ms = (code, started) => {
  const pl = sandbox.planByCode(code);
  return { plan_code: code, category: pl.category, status: 'active',
           started_on: started, billing_frequency: pl.billing_frequency };
};

// Arrays built inside the vm carry the sandbox's Array prototype, so
// deepStrictEqual would fail on realm identity alone. Compare values.
const plain = x => JSON.parse(JSON.stringify(x));
const eq = (a, b, msg) => assert.deepStrictEqual(plain(a), b, msg);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

// ── the tests ───────────────────────────────────────────────────────────────

test('1 picker offers programs, never the engine rate rows', function () {
  const buckets = sandbox.posProgramBuckets();
  const titles = buckets.map(b => b.title);
  eq(titles, ['Cubs','Juniors Taekwondo','Teens/Adults Taekwondo',
    'Kickboxing','Jiu Jitsu','Kickboxing + Jiu Jitsu',"AMP'D"], 'pitch order preserved');
  const offered = buckets.flatMap(b => b.rows.map(r => r.code));
  ['addon_kickboxing','addon_jiujitsu','addon_both','bundle_tkd_one_specialty',
   'bundle_tkd_both_specialties','juniors_family_second','adults_family_second',
   'juniors_family_third_plus'].forEach(code =>
    assert.ok(!offered.includes(code), code + ' is an engine rate and must not be sellable'));
  assert.ok(offered.includes('specialty_kickboxing'));
  assert.ok(!buckets.some(b => b.key === '__other'), 'nothing orphaned in a full catalog');
});

test('2 pre-migration catalog (no program stamps) still sells via Other', function () {
  const saved = sandbox.PLAN_ROWS;
  sandbox.PLAN_ROWS = [
    P_('tkd_option_c','Taekwondo — Option C',null,'core_tkd','monthly',11000,25900,12,null,null,false),
    P_('cubs_option_a','Cubs — Option A','Cubs','cubs','monthly',10500,9900,12,null,null,false)
  ];
  const buckets = sandbox.posProgramBuckets();
  const other = buckets.find(b => b.key === '__other');
  assert.ok(other, 'unstamped plans must still be sellable');
  assert.strictEqual(other.rows[0].code, 'tkd_option_c');
  sandbox.PLAN_ROWS = saved;
});

test('3 due today = down + first payment; PIF = the full amount', function () {
  const monthly = sandbox.posQuote('juniors_option_c', ctx());
  assert.strictEqual(monthly.finalDownCents, 25900);
  assert.strictEqual(monthly.finalRecurringCents, 11000);
  assert.strictEqual(sandbox.posMemDueCents(monthly, null), 36900);

  const pif = sandbox.posQuote('juniors_pif', ctx());
  assert.strictEqual(sandbox.posMemDueCents(pif, null), 140000, 'no down added on top of PIF');

  const weekly = sandbox.posQuote('juniors_weekly', ctx());
  assert.strictEqual(sandbox.posMemDueCents(weekly, null), 3395);
});

test('4 selling a program quotes the household-correct rate', function () {
  // 2nd TKD member in the household
  const second = sandbox.posQuote('adults_option_c',
    ctx([], [{ contact_id:'kid', activeMemberships:[ms('juniors_option_c','2026-01-05')] }]));
  assert.strictEqual(second.planCode, 'adults_family_second');
  assert.strictEqual(sandbox.posMemDueCents(second, null), 11900, 'no down on the family rate');

  // monthly TKD member buying Kickboxing gets the member rate
  const member = sandbox.posQuote('specialty_kickboxing',
    ctx([ms('juniors_option_c','2026-01-05')]));
  assert.strictEqual(member.planCode, 'addon_kickboxing');
  assert.strictEqual(sandbox.posMemDueCents(member, null), 4000);

  // weekly TKD member buying Kickboxing gets the bundle
  const bundled = sandbox.posQuote('specialty_kickboxing',
    ctx([ms('juniors_weekly','2026-01-05')]));
  assert.strictEqual(bundled.planCode, 'bundle_tkd_one_specialty');
  assert.strictEqual(sandbox.posMemDueCents(bundled, null), 4395);
});

test('5 ineligible plans are reported, not silently mispriced', function () {
  // AMP'D is 'other' and always stands on its own
  const ampd = sandbox.posQuote('ampd_addon', ctx());
  assert.strictEqual(ampd.eligible, true);
  assert.strictEqual(sandbox.posMemDueCents(ampd, null), 5000);
});

test('6 recurring note reads correctly per billing shape', function () {
  const monthly = sandbox.posQuote('juniors_option_c', ctx());
  assert.strictEqual(sandbox.posMemRecurringNote(monthly, null), 'then 11 × $110.00/mo');
  const weekly = sandbox.posQuote('juniors_weekly', ctx());
  assert.strictEqual(sandbox.posMemRecurringNote(weekly, null), 'then $33.95/wk ongoing');
  const pif = sandbox.posQuote('juniors_pif', ctx());
  assert.strictEqual(sandbox.posMemRecurringNote(pif, null), 'paid in full');
});

test('7 an override replaces the numbers, not the billing shape', function () {
  const calc = sandbox.posQuote('juniors_option_c', ctx());
  const line = { calc, override: { active:true, recurringCents:9900, downCents:10000,
                                   reason:'sibling promo', by:'staff@x', at:'2026-08-02T12:00:00Z' } };
  assert.strictEqual(sandbox.posMemLineDueCents(line), 19900, 'override down + override first payment');
  assert.strictEqual(sandbox.posMemRecurringNote(calc, line.override), 'then 11 × $99.00/mo');
  // engine recommendation is preserved for the audit trail
  const snap = P.buildMembershipSnapshot({ calc, contactId:'kidA', program:'Juniors',
    startedOn:'2026-08-02', createdBy:'staff@x', override: line.override });
  assert.strictEqual(snap.final_recurring_cents, 9900);
  assert.strictEqual(snap.recommended_cents, 11000, 'recommendation kept for comparison');
  assert.strictEqual(snap.override_reason, 'sibling promo');
  assert.strictEqual(snap.override_by, 'staff@x');
  assert.ok(Number.isInteger(snap.final_recurring_cents), 'money stays integer cents');
});

test('8 roster programs follow the sold program', function () {
  const mk = code => ({ calc: sandbox.posQuote(code, ctx()) });
  eq(sandbox.posMemRosterPrograms(mk('juniors_option_c')), ['Juniors']);
  eq(sandbox.posMemRosterPrograms(mk('adults_option_c')), ['Teens/Adults']);
  eq(sandbox.posMemRosterPrograms(mk('cubs_option_a')), ['Cubs']);
  eq(sandbox.posMemRosterPrograms(mk('specialty_kickboxing')), ['Kickboxing']);
  eq(sandbox.posMemRosterPrograms(mk('specialty_both')), ['Kickboxing','Jiu Jitsu']);

  // a weekly TKD member buying a specialty lands on the bundle -> TKD track only
  const bundleLine = { calc: sandbox.posQuote('specialty_kickboxing', ctx([ms('juniors_weekly','2026-01-05')])) };
  assert.strictEqual(bundleLine.calc.planCode, 'bundle_tkd_one_specialty');
  eq(sandbox.posMemRosterPrograms(bundleLine), ['Juniors'],
    'kidA is 9, so the TKD track is Juniors');
});

test('9 TKD track follows the buyer\'s age', function () {
  assert.strictEqual(sandbox.posTkdTrackFor('kidA'), 'Juniors');
  assert.strictEqual(sandbox.posTkdTrackFor('teenB'), 'Teens/Adults');
  assert.strictEqual(sandbox.posTkdTrackFor('nobody'), 'Juniors', 'safe default');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
