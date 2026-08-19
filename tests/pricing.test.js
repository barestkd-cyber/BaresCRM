/* ============================================================================
 * BaresTKD pricing engine — tests
 * ----------------------------------------------------------------------------
 * Plain Node, no framework. Run from the BaresCRM repo root:
 *
 *     node tests/pricing.test.js
 *
 * Exits non-zero on the first failure. All assertions are on exact CENTS.
 * ========================================================================== */
'use strict';

var assert = require('assert');
var P = require('../pricing.js');

// ─── fixtures: mirror sql/membership-schema.sql seed exactly ────────────────

var EFF = '2026-07-01';
function plan(o) { o.effective_date = o.effective_date || EFF; return o; }

var PLANS = [
  // core TKD (program null — covers Juniors and Teens/Adults alike)
  plan({ code:'juniors_pif',               name:'Taekwondo — Paid in Full',       program:'Juniors', category:'core_tkd', billing_frequency:'one_time', recurring_cents:null,  down_cents:0,     payment_count:null, pif_cents:140000, family_position:null, supports_household_discount:false }),
  plan({ code:'juniors_option_b',          name:'Taekwondo — Option B',           program:'Juniors', category:'core_tkd', billing_frequency:'monthly',  recurring_cents:9500,  down_cents:35900, payment_count:12,   pif_cents:null,   family_position:null, supports_household_discount:false }),
  plan({ code:'juniors_option_c',          name:'Taekwondo — Option C',           program:'Juniors', category:'core_tkd', billing_frequency:'monthly',  recurring_cents:11000, down_cents:25900, payment_count:12,   pif_cents:null,   family_position:null, supports_household_discount:false }),
  plan({ code:'juniors_option_d',          name:'Taekwondo — Option D',           program:'Juniors', category:'core_tkd', billing_frequency:'monthly',  recurring_cents:12900, down_cents:12900, payment_count:12,   pif_cents:null,   family_position:null, supports_household_discount:false }),
  plan({ code:'juniors_weekly',            name:'Taekwondo — Weekly',             program:'Juniors', category:'core_tkd', billing_frequency:'weekly',   recurring_cents:3395,  down_cents:0,     payment_count:null, pif_cents:null,   family_position:null, supports_household_discount:false }),
  plan({ code:'juniors_family_second',     name:'Taekwondo — 2nd family member',  program:'Juniors', category:'core_tkd', billing_frequency:'monthly',  recurring_cents:11900, down_cents:0,     payment_count:null, pif_cents:null,   family_position:2,    supports_household_discount:false }),
  plan({ code:'juniors_family_third_plus', name:'Taekwondo — 3rd+ family member', program:'Juniors', category:'core_tkd', billing_frequency:'monthly',  recurring_cents:7900,  down_cents:0,     payment_count:null, pif_cents:null,   family_position:3,    supports_household_discount:false }),

  // Teens/Adults — separate program, same prices at seed time
  plan({ code:'adults_option_c',          name:'Teens/Adults Taekwondo — Option C',           program:'Teens/Adults', category:'core_tkd', billing_frequency:'monthly', recurring_cents:11000, down_cents:25900, payment_count:12,   pif_cents:null, family_position:null, supports_household_discount:false }),
  plan({ code:'adults_weekly',            name:'Teens/Adults Taekwondo — Weekly',             program:'Teens/Adults', category:'core_tkd', billing_frequency:'weekly',  recurring_cents:3395,  down_cents:0,     payment_count:null, pif_cents:null, family_position:null, supports_household_discount:false }),
  plan({ code:'adults_family_second',     name:'Teens/Adults Taekwondo — 2nd family member',  program:'Teens/Adults', category:'core_tkd', billing_frequency:'monthly', recurring_cents:11900, down_cents:0,     payment_count:null, pif_cents:null, family_position:2,    supports_household_discount:false }),
  plan({ code:'adults_family_third_plus', name:'Teens/Adults Taekwondo — 3rd+ family member', program:'Teens/Adults', category:'core_tkd', billing_frequency:'monthly', recurring_cents:7900,  down_cents:0,     payment_count:null, pif_cents:null, family_position:3,    supports_household_discount:false }),

  // Cubs
  plan({ code:'cubs_weekly',   name:'Cubs — Weekly',       program:'Cubs', category:'cubs', billing_frequency:'weekly',   recurring_cents:2795,  down_cents:0,     payment_count:null, pif_cents:null,   family_position:null, supports_household_discount:false }),
  plan({ code:'cubs_option_a', name:'Cubs — Option A',     program:'Cubs', category:'cubs', billing_frequency:'monthly',  recurring_cents:10500, down_cents:9900,  payment_count:12,   pif_cents:null,   family_position:null, supports_household_discount:false, promo_label:'~6% off' }),
  plan({ code:'cubs_option_b', name:'Cubs — Option B',     program:'Cubs', category:'cubs', billing_frequency:'monthly',  recurring_cents:9000,  down_cents:19900, payment_count:12,   pif_cents:null,   family_position:null, supports_household_discount:false, promo_label:'~12% off' }),
  plan({ code:'cubs_pif',      name:'Cubs — Paid in Full', program:'Cubs', category:'cubs', billing_frequency:'one_time', recurring_cents:null,  down_cents:0,     payment_count:null, pif_cents:119200, family_position:null, supports_household_discount:false, promo_label:'~18% off' }),

  // specialty standalone (household-discount eligible) + drop-in (never)
  plan({ code:'specialty_kickboxing', name:'Kickboxing — Standalone',             program:'Kickboxing',             category:'specialty', billing_frequency:'monthly',  recurring_cents:8900,  down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:true }),
  plan({ code:'specialty_jiujitsu',   name:'Jiu Jitsu — Standalone',              program:'Jiu Jitsu',              category:'specialty', billing_frequency:'monthly',  recurring_cents:8900,  down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:true }),
  plan({ code:'specialty_both',       name:'Kickboxing + Jiu Jitsu — Standalone', program:'Kickboxing + Jiu Jitsu', category:'specialty', billing_frequency:'monthly',  recurring_cents:11900, down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:true }),
  plan({ code:'specialty_dropin',     name:'Specialty — Drop-in',                 program:null,                     category:'specialty', billing_frequency:'one_time', recurring_cents:null,  down_cents:0, payment_count:null, pif_cents:2000, family_position:null, supports_household_discount:false }),

  // TKD member add-ons (household-discount eligible)
  plan({ code:'addon_kickboxing', name:'Kickboxing — TKD member add-on',             program:'Kickboxing',             category:'addon', billing_frequency:'monthly', recurring_cents:4000, down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:true }),
  plan({ code:'addon_jiujitsu',   name:'Jiu Jitsu — TKD member add-on',              program:'Jiu Jitsu',              category:'addon', billing_frequency:'monthly', recurring_cents:4000, down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:true }),
  plan({ code:'addon_both',       name:'Kickboxing + Jiu Jitsu — TKD member add-on', program:'Kickboxing + Jiu Jitsu', category:'addon', billing_frequency:'monthly', recurring_cents:6000, down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:true }),

  // weekly bundles (complete price, replaces weekly TKD)
  plan({ code:'bundle_tkd_one_specialty',    name:'Weekly — Taekwondo + one specialty',   program:null, category:'weekly_bundle', billing_frequency:'weekly', recurring_cents:4395, down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:false }),
  plan({ code:'bundle_tkd_both_specialties', name:'Weekly — Taekwondo + both specialties',program:null, category:'weekly_bundle', billing_frequency:'weekly', recurring_cents:4795, down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:false }),

  // other
  plan({ code:'ampd_addon', name:"AMP'D — Add-on", program:"AMP'D", category:'other', billing_frequency:'monthly', recurring_cents:5000, down_cents:0, payment_count:null, pif_cents:null, family_position:null, supports_household_discount:false })
];

