/* Security regression tests for the frontend surfaces (no framework).

   Run: node tests/security_frontend.test.js

   Locks in the contracts that prevent accidental secret leakage and HTML
   injection from user/LLM text:
   - secrets/config/data are git-ignored and not tracked;
   - exported .md embeds a masked state (no API key);
   - Work4.renderMarkdown escapes raw HTML before applying its safe subset;
   - MatrixChart escapes point ids/labels/tooltips in generated SVG.
*/
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let pass = 0, fail = 0;

function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

// Real HTML escaper, same mapping as global-brand-building.html.
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n');
for (const secret of ['server/.env', 'server/config.yaml', 'server/data/default/current.json']) {
  ok(`not tracked: ${secret}`, !tracked.includes(secret));
}

const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
for (const line of ['server/config.yaml', 'server/.env', 'server/data/']) {
  ok(`gitignore covers ${line}`, ignore.split('\n').map(s => s.trim()).includes(line));
}

// ---- Markdown export never embeds the live API key ----
const MarkdownExchange = require(path.join(root, 'docs', 'lib', 'markdown_exchange.js'));
const secret = 'sk-security-regression-secret';
const state = {
  meta: { loadedFrom: '安全回归' },
  settings: { api: { apiKey: secret } },
  work1: {}, work2: {}, work3: {}, work4: {}, work5: {}
};
const md = MarkdownExchange.buildExportMarkdown({
  state,
  workExports: { work1: '', work2: '', work3: '', work4: '', work5: '' }
});
ok('exported markdown does not contain api key', !md.markdown.includes(secret));
ok('exported markdown masks key', !md.markdown.includes('"apiKey":"' + secret + '"'));

// ---- Work4.renderMarkdown: escape first, then apply the safe subset ----
function loadWork4() {
  const sandbox = { console, el: () => null };
  sandbox.window = {};
  sandbox.Work4 = {};
  vm.createContext(sandbox);
  const src = fs.readFileSync(path.join(root, 'docs', 'workshop4.js'), 'utf8');
  try { vm.runInContext(src, sandbox); } catch (_) { /* see check below */ }
  if (typeof sandbox.Work4.renderMarkdown !== 'function') {
    throw new Error('Work4.renderMarkdown not mounted; eval failed before definition');
  }
  return sandbox.Work4;
}

const W4 = loadWork4();
{
  const out = W4.renderMarkdown('<script>window.pwn=1</script>');
  ok('renderMarkdown escapes <script>', !/<script/i.test(out) && out.includes('&lt;script&gt;'), out);
}
{
  const out = W4.renderMarkdown('<img src=x onerror="window.pwn=1">');
  ok('renderMarkdown escapes event-handler HTML',
     !/<img/i.test(out) && out.includes('&lt;img'), out);
}
{
  const out = W4.renderMarkdown('**bold** stays, <b>raw</b> does not');
  ok('renderMarkdown keeps safe bold but strips raw tags',
     out.includes('<strong>bold</strong>') && !out.includes('<b>'), out);
}

// ---- MatrixChart: SVG text/id/title must escape user data ----
global.median = a => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
global.esc = esc;
const Chart = require(path.join(root, 'docs', 'lib', 'matrix_chart.js'));
{
  const c = {
    _html: '',
    set innerHTML(v) { this._html = String(v); },
    get innerHTML() { return this._html; },
    querySelectorAll() { return []; }
  };
  Chart.render({
    container: c,
    points: [{ id: '<script>bad</script>', label: '<img src=x onerror=alert(1)>', x: 9, y: 9 }],
    xCut: 7, yCut: 7,
    hover: p => p.label
  });
  ok('matrix chart escapes data-pid', !c.innerHTML.includes('<script>') &&
     c.innerHTML.includes('data-pid="&lt;script&gt;'), c.innerHTML.slice(0, 400));
  ok('matrix chart escapes tooltip/label', !c.innerHTML.includes('<img') &&
     c.innerHTML.includes('&lt;img'), c.innerHTML.slice(0, 400));
}
delete global.median;
delete global.esc;

// ---- Workshop1 smile curve (SEC04): node text must be escaped before SVG ----
{
  const w1 = fs.readFileSync(path.join(root, 'docs', 'workshop1.js'), 'utf8');
  const start = w1.indexOf('const buildSvg');
  const end = w1.indexOf('const wrap', start);
  const svg = w1.slice(start, end);
  ok('smile curve found in workshop1.js', start >= 0 && end > start);
  ok('smile curve escapes label before SVG interpolation',
     /const lab = esc\(/.test(svg) && !svg.includes('${n.label}'), svg.slice(0, 200));
  ok('smile curve escapes value and reason/tip',
     /const val = esc\(/.test(svg) && /esc\(String\(why\)\)/.test(svg) &&
     !svg.includes('${why}'), svg.slice(0, 200));
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
