/* Work3 diagnostics: AI-button generated state and pipeline checkpoint contracts.
   Run: node tests/work3_diag_ai_pipeline.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0;
let fail = 0;
const toasts = [];
let confirmCalls = 0;
let uidSeq = 0;

function fmt(v){
  if(typeof v === 'string') return JSON.stringify(v);
  try{ return JSON.stringify(v); }catch(_){ return String(v); }
}
function ok(name, cond, detail=''){
  if(cond){ pass++; console.log('PASS ' + name + (detail ? ' — ' + detail : '')); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function eq(name, actual, expected){
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  ok(name, same, 'actual=' + fmt(actual) + ', expected=' + fmt(expected));
}

function classList(initial){
  const set = new Set(String(initial || '').split(/\s+/).filter(Boolean));
  return {
    add(...xs){ xs.forEach(x => set.add(x)); },
    remove(...xs){ xs.forEach(x => set.delete(x)); },
    toggle(x, force){
      const on = force === undefined ? !set.has(x) : !!force;
      if(on) set.add(x); else set.delete(x);
      return on;
    },
    contains(x){ return set.has(x); }
  };
}

function makeNode(tag, attrs={}){
  let ownText = null;
  const n = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children: [],
    attrs: {},
    style: {},
    className: attrs.class || '',
    classList: classList(attrs.class),
    parentNode: null,
    _listeners: {},
    disabled: !!attrs.disabled,
    value: attrs.value == null ? '' : String(attrs.value),
    checked: !!attrs.checked,
    appendChild(c){ n.children.push(c); c.parentNode = n; return c; },
    addEventListener(type, fn){ (n._listeners[type] = n._listeners[type] || []).push(fn); },
    removeEventListener(type, fn){ n._listeners[type] = (n._listeners[type] || []).filter(x => x !== fn); },
    setAttribute(k, v){ n.attrs[k] = String(v); if(k === 'checked') n.checked = true; if(k === 'disabled') n.disabled = true; },
    removeAttribute(k){ delete n.attrs[k]; if(k === 'checked') n.checked = false; if(k === 'disabled') n.disabled = false; },
    querySelector(sel){ return findDescendant(n, x => matches(x, sel)); },
    querySelectorAll(sel){ return walk(n).filter(x => matches(x, sel)); },
    contains(x){ return x === n || n.children.some(c => c.contains && c.contains(x)); },
    insertAdjacentElement(){},
    remove(){},
    set innerHTML(v){ n._html = String(v); n.children = []; ownText = null; },
    get innerHTML(){ return n._html || ''; }
  };
  Object.defineProperty(n, 'textContent', {
    get(){ return ownText !== null ? ownText : collectText(n); },
    set(v){ ownText = String(v); n.children = []; }
  });
  return n;
}

function matches(n, sel){
  if(!n || n.nodeType !== 1) return false;
  if(!sel) return true;
  if(sel.startsWith('.')) return n.classList.contains(sel.slice(1));
  return n.tagName === String(sel).toUpperCase();
}
function walk(n, out=[]){
  if(!n || typeof n !== 'object') return out;
  out.push(n);
  for(const c of (n.children || [])) walk(c, out);
  return out;
}
function findDescendant(n, pred){
  for(const c of (n.children || [])){
    if(pred(c)) return c;
    const r = findDescendant(c, pred);
    if(r) return r;
  }
  return null;
}
function collectText(n){
  if(n.nodeType === 3) return String(n.text);
  return (n.children || []).map(collectText).join('');
}
function textOf(n){ return collectText(n); }
function buttons(root, label){
  return walk(root).filter(n => n.tagName === 'BUTTON' && textOf(n) === label);
}
function buttonByRegex(root, re){
  return walk(root).find(n => n.tagName === 'BUTTON' && re.test(textOf(n))) || null;
}
function fireClick(node){
  const ev = {
    target: node,
    preventDefault(){},
    stopPropagation(){},
    stopImmediatePropagation(){}
  };
  const listeners = (node._listeners.click || []).slice();
  let result;
  for(const fn of listeners) result = fn(ev);
  return result;
}

function makeDocument(){
  return {
    createElement: t => makeNode(t),
    createTextNode: s => ({nodeType:3, text:String(s), children:[]}),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

const root = path.join(__dirname, '..', 'docs');
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise,
  document: makeDocument(),
  el(tag, attrs={}, ...children){
    const n = makeNode(tag, attrs || {});
    for(const [k, v] of Object.entries(attrs || {})){
      if(k === 'class') n.className = v;
      else if(k === 'html') n.innerHTML = v;
      else if(k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if(k === 'style'){
        if(typeof v === 'object') Object.assign(n.style, v);
        else n.style.cssText = String(v);
      } else if(typeof v === 'boolean'){
        if(v) n.setAttribute(k, ''); else n.removeAttribute(k);
      } else if(v != null) n.setAttribute(k, v);
    }
    for(const c of children.flat()){
      if(c == null || c === false) continue;
      n.appendChild(typeof c === 'object' ? c : makeDocument().createTextNode(c));
    }
    return n;
  },
  esc: s => String(s ?? ''),
  uid: p => String(p || 'id') + '_' + (++uidSeq),
  mean: a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
  median: a => {
    if(!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  },
  sd: () => 0,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  autosave(){},
  showToast: m => toasts.push(String(m)),
  confirm(){ confirmCalls++; return true; },
  renderBarChart(){},
  renderMatrix(){},
  backendOnline: false,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, Work4: {}, Work5: {},
  App: { updateSummary(){}, goWork(){}, goStep(){} },
  Runner: {},
  API: {},
  UI: {},
  AiContext: {
    buildPrompt: ({system='', instruction=''}) => [
      {role:'system', content:String(system)},
      {role:'user', content:String(instruction)}
    ],
    mountSettings: () => ({current: () => ({sections: [], fewShot: null})})
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
vm.runInContext(fs.readFileSync(path.join(root, 'lib', 'ui.js'), 'utf8'), sandbox, {filename:'ui.js'});
vm.runInContext(fs.readFileSync(path.join(root, 'workshop3.js'), 'utf8'), sandbox, {filename:'workshop3.js'});
const W3 = sandbox.Work3;

function resetRuntime(){
  toasts.length = 0;
  confirmCalls = 0;
  uidSeq = 0;
  W3.rerender = () => {};
  sandbox.API = {
    config: () => ({apiKey:'test-key'}),
    callJson: async () => ({}),
    aiCtxBox: cfg => {
      sandbox.lastAiCtx = cfg;
      const box = sandbox.el('div', {class:'ai-box'});
      box.appendChild(sandbox.el('button', {}, cfg.label || ''));
      return {box};
    },
    aiPipeline: opts => { sandbox.lastAiPipeline = opts; },
    manualBox(){},
    _manualPipeline(){}
  };
  sandbox.Runner = {
    current: null,
    events: [],
    start(opts){
      sandbox.Runner.events.push({type:'start', id:opts.id, total:opts.total});
      if(opts.button){ opts.button.disabled = true; opts.button.textContent='生成中…'; }
      sandbox.Runner.lastButton = opts.button || null;
      return sandbox.Runner.current={aborted:false, paused:false, done:0, controller:{signal:{tag:'test-signal'}}};
    },
    async checkpoint(){},
    finish(){
      sandbox.Runner.events.push({type:'finish'});
      if(sandbox.Runner.lastButton) sandbox.Runner.lastButton.disabled = false;
      sandbox.Runner.current=null;
    },
    tick(){},
    renderUI(){},
    signal(){ return {tag:'test-signal'}; }
  };
}

function freshState(){
  return {
    settings: {manualMode:false},
    meta: {},
    work1: {
      sbu: {name:'SBU', category:'品类'},
      analysis: {openThemes:[]},
      personas: [],
      values: {chosenFunctional:'', chosenEmotional:'', chosenSocial:''},
      scenarios: [],
      environment: {}
    },
    work2: {},
    work3: W3.defaultData()
  };
}
function candidate(id, name, selected=false){
  return {
    id, name, pain:'', painId:'', description:'描述', evidence:'证据', source:'user',
    scenarioId:'', selected, desirabilityScores:{}, extraDims:{}
  };
}
function scenario(id, name){
  return {
    id, name, description:'手填场景描述', personaIds:[], 
    needStrength:{pain:5, willingness:5, frequency:5}, selected:true
  };
}
function pain(id, text){
  return {id, pain:text, evidence:'旧证据', frequency:'高', linkedNeeds:[], type:'痛点', scenarioId:''};
}
function renderStep(step, st){
  sandbox.state = st;
  const plate = sandbox.el('div', {class:'plate'});
  const sec = {
    dataset: {},
    querySelector: sel => sel === '.plate' ? plate : null,
    querySelectorAll: () => [],
    addEventListener(){},
    appendChild: n => plate.appendChild(n)
  };
  W3.render[step](sec);
  return plate;
}
function mainButton(step, st, re){
  const plate = renderStep(step, st);
  return buttonByRegex(plate, re);
}

function scoreState(count=2){
  const st = freshState();
  st.work3.candidates = Array.from({length:count}, (_, i) => candidate('c' + (i + 1), '卖点' + (i + 1), true));
  return st;
}
function installScoreApi(st, calls){
  sandbox.API.callJson = async messages => {
    const sys = String(messages[0]?.content || '');
    const user = String(messages[1]?.content || '');
    const axis = sys.includes('目标客户') ? 'd' : 'i';
    const c = st.work3.candidates.find(x => user.includes('卖点:' + x.name));
    calls.push({
      key: axis + ':' + (c ? c.id : '?'),
      doneAtCall: (st.work3._scoreDone || []).slice(),
      system: sys,
      user
    });
    return axis === 'd'
      ? {importance:9, uniqueness:8, credibility:7}
      : {feasibility:6, communicability:5, sustainability:4};
  };
}
function scoreDims(st, c, value=8){
  for(const d of [...st.work3.dimensions.desirability, ...st.work3.dimensions.implementability]){
    c[d.key] = value;
    c['src_' + d.key] = 'ai';
  }
}
function clearScores(st, c){
  for(const d of [...st.work3.dimensions.desirability, ...st.work3.dimensions.implementability]){
    delete c[d.key];
    delete c['src_' + d.key];
  }
  c.desirabilityScores = {};
  delete c.desirabilitySource;
}

(async()=>{
resetRuntime();

/* 1. Button generated-state matrix. */
{
  const empty = freshState();
  eq('buttons/scenarios/未生成', textOf(mainButton('scenarios', empty, /场景细分/)), 'AI 起草场景细分');
  eq('buttons/pain/未生成', textOf(mainButton('mining', empty, /痛点地图/)), 'AI 起草痛点地图');
  eq('buttons/simulated/未生成', textOf(mainButton('mining', empty, /模拟语料/)), '生成模拟语料（基于画像）');
  eq('buttons/candidates/未生成', textOf(mainButton('candidates', empty, /备选卖点/)), 'AI 起草备选卖点');

  const noScore = freshState();
  noScore.work3.candidates = [candidate('c1', '卖点')];
  eq('buttons/matrix/未生成', textOf(mainButton('matrix', noScore, /双维评分/)), 'AI 起草双维评分');
  eq('buttons/proposition/未生成', textOf(mainButton('proposition', empty, /主张与定位/)), 'AI 起草主张与定位');
  eq('buttons/identity/未生成', textOf(mainButton('identity', empty, /人格与 Slogan/)), 'AI 起草人格与 Slogan');

  const manual = freshState();
  manual.work3.scenarios = [scenario('s1', '手填场景')];
  manual.work3.mining.painMap = [pain('p1', '手填痛点')];
  manual.work3.mining.simulatedDocuments = ['手填模拟语料'];
  manual.work3.candidates = [candidate('c1', '手填卖点')];
  manual.work3.proposition.alternatives = [{id:'a1', text:'手填主张'}];
  manual.work3.identity.mbti = 'INFJ';
  eq('buttons/scenarios/手填内容已生成', textOf(mainButton('scenarios', manual, /场景细分/)), 'AI 起草场景细分');
  eq('buttons/pain/手填内容已生成', textOf(mainButton('mining', manual, /痛点地图/)), 'AI 起草痛点地图');
  eq('buttons/simulated/手填内容已生成', textOf(mainButton('mining', manual, /模拟语料/)), '重新生成模拟语料');
  eq('buttons/candidates/手填内容已生成', textOf(mainButton('candidates', manual, /备选卖点/)), '重新生成备选卖点');

  const manualScore = freshState();
  manualScore.work3.candidates = [candidate('c1', '手填卖点')];
  manualScore.work3.candidates[0].importance = 8;
  eq('buttons/matrix/手填内容已生成', textOf(mainButton('matrix', manualScore, /双维评分/)), '重新生成双维评分');
  eq('buttons/proposition/手填内容已生成', textOf(mainButton('proposition', manual, /主张与定位/)), '重新生成主张与定位');
  eq('buttons/identity/手填内容已生成', textOf(mainButton('identity', manual, /人格与 Slogan/)), '重新生成人格与 Slogan');

  const ai = freshState();
  ai.work3._scenariosGenerated = true;
  ai.work3._painMapGenerated = true;
  ai.work3.mining.simulatedDocuments = ['模拟语料'];
  ai.work3.candidates = [candidate('c1', 'AI 卖点')];
  ai.work3.candidates[0].importance = 8;
  ai.work3.proposition.alternatives = [{id:'a1', text:'AI 主张'}];
  ai.work3.identity.sloganOptions = ['AI Slogan'];
  eq('buttons/scenarios/AI 已生成', textOf(mainButton('scenarios', ai, /场景细分/)), '重新生成场景细分');
  eq('buttons/pain/AI 已生成', textOf(mainButton('mining', ai, /痛点地图/)), '重新生成痛点地图');
  eq('buttons/simulated/AI 已生成', textOf(mainButton('mining', ai, /模拟语料/)), '重新生成模拟语料');
  eq('buttons/candidates/AI 已生成', textOf(mainButton('candidates', ai, /备选卖点/)), '重新生成备选卖点');
  eq('buttons/matrix/AI 已生成', textOf(mainButton('matrix', ai, /双维评分/)), '重新生成双维评分');
  eq('buttons/proposition/AI 已生成', textOf(mainButton('proposition', ai, /主张与定位/)), '重新生成主张与定位');
  eq('buttons/identity/AI 已生成', textOf(mainButton('identity', ai, /人格与 Slogan/)), '重新生成人格与 Slogan');
}

