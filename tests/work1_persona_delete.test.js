/* Node test: 画像增删必须走 rerender（2026-09-11 修「新增的画像无法删除」）。

   事故：画像卡的「删除」与「+ 添加画像」调的是 Work1.renderStep('personas')，
   而 renderStep 有 RENDER_VERSION 守卫——已渲染的步只走 refreshDynamic，
   而 Work1.refreshDynamic 只认 'survey'（进度条）→ 界面纹丝不动。
   更糟的是数据已经改了并 autosave 标脏：删除在状态里生效、界面上卡片还在，
   用户以为失效连点，连点期间状态与界面彻底错位；下次保存把"看不见的删除"落盘。
   同屏的「删除场景 / + 添加场景」一直用 rerender，所以只有画像这两个按钮坏。

   共识：结构性增删一律 rerender；删除画像前 confirm 报出连带影响
   （几个场景取消勾选、几份答卷失去指向、编号重排），并同步清掉场景里的悬空 personaId。

   Run: node tests/work1_persona_delete.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

function makeNode(tag, attrs){
  const n = {
    tag, attrs: attrs || {}, children: [], handlers: {}, dataset: {},
    style: Object.assign({}, (attrs && typeof attrs.style === 'object') ? attrs.style : {}),
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(c){ if(c != null) this.children.push(c); return c; },
    addEventListener(t, fn){ this.handlers[t] = fn; return this; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    setAttribute(k, v){ this.attrs[k] = v; },
    removeAttribute(k){ delete this.attrs[k]; },
    set innerHTML(v){ this._html = v; this.children = []; },
    get innerHTML(){ return this._html || ''; },
    set textContent(v){ this._text = v; this.children = []; },
    get textContent(){
      if(this._text != null) return this._text;
      return (this.children || []).map(c => (c.tag === '#text' ? c.text : c.textContent) || '').join('');
    }
  };
  return n;
}
const el = (tag, attrs = {}, ...children) => {
  const e = makeNode(tag, attrs);
  for(const [k, v] of Object.entries(attrs || {})){
    if(k === 'class') e.className = v;
    else if(k === 'html') e.innerHTML = v;
    else if(k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if(k === 'style'){ if(typeof v === 'object') Object.assign(e.style, v); else e.style.cssText = v; }
    else if(typeof v === 'boolean'){ if(v) e.setAttribute(k, ''); else e.removeAttribute(k); }
    else if(v == null) continue;
    else e.setAttribute(k, v);
  }
  for(const c of children.flat()){
    if(c == null || c === false) continue;
    e.appendChild(typeof c === 'string' || typeof c === 'number' ? { tag:'#text', text:String(c), children:[] } : c);
  }
  return e;
};
const walk = (n, out = []) => {
  if(!n || typeof n !== 'object') return out;
  out.push(n);
  (n.children || []).forEach(c => walk(c, out));
  return out;
};
const buttons = (root, label) => walk(root).filter(n => n.tag === 'button' && (n.children[0] || {}).text === label);

const toasts = [];
const confirmMsgs = [];
let confirmAnswer = true;
let dirtyCount = 0;
const rerenderCalls = [];
const renderStepCalls = [];

// UI.tagsInput 桩：personaCard 会 querySelector('input') 并挂 blur
function tagsInputStub(arr){
  const input = makeNode('input');
  const wrap = makeNode('div');
  wrap.appendChild(input);
  wrap.querySelector = () => input;
  return { el: wrap, get: () => (arr || []).slice() };
}

const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise,
  el,
  document: {
    createElement: makeNode,
    createTextNode: t => ({ tag:'#text', text:String(t), children:[] }),
    body: { dataset:{} },
    querySelector: () => null,
    querySelectorAll: () => []
  },
  uid: (p='id') => p + '_' + Math.random().toString(36).slice(2, 9),
  mean: a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0,
  median: a => { if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  sd: a => 0,
  clamp: (v,lo,hi) => Math.max(lo, Math.min(hi, v)),
  autosave: () => { dirtyCount++; },
  showToast: m => toasts.push(m),
  confirm: m => { confirmMsgs.push(m); return confirmAnswer; },
  renderBarChart: () => {},
  API: { aiButton: () => {}, aiCtxBox: () => ({ box: makeNode('div') }), aiPipeline: () => {} },
  Runner: { start: () => null, renderUI(){}, finish(){}, checkpoint: () => Promise.resolve() },
  UI: { tagsInput: tagsInputStub, field: (label, node) => el('div', {}, el('label', {}, label), node),
        mountGuard: () => true, mountMvo(){}, mountMark(){} },
  state: null,
  Work1: {}, App: {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'interaction.js'});
sandbox.Interaction.confirm = async ({message}) => { confirmMsgs.push(message); return confirmAnswer; };
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop1.js'), 'utf8'), sandbox, {filename:'workshop1.js'});
const W1 = sandbox.Work1;
// 打桩重绘入口：断言结构性增删走的是 rerender 而不是被守卫吞掉的 renderStep
W1.rerender = id => { rerenderCalls.push(id); };
W1.renderStep = id => { renderStepCalls.push(id); };

(async()=>{
/* ---- state：2 个画像；场景关联第 2 个；调研有第 2 个的答卷 ---- */
const p1 = { id:'p_a', name:'', gender:'', age:'', occupation:'医生', income:'', region:'', values:['a'], painPoints:'痛1', channels:[], quote:'引1', traits:'' };
const p2 = { id:'p_b', name:'', gender:'', age:'', occupation:'工程师', income:'', region:'', values:[], painPoints:'痛2', channels:[], quote:'引2', traits:'' };
sandbox.state = {
  work1: {
    personas: [p1, p2],
    scenarios: [{ id:'sc1', name:'自用购买', personaIds:['p_b'], benefits:{}, costs:{}, anchor:'', decisiveGap:'' }],
    survey: { responses: [{ personaId:'p_b', answers:[] }, { personaId:'p_b', answers:[] }], n:2, status:'done' }
  }
};