var SETTINGS = {
  household_specialty_discount_cents: 1000,
  weekly_household_discount_cents: 0
};

function P_(code) {
  for (var i = 0; i < PLANS.length; i++) if (PLANS[i].code === code) return PLANS[i];
  throw new Error('fixture plan missing: ' + code);
}

// membership fixture
function ms(plan_code, started_on, status) {
  var pl = P_(plan_code);
  return {
    plan_code: plan_code,
    category: pl.category,
    status: status || 'active',
    started_on: started_on,
    billing_frequency: pl.billing_frequency
  };
}

function quote(code, person, household) {
  return P.calculatePrice({
    plan: P_(code),
    settings: SETTINGS,
    person: person || { contact_id: 'p', activeMemberships: [] },
    householdMembers: household || [],
    plans: PLANS
  });
}

// ─── runner ────────────────────────────────────────────────────────────────

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

console.log('\nBaresTKD pricing engine\n');

// 1 — first household member, TKD Option C
test('1 first household member, TKD Option C: down 25900, monthly 11000', function () {
  var r = quote('juniors_option_c', { contact_id: 'a', activeMemberships: [] }, []);
  assert.strictEqual(r.finalDownCents, 25900);
  assert.strictEqual(r.finalRecurringCents, 11000);
  assert.strictEqual(r.planCode, 'juniors_option_c');
  assert.strictEqual(r.adjustments.length, 0);
});

