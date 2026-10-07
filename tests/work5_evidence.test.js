/* Node test: W5 证据型策划书（2026-09-01 wayfinder map）。
   章节重排 + 来源条 + 证据块 + 可编辑排名表 + 导出排名表。
   Run: node tests/work5_evidence.test.js
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
  head: { appendChild(){} },
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
  Work1: {}, Work2: {}, Work3: {}, Work4: {}, Work5: {}, App: {}, Runner: {}, API: {},
  UI: {
    demoNote: () => null,
    mvoCard: () => null,
    mountGuard: () => true,
    mountMvo(){},
    mountMark(){}
  },
  AiContext: { buildPrompt: () => [] },
  renderMatrix(opts){
    opts.container.innerHTML = '<svg class="chart"><circle/></svg>';
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'workshop5.js'), 'utf8'), sandbox, {filename:'workshop5.js'});
const W5 = sandbox.Work5;

// 基础 state：work1/2/3 最小形状 + work5 默认
const w2Markets = [{id:'m1',name:'美国',region:'北美',population:'',gdpPerCapita:'',notes:'',scores:{},e_indId:'',src_indId:''}];
sandbox.Work2 = {
  computeMatrix: () => w2Markets.map(m=>({...m, x:8, y:9})),
  setTier1(){}
};
sandbox.Work3 = {
  computeMatrix: () => [{id:'a',name:'成分透明',scenarioId:'',x:8,y:8.5,selected:true},{id:'b',name:'偏科款',scenarioId:'',x:9,y:5,selected:false}],
  effectiveCuts: () => ({xCut:7, yCut:7}),
  isInSector: (x,y) => Math.abs(y-x) <= 1.5,
  entrySuggestion: (x,y) => { const dx=Math.max(0,7-x), dy=Math.max(0,7-y); return dx||dy ? {ok:false,text:'可实施性 '+(x+dx).toFixed(1)} : {ok:true,text:'已最优'}; },
  scenarioName: () => ''
};
sandbox.state = {
  work1: { sbu:{name:'豆芽妈妈',category:'母婴'}, environment:{ valueChain:[{label:'研发',v:8,reason:'x'}] }, personas: [] },
  work2: { matrix:{xCut:7,yCut:7}, markets: w2Markets, decision:{tier1:{marketId:'m1',name:'美国',rationale:'大'}} },
  work3: {
    matrix:{showSector:true,sectorWidth:1.5,xCut:7,yCut:7},
    candidates:[{id:'a',name:'成分透明',scenarioId:'',x:8,y:8.5,selected:true},{id:'b',name:'偏科款',scenarioId:'',x:9,y:5,selected:false}]
  },
  work4: {},
  work5: W5.defaultData()
};

// 渲染 plan 步骤
const sec = sandbox.el('section');
document.querySelector = sel => sel.includes('data-step="plan"') ? sec : null;
W5.renderStep('plan');
const txt = collectText(sec);
ok('章节 1 业务与市场', txt.includes('业务与市场'));
ok('章节 3 市场选择与定位（合并章）', txt.includes('市场选择与定位') && txt.includes('来自 Work 2'));
ok('章节 3 含痛点地图与 STP', txt.includes('痛点地图') && txt.includes('STP：细分 / 目标 / 定位'));
ok('章节 4 营销组合 / 5 总结与展望', txt.includes('营销组合') && txt.includes('总结与展望'));
ok('来源条「来自 Work 1」', txt.includes('来自 Work 1'));
ok('市场矩阵证据块已嵌入', txt.includes('市场吸引力 × 业务竞争力'));
ok('卖点矩阵证据块已嵌入', txt.includes('客户合意性 × 企业可实施性'));
ok('引用 Work 3 只读标识', txt.includes('引用 Work 3 · 只读'));
ok('排名表含「如何进入最优」', txt.includes('如何进入最优'));

// 导出 MD：排名表 + 五章重排（2026-09-01 结构决策）
const md = W5.exportMd();
ok('导出含「## 3 市场选择与定位」', md.includes('## 3 市场选择与定位'));
ok('导出含「### 3.5 STP」与定位段', md.includes('### 3.5 STP') && md.includes('#### 定位 P'));
ok('导出含排名表头', md.includes('| # | 卖点 | 合意性 | 可实施性'));
ok('导出含「如何进入最优」列', md.includes('如何进入最优'));
ok('导出含「## 5 总结与展望」', md.includes('## 5 总结与展望'));
ok('导出不再含封面/摘要/参考文献', !md.includes('参考文献') && !md.includes('## 摘要'));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
