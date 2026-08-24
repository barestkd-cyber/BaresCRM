/* ============================================================================
 * Every scheduled class resolves to a program, in all three apps
 * ----------------------------------------------------------------------------
 *     node tests/schedule-programs.test.js
 *
 * WHY THIS EXISTS. schedule_template.prog_css is a CSS CLASS NAME. Its only
 * original job was to colour a cell on the class plan grid, which is why
 * Kickboxing and Jiu Jitsu share prog-kick (both blue) and why Juniors, Teens,
 * Forms, Sparring and Leadership all share the red one.
 *
 * Two systems then started using that colour to answer "what program is this
 * class", which it was never meant to answer, and both had to bolt label
 * matching on top to split the classes that share a colour:
 *
 *   class plan  prog_css -> a colour           (its actual job)
 *   website     prog_css + label -> a program bucket on the public schedule
 *   CRM         prog_css + label -> which roster attendance pulls
 *
 * On 2026-08-23 the owner found the consequence. Thursday 7pm had been retitled
 * from Kickboxing to Jiu Jitsu. The website knew, because its label matching
 * covered it. The CRM did not, so taking the register for Jiu Jitsu listed the
 * Kickboxing students. It failed silently: both screens looked fine.
 *
 * So this walks EVERY row of the real schedule and fails loudly on any class
 * that some app cannot place. It reads each app's real source rather than a
 * copy of its rules, because a copy would drift in exactly the way this exists
 * to prevent.
 *
 * If this fails after you add a class, you have not broken the test. You have
 * added a class that one of the three apps cannot identify, and it would have
 * shown the wrong students or the wrong heading in production.
 *
 * VERIFIED BY REINTRODUCING THE BUGS. Each of these was put back one at a time
 * and this file was confirmed to fail on it, then restored:
 *   - the CRM forgetting Jiu Jitsu           (the original 2026-08-23 bug)
 *   - a class added with an unknown prog_css (the likely next one)
 *   - class plan drawing Jiu Jitsu as Kickboxing
 *   - a gate naming a roster with no checkbox on the profile
 * Do that again if you change the assertions. A check that cannot fail is
 * worse than no check, because it reads as coverage.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const LIVE = path.join(__dirname, '..', '..');
const crm = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r/g, '');
const classplanPath = path.join(LIVE, 'classplan', 'index.html');
const sitePath = path.join(LIVE, 'barestkd-site', 'supabase', 'functions', 'trial-booking', 'index.ts');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function need(p, what) {
  if (!fs.existsSync(p)) { console.log('\nCannot run: ' + what + ' not found at ' + p + '\n'); process.exit(1); }
  return fs.readFileSync(p, 'utf8').replace(/\r/g, '');
}
const classplan = need(classplanPath, 'class plan');
const site = need(sitePath, 'the public trial-booking function');

/* Pull a balanced [...] or {...} literal starting at a marker. */
function block(src, marker, open, close) {
  const start = src.indexOf(marker);
  assert.ok(start > -1, 'could not find ' + marker);
  let i = src.indexOf(open, start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error('unbalanced ' + marker);
}
function liftFn(src, name) {
  const m = new RegExp('\\n(?:async )?function ' + name + '\\s*\\([\\s\\S]*?\\n\\}', 'm').exec(src);
  assert.ok(m, 'could not lift ' + name);
  return m[0];
}

/* ── the corpus: class plan's shipped schedule ───────────────────────── */
const SCHEDULE = vm.runInNewContext('(' + block(classplan, 'const SCHEDULE_TEMPLATE', '[', ']') + ')');
const ROWS = SCHEDULE.map((t) => ({ label: t.label, belt: t.belt, prog_css: t.progCss, progCss: t.progCss,
  program: t.program, divisions: t.divisions, day: t.day, time: t.time }));

/* ── each app's real rules ───────────────────────────────────────────── */
const cpCtx = vm.createContext({});
vm.runInContext(liftFn(classplan, 'progCssOf'), cpCtx);
const colourOf = (r) => vm.runInContext('progCssOf(' + JSON.stringify(r) + ')', cpCtx);

const crmCtx = vm.createContext({});
const gateDecl = /\nconst ATT_PROG_GATE\s*=[^\n]*/.exec(crm);
assert.ok(gateDecl, 'could not lift ATT_PROG_GATE');
vm.runInContext(gateDecl[0] + '\n' + liftFn(crm, 'attProgramFor') + '\n' + liftFn(crm, 'attProgramsFor'), crmCtx);
// Phase 1 (2026-08-24): the schedule now carries program + divisions and the
// CRM reads THOSE, with the old inference as fallback. columnsOf is what
// attendance actually uses; the legacy path stays lifted so the agreement
// test below can hold the two against each other for as long as both exist.
const columnsOf = (r) => vm.runInContext('attProgramsFor(' + JSON.stringify(r) + ')', crmCtx);
// A class may legitimately pull from MORE THAN ONE roster: Forms and Sparring
// serve Juniors and Teens/Adults together, so the gate returns an array and
// attRenderRoster unions them. Always compare as a list.
const rosterOf = (r) => {
  const got = vm.runInContext('attProgramFor(' + JSON.stringify(r) + ')', crmCtx);
  return Array.isArray(got) ? got : [got];
};
const ROSTER_PROGRAMS = vm.runInNewContext(
  '(' + /const ROSTER_PROGRAMS = (\[[^\]]*\])/.exec(crm)[1] + ')');