/* 2. Regeneration replaces complete groups through mocked API results. */
{
  resetRuntime();
  const st = freshState();
  st.work3.scenarios = [scenario('old', '旧场景')];
  const plate = renderStep('scenarios', st);
  const cfg = sandbox.lastAiCtx;
  cfg.onResult({scenarios:[{name:'新场景', description:'新描述', personaIds:[], needStrength:{pain:8, willingness:7, frequency:6}, selected:true}]});
  eq('replace/scenarios/整组替换', st.work3.scenarios.map(x => x.name), ['新场景']);
  eq('replace/scenarios/旧值不残留', st.work3.scenarios.some(x => x.name === '旧场景'), false);
  eq('replace/scenarios/不 confirm', confirmCalls, 0);

  resetRuntime();
  const st2 = freshState();
  sandbox.state = st2;
  st2.work3.mining.painMap = [pain('old-pain', '旧痛点')];
  st2.work3.mining.topics = [{id:0, label:'旧主题', keywords:[], representative_docs:[]}];
  sandbox.API.callJson = async () => ({topics:[], pains:[{pain:'新痛点', evidence:'新证据', frequency:'中', linkedNeeds:['新需求'], type:'痛点', scenarioId:''}]});
  await W3.runPainPipeline(makeNode('button'), makeNode('div'), {sections:[]});
  eq('replace/painMap/整体替换', st2.work3.mining.painMap.map(x => x.pain), ['新痛点']);
  eq('replace/painMap/旧值不残留', st2.work3.mining.painMap.some(x => x.pain === '旧痛点'), false);
  eq('replace/painMap/不 confirm', confirmCalls, 0);

  resetRuntime();
  const st3 = freshState();
  sandbox.state = st3;
  st3.work3.mining.simulatedDocuments = ['旧模拟语料'];
  const simBtn = makeNode('button');
  sandbox.API.callJson = async () => ({documents:['新模拟语料 A', '新模拟语料 B']});
  await W3.generateSimulatedDocs(simBtn, makeNode('div'), {sections:[]});
  eq('replace/simulated/整组替换', st3.work3.mining.simulatedDocuments, ['新模拟语料 A', '新模拟语料 B']);
  eq('replace/simulated/旧值不残留', st3.work3.mining.simulatedDocuments.includes('旧模拟语料'), false);
  eq('replace/simulated/不 confirm', confirmCalls, 0);

  resetRuntime();
  const st4 = freshState();
  st4.work3.candidates = [candidate('old-c', '旧卖点')];
  const candPlate = renderStep('candidates', st4);
  sandbox.lastAiCtx.onResult({candidates:[{name:'新卖点', pain:'', painId:'', description:'新描述', evidence:'新证据', scenarioId:''}]});
  eq('replace/candidates/整组替换', st4.work3.candidates.map(x => x.name), ['新卖点']);
  eq('replace/candidates/旧值不残留', st4.work3.candidates.some(x => x.name === '旧卖点'), false);

  resetRuntime();
  const st5 = freshState();
  st5.work3.candidates = [candidate('c1', '入选卖点', true)];
  st5.work3.proposition.alternatives = [{id:'old-alt', text:'旧主张'}];
  renderStep('proposition', st5);
  sandbox.API.aiPipeline = opts => {
    sandbox.pipelineEntry = {store:opts.store.get(), keys:opts.units.map(x => x.key)};
    opts.units[0].onResult({alternatives:[{text:'新主张 A'}, {text:'新主张 B'}]});
    opts.units[1].onResult({positioning:{brand:'新品牌', audience:'新客群', coreValue:'新价值', category:'新品类'}});
    opts.store.set(['prop:alt', 'prop:pos']);
  };
  const propBtn = buttonByRegex(renderStep('proposition', st5), /主张与定位/);
  fireClick(propBtn);
  eq('replace/propositionAlternatives/整组替换', st5.work3.proposition.alternatives.map(x => x.text), ['新主张 A', '新主张 B']);
  eq('replace/propositionAlternatives/旧值不残留', st5.work3.proposition.alternatives.some(x => x.text === '旧主张'), false);
  eq('replace/proposition/不 confirm', confirmCalls, 0);

  resetRuntime();
  const st6 = freshState();
  st6.work3.identity.sloganOptions = ['旧 Slogan'];
  renderStep('identity', st6);
  sandbox.API.aiPipeline = opts => {
    sandbox.pipelineEntry = {store:opts.store.get(), keys:opts.units.map(x => x.key)};
    opts.units[0].onResult({mbti:'ENFP', traits:['真诚','进取']});
    opts.units[1].onResult({slogans:['新 Slogan A', '新 Slogan B']});
    opts.store.set(['id:persona', 'id:slogan']);
  };
  const idBtn = buttonByRegex(renderStep('identity', st6), /人格与 Slogan/);
  fireClick(idBtn);
  eq('replace/slogans/整组替换', st6.work3.identity.sloganOptions, ['新 Slogan A', '新 Slogan B']);
  eq('replace/slogans/旧值不残留', st6.work3.identity.sloganOptions.includes('旧 Slogan'), false);
  eq('replace/identity/不 confirm', confirmCalls, 0);
}

