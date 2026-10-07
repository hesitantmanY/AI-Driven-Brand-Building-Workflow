/* Node test: Work 3 卖点挖掘渲染路径（语料双来源 UI，2026-08-29 共识）。
   用轻量 DOM 桩真实执行 Work3.render.mining，验证生成按钮/构成/勾选框/badge 渲染。
   Run: node tests/work3_render_mining.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'docs');

function makeNode(tag){
  const node = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children: [],
    attrs: {},
    style: {},
    className: '',
    parentNode: null,
    _listeners: {},
    appendChild(c){ this.children.push(c); c.parentNode = this; return c; },
    addEventListener(t, fn){ (this._listeners[t] = this._listeners[t] || []).push(fn); },
    setAttribute(k, v){ this.attrs[k] = String(v); if(k==='checked') this._checked = true; },
    removeAttribute(k){ delete this.attrs[k]; if(k==='checked') this._checked = false; },
    querySelector(){ return null; }
  };
  let _tc = null;
  Object.defineProperty(node, 'textContent', {
    get(){ return _tc !== null ? _tc : collectText(this); },
    set(v){ _tc = String(v); }
  });
  return node;
}
function collectText(n){
  if(n.nodeType === 3) return String(n.text);
  return (n.children||[]).map(collectText).join('');
}

const document = {
  createElement: (t) => makeNode(t),
  createTextNode: (s) => ({ nodeType:3, text:String(s), children:[] }),
  getElementById: () => null,
  querySelector: () => null
};

const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document,
  el: function(tag, attrs={}, ...children){
    const e = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs)){
      if(k==='class') e.className=v;
      else if(k==='html') e.innerHTML=v;
      else if(k.startsWith('on') && typeof v==='function') e.addEventListener(k.slice(2), v);
      else if(k==='style'){
        if(typeof v==='object') Object.assign(e.style, v);
        else if(typeof v==='string') e.style.cssText=v;
      } else if(typeof v==='boolean'){
        if(v) e.setAttribute(k, ''); else e.removeAttribute(k);
      }
      else e.setAttribute(k, v);
    }
    for(const c of children.flat()){
      if(c==null||c===false) continue;
      e.appendChild(typeof c==='string'||typeof c==='number' ? document.createTextNode(c) : c);
    }
    return e;
  },
  esc: s => String(s??''),
  uid: (p='id') => p + '_' + Math.random().toString(36).slice(2, 9),
  mean: a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0,
  median: a => { if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  sd: a => 0,
  clamp: (v,lo,hi) => Math.max(lo, Math.min(hi, v)),
  autosave: () => {},
  showToast: () => {},
  confirm: () => true,
  renderMatrix: () => {},
  backendOnline: false,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, App: {}, Runner: {}, API: {},
  UI: { field: (label, input) => ({ tag:'label', children:[label, input] }), tagsInput: (arr) => { const root=document.createElement('div'); const inp=document.createElement('input'); root.appendChild(inp); root.querySelector=(s)=>s==='input'?inp:null; return { el: root, get: ()=>arr }; } },
  AiContext: {
    mountSettings: (container, cfg) => ({ current: () => ({ sections: (cfg.needs||[]).slice(), fewShot: cfg.fewShotKey||null }), reset(){}, })
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
vm.runInContext(fs.readFileSync(path.join(root, 'workshop2.js'), 'utf8'), sandbox, {filename:'workshop2.js'});
vm.runInContext(fs.readFileSync(path.join(root, 'workshop3.js'), 'utf8'), sandbox, {filename:'workshop3.js'});
const W3 = sandbox.Work3;
// candidates 步需要 API.aiCtxBox 返回 {box}
sandbox.API = { aiCtxBox: (cfg) => {  const box=sandbox.el('div');  const btn=sandbox.el('button',{},cfg.label||'');  box.appendChild(btn);  return { box, current:()=>({sections:(cfg.needs||[]).slice(),fewShot:cfg.fewShotKey||null}) };} };

let pass=0, fail=0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail? ' — ' + detail : '')); }
}

function freshState(){
  return {
    settings: { manualMode: false },
    work1: { sbu: { name:'SBU' }, analysis: { openThemes: [] }, personas: [], values: {} },
    work2: {},
    work3: W3.defaultData()
  };
}
function renderMining(st){
  sandbox.state = st;
  const sec = sandbox.el('section');
  const plate = sandbox.el('div',{class:'plate'});
  sec.querySelector = () => plate;
  W3.render.mining(sec);
  return collectText(plate);
}
function findNode(n, pred){
  if(pred(n)) return n;
  for(const c of (n.children||[])){
    const r=findNode(c,pred);
    if(r) return r;
  }
  return null;
}

// ---- 零/低真实语料：提示 + 生成按钮 ----
{
  const st = freshState();
  const txt = renderMining(st);
  ok('render: 实际纳入 <3 时显示补足提示', txt.includes('共 0 条，不足 3 条'));
  ok('render: 显示生成模拟语料按钮', txt.includes('生成模拟语料（基于画像）'));
  ok('render: 负面反馈勾选框默认显示', txt.includes('语料包含负面反馈/抱怨'));
  ok('render: 无语料时不显示模拟语料卡', !txt.includes('模拟语料（画像生成'));
}

// ---- 有模拟语料：构成显示 + 卡片 + 勾选框 + 清空 ----
{
  const st = freshState();
  st.work3.mining.documents = ['真实1','真实2','真实3'];
  st.work3.mining.simulatedDocuments = ['模拟1','模拟2','模拟3'];
  const txt = renderMining(st);
  ok('render: 语料卡显示本地库存构成 真实3+模拟3', txt.includes('本地真实 3 条 + 模拟 3 条'));
  ok('render: 模拟语料卡标题', txt.includes('模拟语料（画像生成 3 条）'));
  ok('render: 「模拟」tag', txt.includes('模拟'));
  ok('render: 包含勾选文案', txt.includes('建模时包含模拟语料'));
  ok('render: 包含清空按钮', txt.includes('清空'));
}

// ---- LDA 结果区 badge（模拟建模 + 含模拟语料） ----
{
  const st = freshState();
  st.work3.mining.documents = ['真实1','真实2','真实3'];
  st.work3.mining.simulatedDocuments = ['模拟1','模拟2','模拟3'];
  st.work3.mining.stats = { raw_count:6, valid_count:6, total_words:12, vocab_size:6, coherence:0.5 };
  st.work3.mining.wordFreqTop = [];
  st.work3.mining.topics = [{ id:0, label:'主题A', share:100, keywords:[{word:'x',weight:0.1}], representative_docs:[] }];
  st.work3.mining._simulated = true;
  st.work3.mining.corpusComposition = { real:3, simulated:3, total:6 };
  const txt = renderMining(st);
  ok('render: LDA 结果区显示「模拟建模（LLM）」', txt.includes('模拟建模（LLM）'));
  ok('render: LDA 结果区显示「含模拟语料 3 条」', txt.includes('含模拟语料 3 条'));
}

// ---- 备选卖点：痛点关联（painId + 自定义）+ 证据引导 ----
{
  const st = freshState();
  st.work3.mining.painMap = [
    { id:'pa1', pain:'新牌子不敢试，需要信任锚点', evidence:'我买豆芽是看老客评论多，新牌子不敢试', frequency:'高', linkedNeeds:[], type:'痛点', scenarioId:'' }
  ];
  st.work3.candidates = [
    { id:'c1', name:'老客背书', pain:'新牌子不敢试', painId:'pa1', description:'老客评价背书', evidence:'', source:'ai', scenarioId:'', selected:false, desirabilityScores:{}, extraDims:{} },
    { id:'c2', name:'医生解读', pain:'全新的信任门槛', painId:'', description:'d', evidence:'', source:'user', scenarioId:'', selected:false, desirabilityScores:{}, extraDims:{} }
  ];
  sandbox.state = st;
  const sec = sandbox.el('section');
  const plate = sandbox.el('div',{class:'plate'});
  sec.querySelector = () => plate;
  W3.render.candidates(sec);
  const txt = collectText(plate);
  ok('cand: 显示证据引导 hint', txt.includes('支撑证据') && txt.includes('内部策略，无评论'));
  ok('cand: 痛点下拉含痛点条目', txt.includes('新牌子不敢试，需要信任锚点'));
  const sel = findNode(plate, n=>n.tagName==='SELECT');
  const selOpt = sel && sel.children.find(o=>o.tagName==='OPTION' && collectText(o).includes('新牌子不敢试'));
  ok('cand: 关联痛点的选项被选中', !!(selOpt && selOpt.selected === true));
  const customInput = findNode(plate, n=>n.tagName==='INPUT' && n.attrs && n.attrs.value==='全新的信任门槛');
  ok('cand: 自定义痛点显示输入框', !!customInput);
}

// ---- 评分与矩阵：persona 子分只读显示 + MVO 判分 ----
{
  const st = freshState();
  st.work3.mining.painMap = [];
  st.work3.context.hasSurvey = true;
  st.work3.context.personas = [{ id:'p1', name:'小明', painPoints:'痛', values:[], quote:'', region:'' }];
  st.work3.candidates = [
    { id:'c1', name:'成分透明配方', pain:'成分焦虑', painId:'', description:'d', evidence:'e', source:'ai', scenarioId:'', selected:false,
      desirabilityScores:{ p1:{importance:9, uniqueness:8, credibility:9} }, desirabilitySource:'personas', extraDims:{} },
    { id:'c2', name:'医生背书', pain:'信任门槛', painId:'', description:'d', evidence:'e', source:'user', scenarioId:'', selected:false,
      desirabilityScores:{}, extraDims:{} }
  ];
  sandbox.state = st;
  const snapshot=JSON.stringify(st.work3.candidates);
  ok('matrix: 原始维度列为空', st.work3.candidates[0].importance == null);
  ok('matrix: 聚合视图显示 importance 均值且不回写', W3.ensureDesirabilityAggregates()[0].importance===9 && JSON.stringify(st.work3.candidates)===snapshot);
  ok('matrix: 重复求值稳定且不回写', W3.ensureDesirabilityAggregates()[0].importance===9 && JSON.stringify(st.work3.candidates)===snapshot);
  const checks = W3.mvo.matrix().checks;
  ok('matrix MVO: 缺可实施性时不通过', checks[0].test()===false);
  st.work3.candidates.forEach(c=>{ c.feasibility=8; c.communicability=8; c.sustainability=8; });
  ok('matrix MVO: c2 缺合意性仍不通过', checks[0].test()===false);
  st.work3.candidates[1].desirabilityScores = { p1:{importance:7, uniqueness:7, credibility:8} };
  ok('matrix MVO: 全部有分 → 通过（下一步 CTA 出现）', checks[0].test()===true);
  // 渲染：维度列显示只读求值，逐 persona 子分显示均值
  const sec = sandbox.el('section');
  const plate = sandbox.el('div',{class:'plate'});
  sec.querySelector = () => plate;
  W3.render.matrix(sec);
  const txt = collectText(plate);
  ok('matrix render: 逐 persona 子分显示均值 小明:8.7', !!findNode(plate, n=>n.textContent && n.textContent.includes('小明:8.7')));
  const val9 = findNode(plate, n=>n.tagName==='INPUT' && n.attrs && n.attrs.value==='9');
  ok('matrix render: 重要性列显示均值 9 且原字段仍空', !!val9 && st.work3.candidates[0].importance==null);
}

// ---- 主张与定位：入选卖点拖拽排序（draggable 必须是字符串 'true'） ----
{
  const st = freshState();
  st.work3.candidates = [
    { id:'c1', name:'成分透明配方', pain:'成分焦虑', painId:'', description:'成分表+检测报告', evidence:'e', source:'ai', scenarioId:'', selected:false, desirabilityScores:{}, extraDims:{} },
    { id:'c2', name:'儿科医生背书', pain:'信任门槛', painId:'', description:'医生推荐', evidence:'e', source:'ai', scenarioId:'', selected:true, desirabilityScores:{}, extraDims:{} }
  ];
  st.work3.proposition.coreValueIds = ['c1','c2'];
  sandbox.state = st;
  const sec = sandbox.el('section');
  const plate = sandbox.el('div',{class:'plate'});
  sec.querySelector = () => plate;
  W3.render.proposition(sec);
  const dragCards = [];
  (function walk(n){ if(n.tagName==='DIV' && n.attrs && n.attrs.draggable!==undefined) dragCards.push(n); for(const c of (n.children||[])) walk(c); })(plate);
  ok('prop: 入选卖点卡片有 draggable 且值为 "true"', dragCards.length===2 && dragCards.every(c=>c.attrs.draggable==='true'));
}

// ---- 主张与定位：已生成 → 按钮变「重新生成」，未生成 → 原文案 ----
{
  const st = freshState();
  st.work3.candidates = [
    { id:'c1', name:'卖点1', pain:'痛1', painId:'', description:'d', evidence:'e', source:'ai', scenarioId:'', selected:false, desirabilityScores:{}, extraDims:{} }
  ];
  st.work3.proposition.coreValueIds = ['c1'];
  st.work3.proposition.alternatives = [{ id:'a1', text:'为城市通勤家庭提供快充高性价比纯电小车' }];
  sandbox.state = st;
  const renderProp = ()=>{
    const sec = sandbox.el('section');
    const plate = sandbox.el('div',{class:'plate'});
    sec.querySelector = () => plate;
    W3.render.proposition(sec);
    return collectText(plate);
  };
  ok('prop: 已生成 → 按钮为「重新生成主张与定位」', renderProp().includes('重新生成主张与定位'));
  st.work3.proposition.alternatives = [];
  ok('prop: 未生成 → 按钮为「AI 起草主张与定位」', renderProp().includes('AI 起草主张与定位'));
}

// ---- 拖拽排序：显示顺序必须按 coreValueIds，drop 后立即反映 ----
{
  const st = freshState();
  st.work3.candidates = [
    { id:'c1', name:'卖点1', pain:'痛1', painId:'', description:'d', evidence:'e', source:'ai', scenarioId:'', selected:false, desirabilityScores:{}, extraDims:{} },
    { id:'c2', name:'卖点2', pain:'痛2', painId:'', description:'d', evidence:'e', source:'ai', scenarioId:'', selected:false, desirabilityScores:{}, extraDims:{} },
    { id:'c3', name:'卖点3', pain:'痛3', painId:'', description:'d', evidence:'e', source:'ai', scenarioId:'', selected:true, desirabilityScores:{}, extraDims:{} }
  ];
  st.work3.proposition.coreValueIds = ['c3','c1','c2'];
  sandbox.state = st;
  const render = ()=>{
    const sec = sandbox.el('section');
    const plate = sandbox.el('div',{class:'plate'});
    sec.querySelector = () => plate;
    W3.render.proposition(sec);
    return collectText(plate);
  };
  const t1 = render();
  ok('prop order: 显示顺序按 coreValueIds（卖点3 在 卖点1 前）',
    t1.indexOf('卖点3') < t1.indexOf('卖点1') && t1.indexOf('卖点1') < t1.indexOf('卖点2'));
  // 模拟把 卖点3 拖到 卖点2 上
  const sec = sandbox.el('section');
  const plate = sandbox.el('div',{class:'plate'});
  sec.querySelector = () => plate;
  W3.render.proposition(sec);
  let dropFn = null;
  (function walk(n){
    if(n._listeners && n._listeners.drop && collectText(n).includes('卖点2')) dropFn = n._listeners.drop[0];
    for(const c of (n.children||[])) walk(c);
  })(plate);
  ok('prop drop: 找到目标卡片', !!dropFn);
  if(dropFn) dropFn({ preventDefault(){}, dataTransfer:{ getData:()=> 'c3' } });
  ok('prop drop: coreValueIds 重排为 卖点1,卖点3,卖点2',
    JSON.stringify(st.work3.proposition.coreValueIds) === JSON.stringify(['c1','c3','c2']));
}



// ---- W3 重新生成文案（已生成 → 按钮变 重新生成）----
{
  // pain
  const st=freshState();
  st.work3._painMapGenerated=true;
  st.work3.mining.painMap=[{id:'p1',pain:'痛',evidence:'e',frequency:'高',linkedNeeds:[],type:'痛点',scenarioId:''}];
  st.work3.context.personas=[];
  sandbox.state=st;
  const sec=sandbox.el('section');const plate=sandbox.el('div',{class:'plate'});sec.querySelector=()=>plate;
  W3.render.mining(sec);
  ok('pain: 已生成 → 按钮为「重新生成痛点地图」', collectText(plate).includes('重新生成痛点地图'));
  // candidates
  st.work3.candidates=[{id:'c1',name:'卖点',pain:'',painId:'',description:'',evidence:'',source:'user',scenarioId:'',selected:false,desirabilityScores:{},extraDims:{}}];
  const sec2=sandbox.el('section');const plate2=sandbox.el('div',{class:'plate'});sec2.querySelector=()=>plate2;
  W3.render.candidates(sec2);
  ok('cand: 已生成 → 按钮为「重新生成备选卖点」', collectText(plate2).includes('重新生成备选卖点'));
  // matrix
  st.work3.candidates[0].importance=8;st.work3.candidates[0].feasibility=8;
  const sec3=sandbox.el('section');const plate3=sandbox.el('div',{class:'plate'});sec3.querySelector=()=>plate3;
  W3.render.matrix(sec3);
  ok('matrix: 已评分 → 按钮为「重新生成双维评分」', collectText(plate3).includes('重新生成双维评分'));
  // identity
  st.work3.identity.sloganOptions=['s1'];
  const sec4=sandbox.el('section');const plate4=sandbox.el('div',{class:'plate'});sec4.querySelector=()=>plate4;
  W3.render.identity(sec4);
  ok('identity: 已生成 → 按钮为「重新生成人格与 Slogan」', collectText(plate4).includes('重新生成人格与 Slogan'));
  // 未生成 → 原文案
  const st2=freshState();
  sandbox.state=st2;
  const sec5=sandbox.el('section');const plate5=sandbox.el('div',{class:'plate'});sec5.querySelector=()=>plate5;
  W3.render.mining(sec5);
  ok('pain: 未生成 → 按钮为「AI 起草痛点地图」', collectText(plate5).includes('AI 起草痛点地图') && !collectText(plate5).includes('重新生成痛点地图'));
}

// ---- 手动数据不得提前把 AI 按钮切成“重新生成” ----
{
  const st=freshState();
  st.work3.scenarios=[{id:'s1',name:'手动场景',description:'手填',personaIds:[],needStrength:{pain:5,willingness:5,frequency:5},selected:false}];
  sandbox.state=st;
  let sec=sandbox.el('section'); let plate=sandbox.el('div',{class:'plate'}); sec.querySelector=()=>plate;
  W3.render.scenarios(sec);
  ok('scenario: 手动添加后仍为 AI 起草场景细分', collectText(plate).includes('AI 起草场景细分') && !collectText(plate).includes('重新生成场景细分'));
  st.work3._scenariosGenerated=true;
  sec=sandbox.el('section'); plate=sandbox.el('div',{class:'plate'}); sec.querySelector=()=>plate;
  W3.render.scenarios(sec);
  ok('scenario: AI 已生成后变重新生成场景细分', collectText(plate).includes('重新生成场景细分'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