// The site's matchers are real TypeScript; only the annotations are in the way.
const siteCtx = vm.createContext({});
vm.runInContext(block(site, 'const MARKETING', '[', ']').replace(/:\s*any\b/g, '')
  .replace(/^\[/, 'var MARKETING = ['), siteCtx);
const bucketOf = (r) => vm.runInContext(
  'MARKETING.filter(function(m){return m.match(' + JSON.stringify(r) + ')}).map(function(m){return m.program})', siteCtx);

const where = (r) => '"' + r.label + '" (' + ['Mon','Tue','Wed','Thu','Fri','Sat'][r.day] + ' ' + r.time + ', ' + r.prog_css + ')';

/* ── the checks ──────────────────────────────────────────────────────── */

test('the schedule was read at all', () => {
  assert.ok(ROWS.length >= 15, 'only found ' + ROWS.length + ' classes, the lift is probably broken');
  assert.ok(ROWS.every((r) => r.label && r.prog_css), 'a class has no label or no prog_css');
});

test('the CRM can name a roster for every class', () => {
  // 'TKD' is attProgramFor's fallback and means "no idea". A class that lands
  // there takes the register against a roster nobody is on.
  const lost = ROWS.filter((r) => rosterOf(r).indexOf('TKD') > -1).map(where);
  assert.strictEqual(lost.length, 0,
    'the CRM cannot place these classes, so attendance would list nobody:\n         ' + lost.join('\n         '));
});

/* ── Phase 1: the schedule states program + divisions outright ───────── */

test('every class carries the approved program and divisions', () => {
  // The backfill is total, in the snapshot as well as the live table. A class
  // added without them still WORKS (the fallback inference catches it) but it
  // is a half-authored row, and this is where that shows up.
  const bare = ROWS.filter((r) => !r.program || !Array.isArray(r.divisions)).map(where);
  assert.strictEqual(bare.length, 0,
    'classes with no program or divisions authored:\n         ' + bare.join('\n         '));
  const tkdEmpty = ROWS.filter((r) => r.program === 'Taekwondo' && !r.divisions.length).map(where);
  assert.strictEqual(tkdEmpty.length, 0,
    'Taekwondo classes must say who attends, these do not:\n         ' + tkdEmpty.join('\n         '));
});

test('the columns agree with the legacy inference, except where they correct it', () => {
  // The safety argument of the migration: both paths exist during the
  // transition, and an UNDOCUMENTED disagreement means one of them is lying.
  // Two disagreements are deliberate, approved in the backfill table, and the
  // columns are the correct side of both:
  const CORRECTED = {
    // The inference lumped Little Kickers onto the Cubs roster because they
    // share prog-cubs. Two people are enrolled in Little Kickers; they were
    // invisible to their own class.
    '2|9:30': { now: 'Little Kickers', old: 'Cubs' },
    // The label says Juniors/Teens/Adults. The inference only ever returned
    // Juniors, silently hiding every Teens/Adults member from the morning
    // class's attendance list. Found by this test on 2026-08-24.
    '2|10:15': { now: 'Juniors + Teens/Adults', old: 'Juniors' },
  };
  const asSet = (a) => [...new Set(a)].sort().join(' + ');
  const bad = [];
  ROWS.forEach((r) => {
    const stripped = { label: r.label, prog_css: r.prog_css, progCss: r.progCss };
    const now = asSet(columnsOf(r)), old = asSet(rosterOf(stripped));
    const fix = CORRECTED[r.day + '|' + r.time];
    if (fix) {
      // The exception is pinned exactly: drift in EITHER direction fails.
      if (now !== fix.now || old !== fix.old) {
        bad.push(where(r) + ': documented correction changed, columns say ' + now + ', inference says ' + old);
      }
    } else if (now !== old) {
      bad.push(where(r) + ': columns say ' + now + ', inference says ' + old);
    }
  });
  assert.strictEqual(bad.length, 0,
    'the two paths disagree:\n         ' + bad.join('\n         '));
});

test('every roster the columns name is one you can actually tick', () => {
  // Same guarantee as the legacy check above, for the path attendance now
  // actually uses: program/divisions must resolve to enrollment keys that
  // exist as checkboxes on the profile.
  const orphan = [...new Set(ROWS.flatMap(columnsOf))]
    .filter((p) => ROSTER_PROGRAMS.indexOf(p) === -1 && p !== 'TKD');
  assert.strictEqual(orphan.length, 0,
    'the columns resolve to rosters with no checkbox: ' + orphan.join(', '));
});

test('every belt value is from the closed list, and every rank range can filter', () => {
  // The belt field used to be free text, and a typo like BRN-BLK silently
  // no-opped the filter so the class listed the whole roster. The editor is a
  // dropdown now (classplan BELT_OPTIONS); this holds the schedule to it, and
  // holds attendance to knowing every hyphenated range on the list.
  const optDecl = /\nconst BELT_OPTIONS = (\[[^\]]*\])/.exec(classplan);
  assert.ok(optDecl, 'could not lift BELT_OPTIONS from class plan');
  const OPTIONS = vm.runInNewContext('(' + optDecl[1] + ')');
  const rangeDecl = /\nconst ATT_RANGE=(\{[^}]*\})/.exec(crm);
  assert.ok(rangeDecl, 'could not lift ATT_RANGE from the CRM');
  const RANGES = vm.runInNewContext('(' + rangeDecl[1] + ')');

  const offList = ROWS.filter((r) => OPTIONS.indexOf(r.belt || '') === -1).map(where);
  assert.strictEqual(offList.length, 0,
    'belt values the dropdown does not offer:\n         ' + offList.join('\n         '));

  // Anything shaped like a rank range must be one attendance can filter by;
  // an unknown one silently shows everyone, which is the failure this pins.
  const rankLooking = OPTIONS.filter((b) => /^[A-Z]{2,3}-[A-Z]{2,3}$/.test(b));
  const blind = rankLooking.filter((b) => !RANGES[b]);
  assert.strictEqual(blind.length, 0,
    'rank ranges attendance cannot filter (they would list everyone): ' + blind.join(', '));

  // The reason this test exists today: Leadership is Orange through Black.
  assert.ok(RANGES['ORG-BLK'], 'ORG-BLK is not a range attendance knows');
  const lead = ROWS.find((r) => r.label === 'Leadership');
  assert.ok(lead, 'no Leadership class on the schedule');
  assert.strictEqual(lead.belt, 'ORG-BLK', 'Leadership does not carry ORG-BLK');
});