/* 3. Pipeline checkpoints: regenerate clears and reruns; first-run interruption resumes. */
{
  resetRuntime();
  const st = freshState();
  st.work3.candidates = [candidate('c1', '入选卖点', true)];
  st.work3.proposition.alternatives = [{id:'old-alt', text:'旧主张'}];
  st.work3._pipeProp = ['prop:alt'];
  renderStep('proposition', st);
  sandbox.API.aiPipeline = opts => {
    sandbox.pipelineEntry = {store:opts.store.get(), keys:opts.units.map(x => x.key)};
    opts.units.forEach((u, i) => {
      u.onResult(i === 0 ? {alternatives:[{text:'重跑主张'}]} : {positioning:{brand:'B', audience:'A', coreValue:'V', category:'C'}});
      opts.store.set([...opts.store.get(), u.key]);
    });
  };
  const propBtn = buttonByRegex(renderStep('proposition', st), /主张与定位/);
  fireClick(propBtn);
  eq('pipeline/proposition/重生成清空断点', sandbox.pipelineEntry.store, []);
  eq('pipeline/proposition/两单元完整提供', sandbox.pipelineEntry.keys, ['prop:alt', 'prop:pos']);

  resetRuntime();
  const stResume = freshState();
  stResume.work3.candidates = [candidate('c1', '入选卖点', true)];
  stResume.work3._pipeProp = ['prop:alt'];
  renderStep('proposition', stResume);
  sandbox.API.aiPipeline = opts => { sandbox.pipelineEntry = {store:opts.store.get(), keys:opts.units.map(x => x.key)}; };
  fireClick(buttonByRegex(renderStep('proposition', stResume), /主张与定位/));
  eq('pipeline/proposition/首跑中断续跑保留断点', sandbox.pipelineEntry.store, ['prop:alt']);
  eq('pipeline/proposition/续跑仍提供两单元', sandbox.pipelineEntry.keys, ['prop:alt', 'prop:pos']);

  resetRuntime();
  const stId = freshState();
  stId.work3.identity.sloganOptions = ['旧 Slogan'];
  stId.work3._pipeIdentity = ['id:persona'];
  renderStep('identity', stId);
  sandbox.API.aiPipeline = opts => {
    sandbox.pipelineEntry = {store:opts.store.get(), keys:opts.units.map(x => x.key)};
    opts.units[0].onResult({mbti:'ENFP', traits:['真诚']});
    opts.units[1].onResult({slogans:['重跑 Slogan']});
    opts.store.set(['id:persona', 'id:slogan']);
  };
  fireClick(buttonByRegex(renderStep('identity', stId), /人格与 Slogan/));
  eq('pipeline/identity/重生成清空断点', sandbox.pipelineEntry.store, []);
  eq('pipeline/identity/两单元完整提供', sandbox.pipelineEntry.keys, ['id:persona', 'id:slogan']);

  resetRuntime();
  const stIdResume = freshState();
  stIdResume.work3._pipeIdentity = ['id:persona'];
  renderStep('identity', stIdResume);
  sandbox.API.aiPipeline = opts => { sandbox.pipelineEntry = {store:opts.store.get(), keys:opts.units.map(x => x.key)}; };
  fireClick(buttonByRegex(renderStep('identity', stIdResume), /人格与 Slogan/));
  eq('pipeline/identity/首跑中断续跑保留断点', sandbox.pipelineEntry.store, ['id:persona']);
  eq('pipeline/identity/续跑仍提供两单元', sandbox.pipelineEntry.keys, ['id:persona', 'id:slogan']);
}

