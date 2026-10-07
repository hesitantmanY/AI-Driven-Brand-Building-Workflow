/* AC-W45-C: case text is plain text and has no retired Work5 keys. */
'use strict';
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const base = path.join(root, 'docs', 'cases');
const brands = ['douya-mama','xiaohuo-ji','wenqu-shuyuan','hengrui-zao','maohaizi-house'];
const forbiddenKeys = new Set(['cover','abstract','references']);

function loadWork(brand, wk){
  global.window = {};
  require(path.join(base, brand, wk + '.js'));
  return global.window['__case_' + brand.replace(/-/g, '_') + '_' + wk];
}
function walk(node, prefix, strings, keys){
  if(typeof node === 'string'){ strings.push([prefix, node]); return; }
  if(!node || typeof node !== 'object') return;
  if(Array.isArray(node)){ node.forEach((v,i) => walk(v, prefix + '[' + i + ']', strings, keys)); return; }
  for(const [k,v] of Object.entries(node)){
    const p = prefix ? prefix + '.' + k : k;
    if(forbiddenKeys.has(k)) keys.push(p);
    walk(v, p, strings, keys);
  }
}

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

for(const brand of brands){
  const strings = [], keys = [];
  for(const wk of ['work1','work2','work3','work4','work5']) walk(loadWork(brand, wk), wk, strings, keys);
  ok(brand + ': 无封面/摘要/参考文献禁用键', keys.length === 0, keys.join(','));
  const bad = strings.filter(([,s]) => /\n\s*\n|\*\*|__|^\s*#{1,6}(?:\s|$)|`|\[[^\]]+\]\([^)]+\)/m.test(s));
  ok(brand + ': 文本字段无 markdown 装饰残留与空行', bad.length === 0,
    bad.map(([p,s]) => p + '=' + JSON.stringify(s.slice(0,100))).join(' | '));
}
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