test('every roster the CRM names is one you can actually tick', () => {
  // A gate that returns a program missing from the checkbox list is a roster
  // no one can ever be put on.
  const orphan = [...new Set(ROWS.flatMap(rosterOf))]
    .filter((p) => ROSTER_PROGRAMS.indexOf(p) === -1 && p !== 'TKD');
  assert.strictEqual(orphan.length, 0,
    'attendance pulls rosters with no checkbox on the profile: ' + orphan.join(', '));
});

test('the public schedule can bucket every class into exactly one program', () => {
  // Zero means it drops into the leftovers group under a title derived from
  // prog_css. Two means it appears twice on the public page.
  const bad = ROWS.map((r) => ({ r, hit: bucketOf(r) })).filter((x) => x.hit.length !== 1)
    .map((x) => where(x.r) + ' -> ' + (x.hit.length ? x.hit.join(' AND ') : 'nothing'));
  assert.strictEqual(bad.length, 0,
    'the public schedule cannot place these classes:\n         ' + bad.join('\n         '));
});

test('the website and the CRM agree on the classes that share a colour', () => {
  // This is the Thursday 7pm bug. Where a colour carries more than one program,
  // both apps have to split it the same way or the public page advertises one
  // class while the register is taken for another.
  const byCss = {};
  ROWS.forEach((r) => { (byCss[r.prog_css] = byCss[r.prog_css] || []).push(r); });
  const shared = Object.keys(byCss).filter((css) =>
    new Set(byCss[css].map((r) => bucketOf(r)[0])).size > 1);
  const bad = [];
  shared.forEach((css) => byCss[css].forEach((r) => {
    const site1 = bucketOf(r)[0], mine = rosterOf(r);
    // Taekwondo is one marketing bucket covering several rosters on purpose,
    // so only the buckets that name a single program are comparable.
    if (site1 === 'Taekwondo') return;
    if (mine.length !== 1 || site1 !== mine[0]) {
      bad.push(where(r) + ': site says ' + site1 + ', CRM says ' + mine.join(' + '));
    }
  }));
  assert.strictEqual(bad.length, 0,
    'a shared colour is split differently by the two apps:\n         ' + bad.join('\n         '));
});

