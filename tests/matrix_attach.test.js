/* Node test: 矩阵图必须挂载进 DOM（2026-09-01 修复回归）。

   Bug：workshop2 / workshop3 的 renderMatrix 把 SVG 画进 scatterPlate，
   但 scatterPlate 从未 appendChild 到 plate——矩阵图+扇面全部进孤儿节点。
   本测试锁死「renderMatrix 之后必须 plate.appendChild(scatterPlate)」，
   并真实渲染 W3.matrix 步骤断言 SVG 进入 DOM 树。

   Run: node tests/matrix_attach.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'docs');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

// ---- 源码断言：两处 renderMatrix 之后都有 appendChild(scatterPlate) ----
for(const f of ['workshop2.js','workshop3.js']){
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const i = src.indexOf('renderMatrix({');
  const j = src.indexOf('plate.appendChild(scatterPlate);', i);
  ok(f + ': scatterPlate appended after renderMatrix', j > i && j - i < 1200);
}

// ---- 行为断言：真实渲染 W3.matrix，SVG 必须出现在 plate 子树里 ----
function makeNode(tag){
  const node = {
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], attrs: {}, style: {}, className: '',
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(){},
    setAttribute(k,v){ this.attrs[k]=String(v); },
    removeAttribute(k){ delete this.attrs[k]; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    set innerHTML(v){ this._innerHTML = String(v); this.children = []; },
    get innerHTML(){ return this._innerHTML || ''; }
  };
  return node;
}
function collect(node, out){
  out.push(node);
  (node.children || []).forEach(c => collect(c, out));
}
const document = {
  createElement: t => makeNode(t),
  createTextNode: s => ({ nodeType:3, text:String(s), children:[] }),
  getElementById: () => null,
  querySelector: () => null
};
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document,
  el(tag, attrs={}, ...children){
    const e = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k==='class') e.className=v;
      else if(k==='html') e.innerHTML=v;
      else if(k.startsWith('on') && typeof v==='function') e.addEventListener(k.slice(2), v);
      else if(k==='style'){ if(typeof v==='object') Object.assign(e.style, v); }
      else if(typeof v==='boolean'){ if(v) e.setAttribute(k,''); }
      else if(v==null) continue;
      else e.setAttribute(k,v);
    }
    for(const c of children.flat()){ if(c==null||c===false) continue; e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c); }
    return e;
  },
  esc: s => String(s??''),
  uid: p => 'id_'+Math.random().toString(36).slice(2,9),
  mean: a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0,
  median: a => { if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  clamp: (v,lo,hi)=>Math.max(lo,Math.min(hi,v)),
  autosave: () => {},
  showToast: () => {},
  confirm: () => true,
  backendOnline: false,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, App: {}, Runner: {}, API: {},
  UI: { field: (label,input)=>({tag:'label',children:[label,input]}) },
  AiContext: { mountSettings: (container,cfg)=>({ current:()=>({sections:(cfg.needs||[]).slice(),fewShot:cfg.fewShotKey||null}), reset(){} }) },
  renderMatrix(opts){
    const svg = '<svg class="chart">' + (opts.showSector ? '<path class="sector"/>' : '') + '</svg>';
    opts.container.innerHTML = svg;
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
vm.runInContext(fs.readFileSync(path.join(root, 'workshop3.js'), 'utf8'), sandbox, {filename:'workshop3.js'});

// 用真实案例数据（douya-mama work3）渲染
const fakeWindow = {};
global.window = fakeWindow;
require(path.join(root, 'cases', 'douya-mama', 'work3.js'));
delete global.window;
sandbox.state = {
  settings: { manualMode: false },
  work1: { sbu: { name:'豆芽妈妈' }, personas: [] },
  work2: {},
  work3: fakeWindow.__case_douya_mama_work3
};
const sec = sandbox.el('section');
const plate = sandbox.el('div', {class:'plate'});
sec.querySelector = () => plate;
sandbox.Work3.render.matrix(sec);

const all = [];
collect(plate, all);
const svgNode = all.find(n => (n.innerHTML || '').includes('<svg'));
ok('W3.matrix render: SVG 进入 DOM 树（scatterPlate 已挂载）', !!svgNode);
ok('W3.matrix render: 扇面 path 随图进入 DOM（showSector=true）', !!svgNode && (svgNode.innerHTML || '').includes('sector'));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
