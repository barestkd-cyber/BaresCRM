/* ============================================================================
 * Generates supabase/functions/_shared/pricing_esm.js from pricing.js.
 * ----------------------------------------------------------------------------
 * The Edge Functions must run the SAME pricing brain as the browser and the
 * tests. pricing.js is UMD (script-tag global + Node require), which Deno
 * cannot import — this script wraps the identical factory body as an ES
 * module. tests/pos-flow.test.js regenerates in memory and fails the suite
 * if the committed copy has drifted from pricing.js.
 *
 *     node tools/gen-esm-pricing.js        (regenerate after editing pricing.js)
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'pricing.js');
const OUT = path.join(ROOT, 'supabase', 'functions', '_shared', 'pricing_esm.js');

const HEADER_MARK = "})(typeof self !== 'undefined' ? self : this, function () {";

function generate(src) {
  const at = src.indexOf(HEADER_MARK);
  if (at === -1) {
    throw new Error('pricing.js UMD header changed — update tools/gen-esm-pricing.js to match');
  }
  let body = src.slice(at + HEADER_MARK.length);
  const tail = body.lastIndexOf('});');
  if (tail === -1 || body.slice(tail).trim() !== '});') {
    throw new Error('pricing.js UMD footer changed — update tools/gen-esm-pricing.js to match');
  }
  body = body.slice(0, tail);
  const banner = src.slice(0, src.indexOf('(function (root, factory)'));
  return banner
    + '// GENERATED from pricing.js by tools/gen-esm-pricing.js — DO NOT EDIT.\n'
    + '// tests/pos-flow.test.js fails if this file drifts from pricing.js.\n'
    + 'const BTKDPricing = (function () {' + body + '})();\n'
    + 'export default BTKDPricing;\n';
}

if (require.main === module) {
  const out = generate(fs.readFileSync(SRC, 'utf8'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out);
  console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + out.length + ' bytes)');
}

module.exports = { generate, OUT, SRC };