{
  resetRuntime();
  const st = scoreState(2);
  const c1 = st.work3.candidates[0];
  scoreDims(st, c1);
  st.work3._scoreDone = ['d:c1', 'i:c1'];
  const scoreBtn = buttonByRegex(renderStep('matrix', st), /双维评分/);
  eq('buttons/matrix/重生成态', textOf(scoreBtn), '重新生成双维评分');
  const calls = [];
  installScoreApi(st, calls);
  await fireClick(scoreBtn);
  eq('pipeline/score/重生成清空 _scoreDone', st.work3._scoreDone, []);
  eq('pipeline/score/两轴全部重跑', calls.map(x => x.key), ['d:c1', 'd:c2', 'i:c1', 'i:c2']);
  eq('pipeline/score/重跑时断点已清空', calls[0]?.doneAtCall, []);

  resetRuntime();
  const stResume = scoreState(2);
  stResume.work3._scoreDone = ['d:c1'];
  const resumeBtn = buttonByRegex(renderStep('matrix', stResume), /双维评分/);
  const resumeCalls = [];
  installScoreApi(stResume, resumeCalls);
  await fireClick(resumeBtn);
  eq('pipeline/score/首跑中断续跑保留断点', resumeCalls[0]?.doneAtCall, ['d:c1']);
  eq('pipeline/score/续跑只补缺', resumeCalls.map(x => x.key), ['d:c2', 'i:c1', 'i:c2']);

  resetRuntime();
  const stStale = scoreState(1);
  const staleCandidate = stStale.work3.candidates[0];
  scoreDims(stStale, staleCandidate);
  stStale.work3._scoreDone = ['d:c1', 'i:c1'];
  const staleBtn = buttonByRegex(renderStep('matrix', stStale), /双维评分/);
  eq('pipeline/score/悬空断点夹具处于重生成态', textOf(staleBtn), '重新生成双维评分');
  clearScores(stStale, staleCandidate);
  const staleCalls = [];
  installScoreApi(stStale, staleCalls);
  await fireClick(staleBtn);
  eq('pipeline/score/重生成态不得静默跳过全部单元', staleCalls.map(x => x.key), ['d:c1', 'i:c1']);
  ok('pipeline/score/无调用时不得宣告完成', staleCalls.length > 0 || !toasts.includes('双维评分完成'),
    'actual calls=' + staleCalls.length + ', toasts=' + fmt(toasts));
}

