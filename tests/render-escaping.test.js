/* ============================================================================
 * Render escaping
 * ----------------------------------------------------------------------------
 *     node tests/render-escaping.test.js
 *
 * Contact names, phones and ranks reach the CRM from the public website
 * (trial and checkout forms) and are rendered into staff screens. They must
 * land as text, never as markup: a first name of "<img onerror=...>" typed
 * into the website form would otherwise run inside a staff session.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function liftFn(name) {
  const re = new RegExp('\\n(?:async )?function ' + name + '\\s*\\([\\s\\S]*?\\n\\}', 'm');
  const m = re.exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}
function liftConst(name) {
  const re = new RegExp('\\nconst ' + name + ' = [^\\n]*');
  const m = re.exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}

const sandbox = { BELT: { White: '#fff' }, ATT_PRESENT: new Set(), ATT_SRC: {}, console };
vm.createContext(sandbox);
vm.runInContext([liftConst('escHtml'), liftConst('escAttr'), liftConst('initials'), liftFn('attRowHtml')].join('\n'), sandbox);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.message)); }
}

test('a contact name with markup renders as text on the attendance roster', () => {
  sandbox.M = { id: 'c1', first: '<img src=x onerror=alert(1)>', last: 'Lee', rank: 'Yellow<script>', belt: '' };
  const out = vm.runInContext('attRowHtml(M)', sandbox);
  assert.ok(!out.includes('<img src=x'), 'raw tag leaked into the roster');
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt; Lee'), 'name is escaped');
  assert.ok(out.includes('Yellow&lt;script&gt;'), 'rank is escaped');
});

test('a check-in source cannot break out of its title attribute', () => {
  sandbox.ATT_PRESENT.add('c2');
  sandbox.ATT_SRC.c2 = { id: 'a', source: 'kiosk" onmouseover="alert(1)' };
  sandbox.M = { id: 'c2', first: 'Sam', last: 'Lee', rank: '', belt: '' };
  const out = vm.runInContext('attRowHtml(M)', sandbox);
  assert.ok(!out.includes('" onmouseover='), 'attribute boundary escaped');
  assert.ok(out.includes('&quot;'), 'quote encoded');
});

test('no render path concatenates a raw contact name into markup', () => {
  // Every remaining `m.first+' '+m.last` / `m.first+" "+m.last` in generated
  // HTML must be wrapped; string-building for searches and toasts is fine.
  const raw = html.split('\n').filter(l =>
    /innerHTML|\+'<|\+"</.test(l) && /\+m\.first\+['"] ['"]\+m\.last\+/.test(l) && !/escHtml\(m\.first/.test(l));
  assert.deepStrictEqual(raw, [], 'unescaped name in generated markup:\n' + raw.join('\n'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
