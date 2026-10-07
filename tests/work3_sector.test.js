/* Node test: Work3 扇面新语义（2026-09-01 wayfinder map）。
   最优 = 第一象限（切分线）∩ 均衡带 |y−x| ≤ sectorWidth；排名表含补短板引导。
   Run: node tests/work3_sector.test.js
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
function makeNode(tag){
  const node = {
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], attrs: {}, style: {}, className: '',
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(){},
    setAttribute(k,v){ this.attrs[k]=String(v); if(k==='checked') this._checked=true; },
    removeAttribute(k){ delete this.attrs[k]; if(k==='checked') this._checked=false; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    set innerHTML(v){ this._innerHTML = String(v); this.children = []; },
    get innerHTML(){ return this._innerHTML || ''; }
  };
  return node;
}
function collectText(n){
  if(n.nodeType === 3) return String(n.text || '');
  let out = n._innerHTML || '';
  for(const c of (n.children||[])) out += collectText(c);
  return out;
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
  renderMatrix(){}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
vm.runInContext(fs.readFileSync(path.join(root, 'workshop3.js'), 'utf8'), sandbox, {filename:'workshop3.js'});
const W3 = sandbox.Work3;
const def = W3.defaultData();
ok('defaultData.matrix.sectorWidth === 1.5', def.matrix.sectorWidth === 1.5);
ok('defaultData.matrix 无 sectorAngle/sectorRadius', !('sectorAngle' in def.matrix) && !('sectorRadius' in def.matrix));
sandbox.state = { work3: { matrix: { showSector:true, sectorWidth:1.5, xCut:null, yCut:null } } };
ok('isInSector (8,9) 在带内', W3.isInSector(8,9) === true);
ok('isInSector (9,5) 在带外', W3.isInSector(9,5) === false);
ok('isInSector 边界 |y−x|=1.5 算带内', W3.isInSector(7,8.5) === true);
sandbox.state.work3.matrix.showSector = false;
ok('isInSector 关闭扇面 → false', W3.isInSector(8,9) === false);
sandbox.state = {
  work3: {
    context: { hasSurvey:false, personas: [] },
    proposition: {},
    migration: { prompt:'', analyses:[] },
    scenarios: [],
    matrix: { showSector:true, sectorWidth:1.5, xCut:null, yCut:null, manualSelected:[] },
    candidates: [
      { id:'a', name:'A', importance:8, uniqueness:8, credibility:8, feasibility:6, communicability:6, sustainability:6, desirabilityScores:{}, src_importance:'ai', src_uniqueness:'ai', src_credibility:'ai' },
      { id:'b', name:'B', importance:6, uniqueness:6, credibility:6, feasibility:8, communicability:8, sustainability:8, desirabilityScores:{}, src_importance:'ai', src_uniqueness:'ai', src_credibility:'ai' },
      { id:'c', name:'C', importance:4, uniqueness:4, credibility:4, feasibility:4, communicability:4, sustainability:4, desirabilityScores:{}, src_importance:'ai', src_uniqueness:'ai', src_credibility:'ai' }
    ],
    dimensions: {
      desirability: [{key:'importance',label:'重要性'},{key:'uniqueness',label:'独特性'},{key:'credibility',label:'可信性'}],
      implementability: [{key:'feasibility',label:'可行性'},{key:'communicability',label:'可传播性'},{key:'sustainability',label:'可持续性'}]
    }
  }
};
const cuts = W3.effectiveCuts();
ok('effectiveCuts null → median（x=6,y=6）', cuts.xCut === 6 && cuts.yCut === 6, JSON.stringify(cuts));
sandbox.state.work3.matrix.xCut = 7; sandbox.state.work3.matrix.yCut = 7;
ok('effectiveCuts 手动值优先', W3.effectiveCuts().xCut === 7);
ok('entrySuggestion 已最优', W3.entrySuggestion(8,8.5).ok === true && W3.entrySuggestion(8,8.5).text === '已最优');
const low = W3.entrySuggestion(6,6);
ok('entrySuggestion 双低 → 双补到门槛', low.ok === false && low.text.includes('可实施性 6.0→7.0') && low.text.includes('合意性 6.0→7.0'), low.text);
const unbal1 = W3.entrySuggestion(9,5);
ok('entrySuggestion 合意性偏科 → 补合意性', unbal1.text.includes('合意性 5.0→7.5'), unbal1.text);
const unbal2 = W3.entrySuggestion(5,9);
ok('entrySuggestion 可实施性偏科 → 补可实施性', unbal2.text.includes('可实施性 5.0→7.5'), unbal2.text);
const sec = sandbox.el('section');
const plate = sandbox.el('div', {class:'plate'});
sec.querySelector = () => plate;
sandbox.state.work3.matrix.showSector = true;
W3.render.matrix(sec);
const txt = collectText(plate);
ok('排名表有「如何进入最优」列', txt.includes('如何进入最优'));
ok('排名表有「扇面」列', txt.includes('扇面'));
ok('排名表有补短板引导（可实施性/合意性 → 门槛）',
  txt.includes('可实施性 6.0→7.0') && txt.includes('合意性 6.0→7.0'), txt.slice(0,400));
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