/* 4. Runner/button cleanup after success and failure. */
{
  resetRuntime();
  const st = freshState();
  sandbox.state = st;
  const btn = makeNode('button');
  let during = null;
  sandbox.API.callJson = async () => {
    during = {disabled:btn.disabled, text:String(btn.textContent)};
    return {documents:['成功语料']};
  };
  await W3.generateSimulatedDocs(btn, makeNode('div'), {sections:[]});
  eq('runner/simulated/成功调用期间禁用', during.disabled, true);
  eq('runner/simulated/成功调用期间文案', during.text, '生成中…');
  eq('runner/simulated/成功后恢复可用', btn.disabled, false);
  eq('runner/simulated/成功后恢复文案', String(btn.textContent), '重新生成模拟语料');

  resetRuntime();
  const stFail = freshState();
  stFail.work3.mining.simulatedDocuments = ['已有模拟语料'];
  sandbox.state = stFail;
  const failBtn = makeNode('button');
  during = null;
  sandbox.API.callJson = async () => {
    during = {disabled:failBtn.disabled, text:String(failBtn.textContent)};
    throw new Error('transport down');
  };
  await W3.generateSimulatedDocs(failBtn, makeNode('div'), {sections:[]});
  eq('runner/simulated/失败调用期间禁用', during.disabled, true);
  eq('runner/simulated/失败调用期间文案', during.text, '生成中…');
  eq('runner/simulated/失败后恢复可用', failBtn.disabled, false);
  eq('runner/simulated/失败后恢复重新生成文案', String(failBtn.textContent), '重新生成模拟语料');
  ok('runner/simulated/失败有反馈', toasts.some(x => x.includes('生成模拟语料失败')), fmt(toasts));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