// 2 — second active core TKD member
test('2 second core TKD member: down 0, monthly 11900', function () {
  var r = quote('juniors_option_c',
    { contact_id: 'b', activeMemberships: [] },
    [{ contact_id: 'a', activeMemberships: [ms('juniors_option_c', '2026-01-05')] }]);
  assert.strictEqual(r.finalDownCents, 0);
  assert.strictEqual(r.finalRecurringCents, 11900);
  assert.strictEqual(r.planCode, 'juniors_family_second');
});

// 3 — third
test('3 third core TKD member: down 0, monthly 7900', function () {
  var r = quote('juniors_option_c',
    { contact_id: 'c', activeMemberships: [] },
    [
      { contact_id: 'a', activeMemberships: [ms('juniors_option_c', '2026-01-05')] },
      { contact_id: 'b', activeMemberships: [ms('juniors_family_second', '2026-02-05')] }
    ]);
  assert.strictEqual(r.finalDownCents, 0);
  assert.strictEqual(r.finalRecurringCents, 7900);
  assert.strictEqual(r.planCode, 'juniors_family_third_plus');
});

// 4 — child holds TKD (founding), parent standalone Kickboxing
test('4 parent standalone Kickboxing behind a TKD child: 8900 - 1000 = 7900', function () {
  var r = quote('specialty_kickboxing',
    { contact_id: 'parent', activeMemberships: [] },
    [{ contact_id: 'kid', activeMemberships: [ms('juniors_option_c', '2026-01-05')] }]);
  assert.strictEqual(r.baseCents, 8900);
  assert.strictEqual(r.finalRecurringCents, 7900);
  assert.strictEqual(r.adjustments.length, 1);
  assert.strictEqual(r.adjustments[0].amountCents, -1000);
});

// 5 — same, both specialties
test('5 parent standalone both specialties: 11900 - 1000 = 10900', function () {
  var r = quote('specialty_both',
    { contact_id: 'parent', activeMemberships: [] },
    [{ contact_id: 'kid', activeMemberships: [ms('juniors_option_c', '2026-01-05')] }]);
  assert.strictEqual(r.finalRecurringCents, 10900);
});

// 6 — monthly TKD holder, sole ranked member, adds one specialty
test('6 sole monthly TKD member adds one specialty: 4000, no discount', function () {
  var r = quote('addon_kickboxing',
    { contact_id: 'a', activeMemberships: [ms('juniors_option_c', '2026-01-05')] },
    []);
  assert.strictEqual(r.planCode, 'addon_kickboxing');
  assert.strictEqual(r.finalRecurringCents, 4000);
  assert.strictEqual(r.adjustments.length, 0);
});

// 7 — monthly TKD holder ranked 2nd, adds one specialty
test('7 second-ranked monthly TKD member adds one specialty: 4000 - 1000 = 3000', function () {
  var r = quote('addon_kickboxing',
    { contact_id: 'b', activeMemberships: [ms('juniors_option_c', '2026-03-01')] },
    [{ contact_id: 'a', activeMemberships: [ms('juniors_option_c', '2026-01-05')] }]);
  assert.strictEqual(r.finalRecurringCents, 3000);
  assert.strictEqual(r.adjustments[0].amountCents, -1000);
});

// 8 — same person adds both
test('8 second-ranked monthly TKD member adds both: 6000 - 1000 = 5000', function () {
  var r = quote('addon_both',
    { contact_id: 'b', activeMemberships: [ms('juniors_option_c', '2026-03-01')] },
    [{ contact_id: 'a', activeMemberships: [ms('juniors_option_c', '2026-01-05')] }]);
  assert.strictEqual(r.finalRecurringCents, 5000);
});

// 9 — weekly TKD person adds one specialty -> bundle
test('9 weekly TKD member adds one specialty: bundle 4395', function () {
  var r = quote('addon_kickboxing',
    { contact_id: 'a', activeMemberships: [ms('juniors_weekly', '2026-01-05')] },
    []);
  assert.strictEqual(r.planCode, 'bundle_tkd_one_specialty');
  assert.strictEqual(r.finalRecurringCents, 4395);
  assert.strictEqual(r.billingFrequency, 'weekly');
});

// 10 — weekly TKD person adds both -> bundle
test('10 weekly TKD member adds both: bundle 4795', function () {
  var r = quote('addon_both',
    { contact_id: 'a', activeMemberships: [ms('juniors_weekly', '2026-01-05')] },
    []);
  assert.strictEqual(r.planCode, 'bundle_tkd_both_specialties');
  assert.strictEqual(r.finalRecurringCents, 4795);
});

// 11 — no TKD, no other active household member, standalone Jiu Jitsu
test('11 lone standalone Jiu Jitsu: 8900', function () {
  var r = quote('specialty_jiujitsu', { contact_id: 'a', activeMemberships: [] }, []);
  assert.strictEqual(r.finalRecurringCents, 8900);
  assert.strictEqual(r.adjustments.length, 0);
});

