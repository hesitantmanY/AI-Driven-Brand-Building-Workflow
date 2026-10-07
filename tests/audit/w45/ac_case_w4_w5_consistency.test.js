/* AC-W45-C: Work5 channel evidence must mirror Work4 channel tree data. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..', '..');
const base = path.join(root, 'docs', 'cases');
const brands = ['douya-mama','xiaohuo-ji','wenqu-shuyuan','hengrui-zao','maohaizi-house'];

function loadWork(brand, wk){
  global.window = {};
  require(path.join(base, brand, wk + '.js'));
  return global.window['__case_' + brand.replace(/-/g, '_') + '_' + wk];
}

const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise,
  document: {
    createElement(){ return { appendChild(){}, setAttribute(){}, style:{}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; },
    querySelector(){ return null; }, getElementById(){ return null; }
  },
  el(){ return { appendChild(){ return this; }, setAttribute(){}, addEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; } }; },
  esc: s => String(s ?? ''),
  autosave(){}, showToast(){}, confirm: () => true,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, Work4: {}, Work5: {}, UI: {}, App: {}, Runner: {}, API: {}, AiContext: {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'docs', 'workshop5.js'), 'utf8'), sandbox, {filename:'workshop5.js'});
const W5 = sandbox.Work5;

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

for(const brand of brands){
  const w4 = loadWork(brand, 'work4');
  const w5 = loadWork(brand, 'work5');
  sandbox.state = { work1:{}, work2:{}, work3:{}, work4:w4, work5:w5 };
  const md = W5.channelMd();
  const place = w4.place;
  const groups = place.structure || [];
  const partners = place.keyPartners || [];
  ok(brand + ': Work5 渠道证据块包含 Work4 全部渠道组与二级占比',
    groups.every(g => md.includes('- ' + g.name + '（' + g.children.reduce((s,c)=>s+Number(c.share||0),0) + '%）') &&
      g.children.every(c => md.includes('  - ' + c.name + ' ' + Number(c.share || 0) + '%'))),
    md.slice(0, 240));
  const byGroup = { '线上': [], '线下': [] };
  partners.forEach(p => { if(p && byGroup[p.side]) byGroup[p.side].push(p.name); });
  ok(brand + ': Work5 伙伴归属与 Work4 side 对得上',
    Object.entries(byGroup).every(([side,names]) => !names.length || md.includes('  - ◇ 伙伴：' + names.join('、'))),
    md.slice(0, 320));
  ok(brand + ': Work5 渠道证据无未分类/未挂载伙伴',
    !md.includes('未分类伙伴') && !md.includes('未挂载伙伴'), md.slice(0, 320));
  ok(brand + ': Work5 4P place 摘要与表 4-1 place 非空',
    String(w5.ch4_mix.place || '').trim() &&
    String(w5.ch4_mix.pTable.place.core || '').trim() &&
    String(w5.ch4_mix.pTable.place.actions || '').trim() &&
    String(w5.ch4_mix.pTable.place.nums || '').trim());
}
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
