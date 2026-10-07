/* Node test: W5 长文档排版（2026-09-01 wayfinder T01）。
   禁斜体 + 全局按钮类 + 章节间距 token + pre-wrap + 响应式断点。
   Run: node tests/work5_layout.test.js
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
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], attrs: {}, style: {}, className: '', dataset:{},
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(){}, setAttribute(k,v){ this.attrs[k]=String(v); },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    set innerHTML(v){ this._innerHTML=String(v); this.children=[]; },
    get innerHTML(){ return this._innerHTML||''; }
  };
}
function collectText(n){
  if(n.nodeType===3) return String(n.text||'');
  let out=n._innerHTML||'';
  for(const c of (n.children||[])) out+=collectText(c);
  return out;
}
function collectClasses(n, out=[]){
  if(n.className) out.push(n.className);
  for(const c of (n.children||[])) collectClasses(c, out);
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
      else if(k==='style' && typeof v==='object') Object.assign(e.style, v);
      else if(v==null) continue;
      else e.setAttribute(k,v);
    }
    for(const c of children.flat()){ if(c==null||c===false) continue; e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c); }
    return e;
  },
  esc: s => String(s??''),
  uid: p => 'id_'+Math.random().toString(36).slice(2,9),
  autosave(){}, showToast(){}, confirm: () => true,
  state: null,
  Work1: { steps:[{id:'a'}], mvo:{ a:()=>({checks:[]}) } },
  Work2: {
    steps:[{id:'x'}], mvo:{ x:()=>({checks:[]}) },
    computeMatrix: () => [{id:'m1',name:'印尼',x:8,y:9}],
    setTier1(){}
  },
  Work3: {
    steps:[{id:'y'}], mvo:{ y:()=>({checks:[]}) },
    computeMatrix: () => [],
    effectiveCuts: () => ({xCut:7,yCut:7}),
    isInSector: () => true,
    entrySuggestion: () => ({text:''}),
    scenarioName: () => ''
  },
  Work4: { steps:[{id:'z'}], mvo:{ z:()=>({checks:[]}) } },
  Work5: {}, App: { goWork(){} }, Runner: {}, API: {}, UI: { mountMvo(){}, mountMark(){}, mountGuard(){ return true; }, demoNote(){ return null; } },
  AiContext: { buildPrompt: () => [] },
  renderMatrix(opts){ opts.container.innerHTML='<svg/>'; }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'workshop5.js'), 'utf8'), sandbox, {filename:'workshop5.js'});
const W5 = sandbox.Work5;

// 1. CSS：禁斜体、收紧间距、pre-wrap、响应式
const css = fs.readFileSync(path.join(root, 'workshop5-editorial.css'), 'utf8');
ok('CSS 不再声明 font-style: italic', !css.includes('font-style: italic'));
ok('CSS 含禁斜体覆盖（font-style: normal）', css.includes('font-style: normal'));
ok('CSS 章节间距收紧到 space-md', css.includes('padding: var(--space-md) 0;'));
ok('CSS 中和全局 chapter 的 96px 底部留白', css.includes('#steps5 .chapter { margin: 0; padding: var(--space-md) 0;'));
ok('CSS 中和全局 chapter-head 的 ink 下划线', css.includes('#steps5 .chapter-head { margin-bottom: var(--space-md); padding-bottom: 0; border-bottom: none;'));
ok('CSS 不再使用 space-2xl 大空', !css.includes('space-2xl'));
ok('CSS 正文 pre-wrap + 断行', css.includes('white-space: pre-wrap') && css.includes('overflow-wrap: anywhere'));
ok('CSS 含 900/640 两档响应式', css.includes('max-width: 900px') && css.includes('max-width: 640px'));
ok('W5 裸段落不受全局 p 62ch 限制（价值链定位自适应）', css.includes('#steps5 p { margin: .7em 0; max-width: none; }'));

// 2. 渲染：按钮走全局类（ghost/primary），无 .btn 残留
sandbox.state = {
  work1: { sbu:{name:'豆芽'}, environment:{}, personas:[], values:{}, analysis:{} },
  work2: { matrix:{xCut:7,yCut:7}, markets:[{id:'m1',name:'印尼'}], decision:{tier1:{marketId:'m1'}} },
  work3: { matrix:{showSector:true,sectorWidth:1.5}, candidates:[], proposition:{}, identity:{} },
  work4: {},
  work5: W5.defaultData()
};
const sec = makeNode('section');
document.querySelector = sel => sel.includes('data-step="plan"') ? sec : null;
W5.renderStep('plan');
const classes = collectClasses(sec);
ok('渲染用全局 ghost 类', classes.some(c => String(c).split(' ').includes('ghost')));
ok('渲染用全局 primary 类', classes.some(c => String(c).split(' ').includes('primary')));
ok('渲染无 .btn 自定义类残留', !classes.some(c => String(c).split(' ').includes('btn')));
const txt = collectText(sec);
ok('渲染含成稿检查面板', txt.includes('成稿检查'));
ok('渲染含「去 Work 」来源回链', txt.includes('去 Work '));
ok('眉标全删（无 CHAPTER / Global Brand Workshop / V / 01）',
  !txt.includes('CHAPTER') && !txt.includes('Global Brand Workshop') && !txt.includes('V / '));
ok('国标编号章节标题（1 业务与市场 / 1.1 小节）',
  txt.includes('1 业务与市场') && txt.includes('1.1 企业与业务概况'));

// 3. 局部 rerender id 映射到唯一 plan 容器（cover/refs/ch2 不再静默失效）
sec.dataset.rendered='1';
document.querySelector = () => sec;
W5.rerender('cover');
ok('rerender("cover") 重渲染唯一 plan 容器', sec.dataset.rendered==='0');

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