// 12 — drop-in
test('12 drop-in: 2000, zero adjustments', function () {
  var r = quote('specialty_dropin',
    { contact_id: 'b', activeMemberships: [] },
    [{ contact_id: 'a', activeMemberships: [ms('specialty_jiujitsu', '2026-01-05')] }]);
  assert.strictEqual(r.baseCents, 2000);
  assert.strictEqual(r.finalRecurringCents, 2000);
  assert.strictEqual(r.adjustments.length, 0);
  assert.strictEqual(r.billingFrequency, 'one_time');
});

// 13 — a canceled household membership creates no eligibility and no rank
test('13 canceled household membership grants no rank and no eligibility', function () {
  var household = [{ contact_id: 'a', activeMemberships: [ms('juniors_option_c', '2026-01-05', 'canceled')] }];

  // no rank -> the person is founding, so no household discount
  var r = quote('specialty_jiujitsu', { contact_id: 'b', activeMemberships: [] }, household);
  assert.strictEqual(r.householdRank, 1);
  assert.strictEqual(r.finalRecurringCents, 8900);
  assert.strictEqual(r.adjustments.length, 0);

  // no family position either -> a regular individual option stands
  var r2 = quote('juniors_option_c', { contact_id: 'b', activeMemberships: [] }, household);
  assert.strictEqual(r2.planCode, 'juniors_option_c');
  assert.strictEqual(r2.finalRecurringCents, 11000);

  // the person's OWN canceled TKD does not make them add-on eligible
  var r3 = quote('addon_kickboxing',
    { contact_id: 'b', activeMemberships: [ms('juniors_option_c', '2026-01-05', 'canceled')] }, []);
  assert.strictEqual(r3.planCode, 'specialty_kickboxing'); // substituted to standalone
  assert.strictEqual(r3.finalRecurringCents, 8900);

  // trial / complimentary / paused / ended likewise never qualify
  ['trial', 'complimentary', 'paused', 'ended'].forEach(function (st) {
    var rx = quote('specialty_jiujitsu', { contact_id: 'b', activeMemberships: [] },
      [{ contact_id: 'a', activeMemberships: [ms('juniors_option_c', '2026-01-05', st)] }]);
    assert.strictEqual(rx.adjustments.length, 0, st + ' must not grant a discount');
  });
});

// 14 — a later plan price change must not alter a stored snapshot
test('14 stored snapshot is frozen at creation, never re-derived', function () {
  var jj = P_('specialty_jiujitsu');
  var person = { contact_id: 'a', activeMemberships: [] };
  var calc = quote('specialty_jiujitsu', person, []);
  var snap = P.buildMembershipSnapshot({
    calc: calc, contactId: 'a', startedOn: '2026-07-01', createdBy: 'staff@barestkd.fit'
  });
  assert.strictEqual(snap.final_recurring_cents, 8900);
  assert.strictEqual(snap.base_cents, 8900);
  var frozenVersion = snap.pricing_version;

  // the catalog price changes afterwards
  var original = jj.recurring_cents;
  jj.recurring_cents = 9900;
  var recalc = quote('specialty_jiujitsu', person, []);
  assert.strictEqual(recalc.finalRecurringCents, 9900, 'a fresh quote sees the new price');

  // the stored snapshot is untouched
  assert.strictEqual(snap.final_recurring_cents, 8900, 'snapshot must not move');
  assert.strictEqual(snap.base_cents, 8900);
  assert.strictEqual(snap.pricing_version, frozenVersion);
  jj.recurring_cents = original; // restore for later tests
});

// 15 — override path stores user, timestamp, reason
test('15 override snapshot stores price, reason, user, timestamp', function () {
  var calc = quote('specialty_jiujitsu', { contact_id: 'a', activeMemberships: [] }, []);
  var when = '2026-07-02T15:04:05.000Z';
  var snap = P.buildMembershipSnapshot({
    calc: calc, contactId: 'a', startedOn: '2026-07-02', createdBy: 'staff@barestkd.fit',
    override: { active: true, recurringCents: 6500, reason: 'Longtime family, hardship', by: 'mr.bares@barestkd.fit', at: when }
  });
  assert.strictEqual(snap.final_recurring_cents, 6500);
  assert.strictEqual(snap.recommended_cents, 8900, 'recommendation is retained for comparison');
  assert.strictEqual(snap.override_reason, 'Longtime family, hardship');
  assert.strictEqual(snap.override_by, 'mr.bares@barestkd.fit');
  assert.strictEqual(snap.override_at, when);
});