test('class plan has a colour defined for every class it draws', () => {
  // progCssOf returning a class with no CSS rule behind it renders in the
  // default text colour, silently.
  const defined = new Set((classplan.match(/\.prog-[a-z]+(?=[,{])/g) || []).map((c) => c.slice(1)));
  const missing = [...new Set(ROWS.map(colourOf))].filter((c) => !defined.has(c));
  assert.strictEqual(missing.length, 0,
    'class plan draws these with no colour rule: ' + missing.join(', '));
});

test('a class sharing a colour is not drawn as the program it shares it with', () => {
  // Jiu Jitsu was blue because Kickboxing owns prog-kick. Two classes may share
  // a colour class only if the site puts them in the same program.
  const byColour = {};
  ROWS.forEach((r) => { (byColour[colourOf(r)] = byColour[colourOf(r)] || new Set()).add(bucketOf(r)[0]); });
  const muddled = Object.keys(byColour)
    .filter((c) => byColour[c].size > 1 && ![...byColour[c]].every((p) => p === 'Taekwondo'))
    .map((c) => c + ' is drawn for ' + [...byColour[c]].join(' and '));
  assert.strictEqual(muddled.length, 0,
    'these colours cover more than one program, so the grid is misleading:\n         ' + muddled.join('\n         '));
});

console.log('\n  ' + ROWS.length + ' classes checked across class plan, the website and the CRM');
console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
