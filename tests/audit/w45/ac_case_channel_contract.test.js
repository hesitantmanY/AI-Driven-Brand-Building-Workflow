/* AC-W45-C: all five cases must satisfy the Work4 place/channel data contract. */
'use strict';
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const base = path.join(root, 'docs', 'cases');
const brands = ['douya-mama','xiaohuo-ji','wenqu-shuyuan','hengrui-zao','maohaizi-house'];

function loadWork4(brand){
  global.window = {};
  require(path.join(base, brand, 'work4.js'));
  return global.window['__case_' + brand.replace(/-/g, '_') + '_work4'];
}

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

for(const brand of brands){
  const w4 = loadWork4(brand);
  const place = w4 && w4.place;
  ok(brand + ': keyPartners[].side 只能是 线上/线下/空字符串',
    Array.isArray(place.keyPartners) && place.keyPartners.every(p => p && ['线上','线下',''].includes(p.side)),
    JSON.stringify(place.keyPartners));
  ok(brand + ': place.structure 固定为 [线上,线下] 两组',
    Array.isArray(place.structure) && place.structure.length === 2 &&
    place.structure.map(g => String(g && g.name).trim()).join('|') === '线上|线下',
    JSON.stringify(place.structure && place.structure.map(g => g && g.name)));
  ok(brand + ': 每组二级渠道占比合计 100%（销售占比语义）',
    Array.isArray(place.structure) && place.structure.length === 2 &&
    place.structure.every(g => Array.isArray(g.children) && g.children.length > 0 &&
      g.children.every(c => c && Number.isFinite(Number(c.share))) &&
      Math.abs(g.children.reduce((s,c) => s + Number(c.share), 0) - 100) < 1e-9),
    JSON.stringify(place.structure && place.structure.map(g => ({name:g.name, sum:(g.children||[]).reduce((s,c)=>s+Number(c.share||0),0)}))));
  ok(brand + ': 二级渠道名称非空且占比为数值',
    Array.isArray(place.structure) && place.structure.every(g => (g.children || []).every(c => String(c.name || '').trim() && Number.isFinite(Number(c.share)))),
    JSON.stringify(place.structure));
}
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