// 16 — Cubs never get TKD family positions or the specialty discount
test('16 Cubs plans get no family position and no household discount', function () {
  var household = [
    { contact_id: 'a', activeMemberships: [ms('juniors_option_c', '2026-01-05')] },
    { contact_id: 'b', activeMemberships: [ms('juniors_option_c', '2026-02-05')] }
  ];
  var r = quote('cubs_option_a', { contact_id: 'c', activeMemberships: [] }, household);
  assert.strictEqual(r.planCode, 'cubs_option_a', 'no family substitution for Cubs');
  assert.strictEqual(r.finalRecurringCents, 10500);
  assert.strictEqual(r.finalDownCents, 9900);
  assert.strictEqual(r.adjustments.length, 0, 'no household discount on Cubs');

  var w = quote('cubs_weekly', { contact_id: 'c', activeMemberships: [] }, household);
  assert.strictEqual(w.finalRecurringCents, 2795);
  assert.strictEqual(w.adjustments.length, 0);
});

// 17 — four household members all standalone Jiu Jitsu, in sequence
test('17 four standalone Jiu Jitsu in sequence: 8900, 7900, 7900, 7900', function () {
  var starts = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'];
  var ids = ['m1', 'm2', 'm3', 'm4'];
  var expected = [8900, 7900, 7900, 7900];

  ids.forEach(function (id, i) {
    // everyone enrolled before this person is already active
    var household = ids.slice(0, i).map(function (oid, j) {
      return { contact_id: oid, activeMemberships: [ms('specialty_jiujitsu', starts[j])] };
    });
    var r = quote('specialty_jiujitsu', { contact_id: id, activeMemberships: [] }, household);
    assert.strictEqual(r.finalRecurringCents, expected[i], id + ' expected ' + expected[i]);
  });

  // and once all four hold it, re-quoting each still respects founding rank
  var all = ids.map(function (id, j) {
    return { contact_id: id, activeMemberships: [ms('specialty_jiujitsu', starts[j])] };
  });
  ids.forEach(function (id, i) {
    var others = all.filter(function (h) { return h.contact_id !== id; });
    var r = P.calculatePrice({
      plan: P_('specialty_jiujitsu'), settings: SETTINGS, plans: PLANS,
      person: { contact_id: id, activeMemberships: [ms('specialty_jiujitsu', starts[i])] },
      householdMembers: others
    });
    assert.strictEqual(r.householdRank, i + 1, id + ' rank');
    assert.strictEqual(r.finalRecurringCents, expected[i], id + ' re-quote');
  });
});

// 18 — two TKD members each add one specialty: 4000 and 3000
test('18 two TKD members each add one specialty: 4000 + 3000 = 7000', function () {
  var aStart = '2026-01-05', bStart = '2026-02-05';
  var A = { contact_id: 'a', activeMemberships: [ms('juniors_option_c', aStart)] };
  var B = { contact_id: 'b', activeMemberships: [ms('juniors_family_second', bStart)] };

  var rA = quote('addon_kickboxing', A, [B]);
  var rB = quote('addon_kickboxing', B, [A]);

  assert.strictEqual(rA.finalRecurringCents, 4000, 'founding member pays full add-on');
  assert.strictEqual(rB.finalRecurringCents, 3000, 'second member gets the household discount');
  assert.strictEqual(rA.finalRecurringCents + rB.finalRecurringCents, 7000);
});

test('19 family position crosses programs but resolves the sold program\'s rate', function () {
  // Kid holds Juniors TKD (founding). Parent buys Teens/Adults Option C:
  // the household makes them 2nd TKD member, and the rate row picked must be
  // the ADULTS family row, not the juniors one.
  var r = quote('adults_option_c',
    { contact_id: 'parent', activeMemberships: [] },
    [{ contact_id: 'kid', activeMemberships: [ms('juniors_option_c', '2026-01-05')] }]);
  assert.strictEqual(r.planCode, 'adults_family_second');
  assert.strictEqual(r.finalRecurringCents, 11900);
  assert.strictEqual(r.finalDownCents, 0);

  // And a weekly Teens/Adults member adding a specialty still hits the bundle.
  var w = quote('specialty_kickboxing',
    { contact_id: 'w', activeMemberships: [ms('adults_weekly', '2026-01-05')] },
    []);
  assert.strictEqual(w.planCode, 'bundle_tkd_one_specialty');
  assert.strictEqual(w.finalRecurringCents, 4395);
});

/* 20-22 — "sell the program, the engine picks the rate".
 * sql/membership-programs.sql marks addon rows sellable=false, so the POS can
 * only pitch the STANDALONE row for a specialty. Selling that one program must
 * therefore resolve to all three rates on its own. */
