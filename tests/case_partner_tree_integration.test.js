/* 集成回归：5 个真实案例载入 → Work4 迁移 → W5 渠道树/md 投影。
   2026-09-07 诊断发现：单组结构案例（douya-mama）的线下伙伴会落“未挂载”，
   违反“任一案例伙伴行按线上/线下分组”验收——迁移须为单组旧数据补齐缺失桶。
   Run: node tests/case_partner_tree_integration.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const casesDir = path.join(__dirname, '..', 'docs', 'cases');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function collectText(n){
  if(typeof n === 'string') return n;
  if(n && n.nodeType === 3) return String(n.text || '');
  let out = n._innerHTML || '';
  for(const c of (n.children || [])) out += collectText(c);
  return out;
}

// 1. 读 5 个案例 work4 源数据（与浏览器同一批文件）
const brands = fs.readdirSync(casesDir)
  .filter(b => fs.existsSync(path.join(casesDir, b, 'work4.js')))
  .sort();
const rawByBrand = {};
for(const brand of brands){
  const fakeWindow = {};
  const ctx = vm.createContext({ window: fakeWindow, console });
  vm.runInContext(fs.readFileSync(path.join(casesDir, brand, 'work4.js'), 'utf8'), ctx, {filename: brand + '/work4.js'});
  const key = '__case_' + brand.replace(/-/g, '_') + '_work4';
  rawByBrand[brand] = fakeWindow[key] || {};
}

// 2. 加载 Work4（只需迁移函数）
const w4Sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document: { body:{dataset:{}}, querySelector:()=>null, createElement:()=>({style:{},appendChild(){},addEventListener(){},setAttribute(){}}) },
  el: () => ({ appendChild(){ return this; }, querySelector(){ return null; } }),
  state:null, Work1:{}, Work2:{}, Work3:{}, Work4:{}, UI:{}, App:{}, Runner:{}, API:{}
};
w4Sandbox.window = w4Sandbox;
vm.createContext(w4Sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop4.js'), 'utf8'), w4Sandbox, {filename:'workshop4.js'});
const migrate = w4Sandbox.Work4.migrateKeyPartners; // 具名引用：migrations 顺序非契约（种子迁移需排在其前）

// 3. 加载 Work5（channelMd / channelTreeSvg）
function makeNode(tag){
  return {
    tagName:String(tag).toUpperCase(), nodeType:1, children:[], attrs:{}, style:{}, className:'',
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(){}, setAttribute(k,v){ this.attrs[k]=String(v); },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    set innerHTML(v){ this._innerHTML=String(v); this.children=[]; },
    get innerHTML(){ return this._innerHTML||''; }
  };
}
const document = {
  createElement:t=>makeNode(t),
  createTextNode:s=>({nodeType:3,text:String(s),children:[]}),
  head:{appendChild(){}}, getElementById:()=>null, querySelector:()=>null
};
const w5Sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document,
  el(tag, attrs={}, ...children){
    const e=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k==='class') e.className=v;
      else if(k.startsWith('on')&&typeof v==='function') e.addEventListener(k.slice(2),v);
      else if(k==='style'&&typeof v==='object') Object.assign(e.style,v);
      else if(v==null) continue;
      else e.setAttribute(k,v);
    }
    for(const c of children.flat()){ if(c==null||c===false) continue; e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c); }
    return e;
  },
  esc:s=>String(s??''), uid:p=>'id_'+Math.random().toString(36).slice(2,9),
  autosave(){}, showToast(){}, confirm:()=>true,
  state:null,
  Work1:{}, Work2:{}, Work3:{}, Work4:{}, Work5:{}, App:{goWork(){}}, Runner:{}, API:{},
  UI:{mountMvo(){},mountMark(){},mountGuard(){return true;},demoNote(){return null;}},
  AiContext:{buildPrompt:()=>[]}, renderMatrix(){}
};
w5Sandbox.window = w5Sandbox;
vm.createContext(w5Sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop5.js'), 'utf8'), w5Sandbox, {filename:'workshop5.js'});
const W5 = w5Sandbox.Work5;

for(const brand of brands){
  const w4 = { place: rawByBrand[brand].place || {} };
  migrate(w4);
  w5Sandbox.state = { work4: w4 };
  const place = w4.place;
  const md = W5.channelMd();
  const partners = place.keyPartners || [];
  const hasStruct = (place.structure || []).length > 0;
  const classified = partners.filter(p => p && (p.side === '线上' || p.side === '线下'));
  ok(brand + '：迁移后伙伴全为对象', partners.length > 0
    && partners.every(p => p && typeof p === 'object' && !Array.isArray(p) && p.name));
  ok(brand + '：结构归位/补位后无未挂载', !hasStruct || !md.includes('未挂载'),
    brand + ' md=' + md.slice(0, 180).replace(/\n/g, ' / '));
  const partnerLines = md.split('\n').filter(l => l.includes('◇ 伙伴：'));
  const missing = classified.filter(p => !partnerLines.some(l => l.includes(p.name)));
  ok(brand + '：已分类伙伴全部出现在树投影分组中', missing.length === 0,
    (missing.map(p => p.name + ':' + p.side).join('、')));
  ok(brand + '：迁移后结构为 线上/线下 两组（单组自动补桶）',
    !hasStruct || ((place.structure[0] || {}).name === '线上' && (place.structure[1] || {}).name === '线下'),
    JSON.stringify((place.structure || []).map(g => g && g.name)));
  const host = makeNode('div');
  W5.channelBlock(host);
  const viewText = collectText(host);
  ok(brand + '：视图树图伙伴全部挂组且无未挂载',
    !viewText.includes('未挂载') && classified.every(p => viewText.includes(p.name)),
    viewText.slice(0, 260));
  ok(brand + '：视图树图含线下组块', viewText.includes('线下 0%') || viewText.includes('线下 100%'));
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