const plate = makeNode('div', { class: 'plate' });
const sec = { querySelector: s => (s === '.plate' ? plate : null) };
let threw = null;
try { W1.render.personas(sec); } catch(e){ threw = e; }
ok('render.personas 不抛异常', !threw, threw && threw.stack);

const delBtns = buttons(plate, '删除');
ok('每个画像一张删除按钮', delBtns.length === 2, 'got ' + delBtns.length);
const addBtn = buttons(plate, '+ 添加画像')[0];
ok('有「+ 添加画像」按钮', !!addBtn);

/* ---- 取消删除：什么都不动 ---- */
confirmAnswer = false; confirmMsgs.length = 0; rerenderCalls.length = 0; renderStepCalls.length = 0;
await delBtns[1].handlers.click({currentTarget:delBtns[1]});
ok('取消 → 画像不被删', sandbox.state.work1.personas.length === 2);
ok('取消 → 场景关联不被清', sandbox.state.work1.scenarios[0].personaIds.join() === 'p_b');
ok('取消 → 不触发重绘', rerenderCalls.length === 0 && renderStepCalls.length === 0);
ok('确认框报出场景连带', /1 个 Work1 场景会取消对它的关联勾选/.test(confirmMsgs[0] || ''), confirmMsgs[0]);
ok('确认框报出答卷连带', /2 份调研答卷会失去画像指向/.test(confirmMsgs[0] || ''), confirmMsgs[0]);
ok('确认框提示编号重排', /编号会重排/.test(confirmMsgs[0] || ''), confirmMsgs[0]);

/* ---- 确认删除：状态 + 场景引用 + 重绘三者一致 ---- */
confirmAnswer = true; confirmMsgs.length = 0;
await delBtns[1].handlers.click({currentTarget:delBtns[1]});
ok('确认 → 画像从 state 移除', sandbox.state.work1.personas.length === 1 && sandbox.state.work1.personas[0].id === 'p_a');
ok('确认 → 场景里的悬空 personaId 被清', sandbox.state.work1.scenarios[0].personaIds.length === 0);
ok('确认 → 历史答卷保留但 personaId 清空', sandbox.state.work1.survey.responses.length === 2 && sandbox.state.work1.survey.responses.every(r=>r.personaId==null));
ok('确认 → 走 rerender（界面真的会重建）', rerenderCalls.join() === 'personas', JSON.stringify(rerenderCalls));
ok('确认 → 不走被守卫吞掉的 renderStep', renderStepCalls.length === 0, JSON.stringify(renderStepCalls));
ok('删除标脏（autosave 被调）', dirtyCount > 0);

/* ---- 添加画像：同样必须 rerender；重新挂载模拟真实页面结构更新。 ---- */
rerenderCalls.length = 0; renderStepCalls.length = 0;
const plate1b = makeNode('div', { class: 'plate' });
W1.render.personas({ querySelector: s => (s === '.plate' ? plate1b : null) });
buttons(plate1b, '+ 添加画像')[0].handlers.click();
ok('添加 → state 多一个画像', sandbox.state.work1.personas.length === 2, 'got ' + sandbox.state.work1.personas.length);
ok('添加 → 走 rerender 而不是 renderStep', rerenderCalls.join() === 'personas' && renderStepCalls.length === 0,
  'rerender=' + JSON.stringify(rerenderCalls) + ' renderStep=' + JSON.stringify(renderStepCalls));

/* ---- 无连带时确认框明确零数量及编号重排 ---- */
confirmMsgs.length = 0; confirmAnswer = false;
const lone = sandbox.state.work1.personas[1];
const plate2 = makeNode('div', { class: 'plate' });
W1.render.personas({ querySelector: s => (s === '.plate' ? plate2 : null) });
const loneButton=buttons(plate2, '删除')[1];
await loneButton.handlers.click({currentTarget:loneButton});
ok('无场景/答卷连带 → 确认框明确零数量和编号重排',
  /0 个 Work1 场景/.test(confirmMsgs[0] || '') && /0 份调研答卷/.test(confirmMsgs[0] || '') && /编号会重排/.test(confirmMsgs[0] || ''),
  confirmMsgs[0]);
ok('lone 画像未被误删', sandbox.state.work1.personas.includes(lone));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})().catch(e=>{console.error(e);process.exit(1);});