test('20 selling Kickboxing to a monthly TKD member resolves the member rate: 4000', function () {
  var r = quote('specialty_kickboxing',
    { contact_id: 'p', activeMemberships: [ms('juniors_option_c', '2026-01-05')] },
    []);
  assert.strictEqual(r.planCode, 'addon_kickboxing');
  assert.strictEqual(r.baseCents, 4000);
  assert.strictEqual(r.finalRecurringCents, 4000, 'sole ranked member, no household discount');
  assert.strictEqual(r.substituted, true);
});

test('21 the same three rates all come from selling one program', function () {
  var kid = { contact_id: 'kid', activeMemberships: [ms('juniors_option_c', '2026-01-05')] };
  // no TKD of their own -> standalone
  var none = quote('specialty_kickboxing', { contact_id: 'a', activeMemberships: [] }, []);
  // monthly TKD -> member add-on rate
  var monthly = quote('specialty_kickboxing',
    { contact_id: 'b', activeMemberships: [ms('adults_option_c', '2026-02-01')] }, []);
  // weekly TKD -> weekly bundle replaces the weekly TKD price
  var weekly = quote('specialty_kickboxing',
    { contact_id: 'c', activeMemberships: [ms('juniors_weekly', '2026-02-01')] }, []);

  assert.strictEqual(none.planCode, 'specialty_kickboxing');
  assert.strictEqual(none.finalRecurringCents, 8900);
  assert.strictEqual(monthly.planCode, 'addon_kickboxing');
  assert.strictEqual(monthly.finalRecurringCents, 4000);
  assert.strictEqual(weekly.planCode, 'bundle_tkd_one_specialty');
  assert.strictEqual(weekly.finalRecurringCents, 4395);

  // a parent standing behind a TKD child still pays standalone — the rule is
  // the person's OWN membership, not the household's.
  var parent = quote('specialty_kickboxing', { contact_id: 'p', activeMemberships: [] }, [kid]);
  assert.strictEqual(parent.planCode, 'specialty_kickboxing');
  assert.strictEqual(parent.finalRecurringCents, 7900, '8900 less the household discount');
});

test('22 member rate still takes the household discount when ranked 2nd', function () {
  var r = quote('specialty_both',
    { contact_id: 'p', activeMemberships: [ms('juniors_option_c', '2026-06-01')] },
    [{ contact_id: 'sib', activeMemberships: [ms('adults_option_c', '2026-01-05')] }]);
  assert.strictEqual(r.planCode, 'addon_both');
  assert.strictEqual(r.baseCents, 6000);
  assert.strictEqual(r.finalRecurringCents, 5000, '6000 less the 1000 household discount');
});

test('23 a drop-in never picks up a member rate', function () {
  var r = quote('specialty_dropin',
    { contact_id: 'p', activeMemberships: [ms('juniors_option_c', '2026-01-05')] },
    []);
  assert.strictEqual(r.planCode, 'specialty_dropin');
  assert.strictEqual(r.finalRecurringCents, 2000);
  assert.strictEqual(r.substituted, false);
});

// ─── invoice math: dueTodayCents ───────────────────────────────────────────

test('20 due today, monthly plan: down + first month', function () {
  var r = quote('juniors_option_c', { contact_id: 'a', activeMemberships: [] }, []);
  assert.strictEqual(P.dueTodayCents(r, null), 25900 + 11000);
});

test('21 due today, one_time plan includes any down payment (snapshot agreement)', function () {
  var r = quote('juniors_pif', { contact_id: 'a', activeMemberships: [] }, []);
  // seeded PIF has down 0 — due equals the full amount…
  assert.strictEqual(P.dueTodayCents(r, null), r.finalRecurringCents);
  // …but a hypothetical one_time calc carrying a down must not drop it.
  assert.strictEqual(
    P.dueTodayCents({ billingFrequency: 'one_time', finalRecurringCents: 100000, finalDownCents: 5000 }, null),
    105000);
});

test('22 due today respects an override, including explicit zero down', function () {
  var r = quote('juniors_option_c', { contact_id: 'a', activeMemberships: [] }, []);
  assert.strictEqual(P.dueTodayCents(r, { recurringCents: 9900, downCents: 0 }), 9900);
  assert.strictEqual(P.dueTodayCents(r, { recurringCents: 9900, downCents: null }), 9900 + 25900);
});

// ─── invoice math: invoiceTotals ───────────────────────────────────────────

test('23 tax applies to the DISCOUNTED base, not the sticker price', function () {
  // $100.00 taxable gear, $20.00 invoice discount, 8.25%.
  var t = P.invoiceTotals({ lines: [{ cents: 10000, taxable: true }], discountCents: 2000, taxRate: 0.0825 });
  assert.strictEqual(t.taxBaseCents, 8000);
  assert.strictEqual(t.taxCents, 660);           // 8.25% of $80.00 — not 825
  assert.strictEqual(t.totalCents, 8660);
});

