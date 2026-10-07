/* Node test: W5 来源条回链 + 细分来源修正 + 证据缺失入口（2026-09-01 wayfinder T07）。
   Run: node tests/work5_source_links.test.js
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
  return {
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], attrs: {}, className: '',
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(){}, setAttribute(k,v){ this.attrs[k]=String(v); },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    set innerHTML(v){ this._innerHTML=String(v); this.children=[]; },
    get innerHTML(){ return this._innerHTML||''; }
  };
}
function collectText(n){
  if(!n) return '';
  if(n.nodeType===3) return String(n.text||'');
  let out=n._innerHTML||'';
  for(const c of (n.children||[])) out+=collectText(c);
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
    const e=document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k==='class') e.className=v;
      else if(k.startsWith('on') && typeof v==='function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k,v);
    }
    for(const c of children.flat()){ if(c==null||c===false) continue; e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c); }
    return e;
  },
  esc: s => String(s??''),
  uid: p => 'id_'+Math.random().toString(36).slice(2,9),
  autosave(){}, showToast(){}, confirm: () => true,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, Work4: {}, Work5: {}, App: { goWork(){} }, Runner: {}, API: {}, UI: { mountMvo(){}, mountMark(){}, mountGuard(){ return true; }, demoNote(){ return null; } },
  AiContext: { buildPrompt: () => [] },
  renderMatrix(){}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'workshop5.js'), 'utf8'), sandbox, {filename:'workshop5.js'});
const W5 = sandbox.Work5;

// 1. 来源条可回链
sandbox.state = { work5: { lastAggregated: '2026-09-01T12:00:00.000Z' } };
{
  const bar = W5.provenance(2, '市场矩阵');
  ok('provenance 返回 .provenance-bar', bar.className.indexOf('provenance-bar') >= 0);
  const txt = collectText(bar);
  ok('来源条含「去 Work 」回链', txt.includes('去 Work ') && txt.includes('来自 Work 2'));
  ok('来源条含同步时间', txt.includes('同步 '));
  const outlook = W5.provenance('1–5', '各章汇总');
  ok('非数字来源（1–5）不加回链', !collectText(outlook).includes('去 Work '));
}

// 2. 细分来源 = Work3 场景细分（selected 优先），空场景回退 Work1 画像
sandbox.state = {
  work1: { personas: [{ name:'妈妈A', age:'30', occupation:'白领', region:'上海', painPoints:'怕买错' }] },
  work3: {
    scenarios: [
      { name:'新手妈妈', description:'第一次当妈的年轻女性', selected:true },
      { name:'二胎家庭', description:'已有养育经验的家庭', selected:false }
    ],
    proposition: { chosenValueText:'成分透明', positioningStatement:'面向新手妈妈' },
    identity: {}
  },
  work5: W5.defaultData()
};
{
  const pos = W5.composePositioning();
  ok('细分来自场景且 selected 优先', pos.segmentation.startsWith('· 新手妈妈') && pos.segmentation.includes('· 二胎家庭'));
  ok('细分不再用 Work1 画像', !pos.segmentation.includes('妈妈A'));
  ok('定位字段单换行（P 区不出现空行，2026-09-01 用户反馈）', (pos.positioning.match(/\n\n/g)||[]).length === 0);
}
sandbox.state.work3.scenarios = [];
{
  const pos = W5.composePositioning();
  ok('无场景时回退画像', pos.segmentation.includes('妈妈A'));
}

// 3. 证据缺失入口准确导航到对应步骤。
sandbox.state = {
  work2: { matrix:{}, markets:[] },
  work3: { candidates:[] },
  work5: W5.defaultData()
};
{
  const c1 = makeNode('div');
  W5.marketMatrixBlock(c1);
  ok('Work2 缺失提示提供目标市场评分入口', collectText(c1).includes('去目标市场评分修改'));
  const c2 = makeNode('div');
  W5.sellingPointBlock(c2);
  ok('Work3 缺失提示提供卖点评分与矩阵入口', collectText(c2).includes('去卖点评分与矩阵修改'));
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