test('24 discount allocates pro-rata; only the taxable share reduces the base', function () {
  // $100 taxable + $50 non-taxable membership money, $30 discount.
  var t = P.invoiceTotals({
    lines: [{ cents: 10000, taxable: true }, { cents: 5000, taxable: false }],
    discountCents: 3000, taxRate: 0.0825
  });
  assert.deepStrictEqual(t.discountAllocationCents, [2000, 1000]);
  assert.strictEqual(t.taxBaseCents, 8000);
  assert.strictEqual(t.taxCents, 660);
  assert.strictEqual(t.totalCents, 10000 + 5000 - 3000 + 660);
});

test('25 largest-remainder allocation sums exactly on odd splits', function () {
  // $0.01 discount across three equal lines cannot lose or mint a cent.
  var t = P.invoiceTotals({
    lines: [{ cents: 333, taxable: false }, { cents: 333, taxable: false }, { cents: 334, taxable: false }],
    discountCents: 1, taxRate: 0.0825
  });
  assert.strictEqual(t.discountAllocationCents.reduce(function (a, b) { return a + b; }, 0), 1);
  assert.strictEqual(t.totalCents, 999);
});

test('26 discount clamps at subtotal; fee never taxed; empty invoice is zero', function () {
  var t = P.invoiceTotals({ lines: [{ cents: 500, taxable: true }], discountCents: 99900, adminFeeCents: 1000, taxRate: 0.0825 });
  assert.strictEqual(t.discountCents, 500);
  assert.strictEqual(t.taxCents, 0);
  assert.strictEqual(t.totalCents, 1000);        // fee survives, untaxed
  var z = P.invoiceTotals({ lines: [], discountCents: 500, adminFeeCents: 0, taxRate: 0.0825 });
  assert.strictEqual(z.totalCents, 0);
});

test('27 two siblings, one invoice: family pricing + gear, cents end to end', function () {
  // Kid A first member Option C; kid B second member ($119, no down); sparring gear $242.50.
  var a = quote('juniors_option_c', { contact_id: 'A', activeMemberships: [] }, []);
  var b = quote('juniors_option_c',
    { contact_id: 'B', activeMemberships: [] },
    [{ contact_id: 'A', activeMemberships: [ms('juniors_option_c', '2026-08-01')] }]);
  assert.strictEqual(b.finalRecurringCents, 11900);
  assert.strictEqual(b.finalDownCents, 0);
  var t = P.invoiceTotals({
    lines: [
      { cents: P.dueTodayCents(a, null), taxable: false },   // 36900
      { cents: P.dueTodayCents(b, null), taxable: false },   // 11900
      { cents: 24250, taxable: true }
    ],
    discountCents: 0, adminFeeCents: 0, taxRate: 0.0825
  });
  assert.strictEqual(t.subtotalCents, 36900 + 11900 + 24250);
  assert.strictEqual(t.taxCents, 2001);          // 24250 * .0825 = 2000.625 → half-up 2001
  assert.strictEqual(t.totalCents, 75051);
});

test('28 float dollars would have drifted; cents do not', function () {
  // The classic: 19.99 * 3 in floats is 59.969999…; in cents it is exact.
  var t = P.invoiceTotals({ lines: [{ cents: 1999 * 3, taxable: true }], taxRate: 0.0825 });
  assert.strictEqual(t.subtotalCents, 5997);
  assert.strictEqual(t.taxCents, 495);           // 5997 * .0825 = 494.7525 → 495
  assert.strictEqual(t.totalCents, 6492);
});

test('29 allocateCents: exact sum, stable order, degenerate inputs', function () {
  assert.deepStrictEqual(P.allocateCents(1, [333, 333, 334]), [0, 0, 1]);
  assert.deepStrictEqual(P.allocateCents(100, [1, 1, 1]).reduce(function (a, b) { return a + b; }, 0), 100);
  assert.deepStrictEqual(P.allocateCents(679, [8225]), [679]);            // one taxable line takes all tax
  assert.deepStrictEqual(P.allocateCents(0, [10, 20]), [0, 0]);
  assert.deepStrictEqual(P.allocateCents(50, []), []);
  assert.deepStrictEqual(P.allocateCents(50, [0, 0]), [0, 0]);
  // invoiceTotals must still allocate identically after the refactor.
  var t = P.invoiceTotals({
    lines: [{ cents: 10000, taxable: true }, { cents: 5000, taxable: false }],
    discountCents: 3000, taxRate: 0.0825
  });
  assert.deepStrictEqual(t.discountAllocationCents, [2000, 1000]);
});

// ─── belt-testing fee ladder (owner spec 2026-08-19) ───────────────────────

var TFEE = {
  testing_fee_cubs_cents: 5000,
  testing_fee_standard_cents: 6000,
  testing_fee_2nd_cents: 5000,
  testing_fee_3rd_cents: 3000,
  testing_fee_addl_cents: 1000
};

test('30 testing seat 1 follows the program, later seats are flat', function () {
  var f = function (program, position) {
    return P.testingFeeCents({ program: program, position: position, settings: TFEE });
  };
  assert.strictEqual(f('Cubs', 1), 5000, 'Cubs first seat is $50');
  assert.strictEqual(f('Juniors', 1), 6000);
  assert.strictEqual(f('Teens/Adults', 1), 6000);
  // Seats 2+ ignore the program entirely: a Cubs second child is still $50,
  // and a Juniors third child is still $30.
  assert.strictEqual(f('Cubs', 2), 5000);
  assert.strictEqual(f('Juniors', 2), 5000);
  assert.strictEqual(f('Cubs', 3), 3000);
  assert.strictEqual(f('Juniors', 3), 3000);
});

test('31 fourth seat and EACH additional is $10', function () {
  var f = function (n) { return P.testingFeeCents({ program: 'Juniors', position: n, settings: TFEE }); };
  assert.strictEqual(f(4), 1000);
  assert.strictEqual(f(5), 1000, 'the ladder does not stop at four');
  assert.strictEqual(f(9), 1000);
});

test('32 a whole family adds up the way Race described it', function () {
  var seat = function (program, position) {
    return P.testingFeeCents({ program: program, position: position, settings: TFEE });
  };
  // Two Juniors siblings: $60 + $50.
  assert.strictEqual(seat('Juniors', 1) + seat('Juniors', 2), 11000);
  // Cubs first, Juniors second: the owner's stated case, $50 + $50.
  assert.strictEqual(seat('Cubs', 1) + seat('Juniors', 2), 10000);
  // Five kids: 60 + 50 + 30 + 10 + 10.
  var five = seat('Juniors', 1) + seat('Juniors', 2) + seat('Juniors', 3)
           + seat('Juniors', 4) + seat('Juniors', 5);
  assert.strictEqual(five, 16000);
});

test('33 a parent returning later starts at seat 2 with no seat 1 in the cart', function () {
  // The whole point of declared positions: this is one student, checked out
  // alone, at the second-family-member price.
  assert.strictEqual(P.testingFeeCents({ program: 'Juniors', position: 2, settings: TFEE }), 5000);
  assert.strictEqual(P.testingFeeCents({ program: 'Cubs', position: 4, settings: TFEE }), 1000);
});

test('34 missing or junk settings fall back, never to free', function () {
  // A misspelled settings key must not make testing cost nothing.
  assert.strictEqual(P.testingFeeCents({ program: 'Juniors', position: 1, settings: {} }), 6000);
  assert.strictEqual(P.testingFeeCents({ program: 'Cubs', position: 1 }), 5000);
  assert.strictEqual(P.testingFeeCents({ position: 3, settings: {} }), 3000);
  assert.strictEqual(P.testingFeeCents({ program: 'Juniors', position: 1, settings: { testing_fee_standard_cents: 'abc' } }), 6000);
  // Nonsense positions clamp to seat 1 rather than throwing or going free.
  assert.strictEqual(P.testingFeeCents({ program: 'Juniors', position: 0, settings: TFEE }), 6000);
  assert.strictEqual(P.testingFeeCents({ program: 'Juniors', position: -3, settings: TFEE }), 6000);
  assert.strictEqual(P.testingFeeCents({ program: 'Cubs' }), 5000);
});

test('35 testing seats run through invoiceTotals as taxable lines', function () {
  // The catalog marks the testing fee taxable today. Two seats, card fee on
  // the pre-tax base, tax on the seats.
  var lines = [
    { cents: P.testingFeeCents({ program: 'Juniors', position: 1, settings: TFEE }), taxable: true },
    { cents: P.testingFeeCents({ program: 'Cubs', position: 2, settings: TFEE }), taxable: true }
  ];
  var base = 6000 + 5000;
  var fee = Math.round(base * 290 / 10000) + 30;             // 319 + 30
  assert.strictEqual(fee, 349);
  var t = P.invoiceTotals({ lines: lines, discountCents: 0, adminFeeCents: fee, taxRate: 0.0825 });
  assert.strictEqual(t.subtotalCents, 11000);
  assert.strictEqual(t.taxCents, 908);                        // 11000 * .0825 = 907.5 → 908
  assert.strictEqual(t.totalCents, 11000 + 349 + 908);
});

// ─── summary ───────────────────────────────────────────────────────────────

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
