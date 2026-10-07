/* Node diagnostic tests: Work3 painId binding + MVO scoring domain.
   Scope: tests only. Do not change source while running this diagnostic suite.
   Run: node tests/work3_diag_pain_mvo.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const docs = path.join(__dirname, '..', 'docs');

function makeNode(tag){
  const node = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    children: [],
    attrs: {},
    style: {},
    className: '',
    dataset: {},
    parentNode: null,
    _listeners: {},
    value: '',
    checked: false,
    appendChild(child){ this.children.push(child); child.parentNode = this; return child; },
    addEventListener(type, fn){ (this._listeners[type] ||= []).push(fn); },
    dispatch(type, event = {}){ (this._listeners[type] || []).slice().forEach(fn => fn({target:this, ...event})); },
    setAttribute(key, value){ this.attrs[key] = String(value); if(key === 'value') this.value = String(value); },
    removeAttribute(key){ delete this.attrs[key]; },
    querySelector(selector){ return findNode(this, matchesSelector(selector)); },
    querySelectorAll(selector){ return findNodes(this, matchesSelector(selector)); }
  };
  let textValue = null;
  Object.defineProperty(node, 'textContent', {
    get(){ return textValue === null ? textOf(node) : textValue; },
    set(value){ textValue = String(value); }
  });
  node.classList = {
    add(...names){ names.forEach(name => { const set = new Set(node.className.split(/\s+/).filter(Boolean)); set.add(name); node.className = [...set].join(' '); }); },
    remove(...names){ names.forEach(name => { const set = new Set(node.className.split(/\s+/).filter(Boolean)); set.delete(name); node.className = [...set].join(' '); }); },
    contains(name){ return node.className.split(/\s+/).includes(name); },
    toggle(name, force){
      const wanted = force === undefined ? !node.classList.contains(name) : !!force;
      if(wanted) node.classList.add(name); else node.classList.remove(name);
      return wanted;
    }
  };
  return node;
}
function matchesSelector(selector){
  if(selector === '.metric-next[data-gated]') return n => n.nodeType === 1 && n.className.split(/\s+/).includes('metric-next') && Object.prototype.hasOwnProperty.call(n.attrs, 'data-gated');
  if(selector.startsWith('.')){ const cls = selector.slice(1); return n => n.nodeType === 1 && n.className.split(/\s+/).includes(cls); }
  return n => n.nodeType === 1 && n.tagName === selector.toUpperCase();
}
function findNode(root, pred){
  if(pred(root)) return root;
  for(const child of root.children || []){
    const hit = findNode(child, pred);
    if(hit) return hit;
  }
  return null;
}
function findNodes(root, pred, out = []){
  if(pred(root)) out.push(root);
  for(const child of root.children || []) findNodes(child, pred, out);
  return out;
}
function textOf(node){
  if(node.nodeType === 3) return String(node.text);
  return (node.children || []).map(textOf).join('');
}

const document = {
  createElement: makeNode,
  createTextNode: text => ({nodeType:3, text:String(text), children:[]}),
  getElementById: () => null,
  querySelector: () => null
};
function el(tag, attrs = {}, ...children){
  const node = makeNode(tag);
  for(const [key, value] of Object.entries(attrs || {})){
    if(key === 'class') node.className = String(value);
    else if(key === 'html') node.innerHTML = String(value);
    else if(key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if(key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if(typeof value === 'boolean'){ if(value) node.setAttribute(key, ''); else node.removeAttribute(key); }
    else node.setAttribute(key, value);
  }
  for(const child of children.flat()){
    if(child == null || child === false) continue;
    node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(child) : child);
  }
  return node;
}

const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document, el, structuredClone,
  esc: s => String(s ?? ''),
  uid: p => String(p || 'id') + '_stub',
  mean: values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
  median(values){
    if(!values.length) return 0;
    const sorted = values.slice().sort((a,b) => a-b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle-1] + sorted[middle]) / 2;
  },
  clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)),
  autosave(){},
  showToast(){},
  confirm: () => true,
  backendOnline: false,
  renderMatrix(){},
  state: null,
  Work1: {}, Work2: {}, Work3: {}, Work4: {}, App: {}, Runner: {}, API: {},
  AiContext: {mountSettings: (container, cfg) => ({current: () => ({sections:(cfg.needs || []).slice(), fewShot:cfg.fewShotKey || null}), reset(){}})}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(docs, 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
vm.runInContext(fs.readFileSync(path.join(docs, 'lib', 'ui.js'), 'utf8'), sandbox, {filename:'lib/ui.js'});
sandbox.API = {
  aiCtxBox: cfg => {
    const box = el('div');
    box.appendChild(el('button', {}, cfg.label || ''));
    return {box, current: () => ({sections:(cfg.needs || []).slice(), fewShot:cfg.fewShotKey || null})};
  },
  aiPipeline(){},
  callJson: async () => null,
  config: () => ({apiKey:''}),
  manualBox: () => ({})
};
vm.runInContext(fs.readFileSync(path.join(docs, 'workshop3.js'), 'utf8'), sandbox, {filename:'workshop3.js'});

const W3 = sandbox.Work3;
const UI = sandbox.UI;
W3.rerender = () => {};

let pass = 0;
let fail = 0;
function ok(name, condition, actual, expected){
  if(condition){
    pass++;
    console.log('PASS ' + name);
    return true;
  }
  fail++;
  const detail = actual === undefined && expected === undefined
    ? ''
    : ' — actual=' + JSON.stringify(actual) + '; expected=' + JSON.stringify(expected);
  console.log('FAIL ' + name + detail);
  return false;
}
function json(value){ return JSON.stringify(value); }

const PAIN_MAP = [
  {id:'pain_exact', pain:'控温不准，能源浪费！', type:'痛点', evidence:'证据-精确'},
  {id:'pain_contains_outer', pain:'夜间温度波动', type:'痛点', evidence:'证据-外含'},
  {id:'pain_contains_inner', pain:'夜间温度波动导致睡眠不好', type:'痛点', evidence:'证据-内含'},
  {id:'pain_fuzzy', pain:'睡眠质量持续下降', type:'痛点', evidence:'证据-模糊'}
];
function stateWith(candidates = [], painMap = PAIN_MAP){
  return {
    settings:{manualMode:false},
    work1:{sbu:{name:'SBU'}, analysis:{openThemes:[]}, personas:[], values:{}},
    work2:{},
    work3:Object.assign(W3.defaultData(), {
      mining:Object.assign(W3.defaultData().mining, {painMap:painMap.map(p => ({...p}))}),
      candidates
    })
  };
}
function candidate(overrides = {}){
  return {
    id:'c_test', name:'候选卖点', pain:'', painId:'', description:'', evidence:'',
    source:'user', scenarioId:'', selected:false, desirabilityScores:{}, extraDims:{},
    ...overrides
  };
}
function bindState(painMap = PAIN_MAP, candidates = []){
  sandbox.state = stateWith(candidates, painMap);
  return sandbox.state;
}
function renderCandidates(st){
  sandbox.state = st;
  const sec = el('section');
  const plate = el('div', {class:'plate'});
  sec.querySelector = selector => selector === '.plate' ? plate : findNode(sec, matchesSelector(selector));
  W3.render.candidates(sec);
  return {sec, plate};
}
function selectedPainOption(plate){
  return findNode(plate, node => node.tagName === 'SELECT' && (node.children || []).some(child => child.tagName === 'OPTION' && child.selected));
}

console.log('CHECK 1 resolvePainId(text, true): exact / punctuation / containment / strict fuzzy rejection');
{
  bindState();
  ok('1a strict exact text', W3.resolvePainId('控温不准，能源浪费！', true) === 'pain_exact',
    W3.resolvePainId('控温不准，能源浪费！', true), 'pain_exact');
  ok('1b strict exact pain id', W3.resolvePainId('pain_exact', true) === 'pain_exact',
    W3.resolvePainId('pain_exact', true), 'pain_exact');
  ok('1c strict punctuation-normalized exact', W3.resolvePainId('控温不准能源浪费', true) === 'pain_exact',
    W3.resolvePainId('控温不准能源浪费', true), 'pain_exact');
  ok('1d strict containment: candidate contains map text', W3.resolvePainId('用户反馈：夜间温度波动，影响休息', true) === 'pain_contains_outer',
    W3.resolvePainId('用户反馈：夜间温度波动，影响休息', true), 'pain_contains_outer');
  ok('1e strict containment: map text contains candidate', W3.resolvePainId('温度波动', true) === 'pain_contains_outer',
    W3.resolvePainId('温度波动', true), 'pain_contains_outer');
  ok('1f strict pure 2-gram fuzzy returns empty', W3.resolvePainId('睡眠质量难题', true) === '',
    W3.resolvePainId('睡眠质量难题', true), '');
}

console.log('\nCHECK 2 resolvePainId(text, false) fuzzy suggestion is render-only');
{
  const c = candidate({pain:'睡眠质量难题', painId:'', evidence:''});
  const st = bindState(PAIN_MAP, [c]);
  const fuzzyId = W3.resolvePainId(c.pain, false);
  ok('2a loose 2-gram score reaches suggestion threshold', fuzzyId === 'pain_fuzzy', fuzzyId, 'pain_fuzzy');
  ok('2b candidatePainValue suggests fuzzy hit', W3.candidatePainValue(c) === 'pain_fuzzy', W3.candidatePainValue(c), 'pain_fuzzy');
  ok('2c pure function leaves c.painId empty', c.painId === '', c.painId, '');
  const {plate} = renderCandidates(st);
  const selected = selectedPainOption(plate);
  ok('2d render dropdown selects fuzzy suggestion', selected && selected.children.some(o => o.tagName === 'OPTION' && o.selected && o.attrs.value === 'pain_fuzzy'),
    selected ? selected.children.filter(o => o.tagName === 'OPTION' && o.selected).map(o => o.attrs.value) : null, ['pain_fuzzy']);
  ok('2e render-only suggestion writes neither painId nor evidence', c.painId === '' && c.evidence === '',
    {painId:c.painId, evidence:c.evidence}, {painId:'', evidence:''});
}

console.log('\nCHECK 3 resolvePainBinding three branches');
{
  bindState();
  const hallucinatedPain = W3.resolvePainBinding({painId:'', pain:'pain_zzz', evidence:''});
  ok('3a hallucinated id in pain clears pain and does not bind', hallucinatedPain.painId === '' && hallucinatedPain.pain === '',
    hallucinatedPain, {painId:'', pain:'', evidence:''});
  const hallucinatedPainId = W3.resolvePainBinding({painId:'pain_zzz', pain:'完全自定义痛点', evidence:'保留证据'});
  ok('3b hallucinated painId clears id but preserves unrelated custom text/evidence',
    hallucinatedPainId.painId === '' && hallucinatedPainId.pain === '完全自定义痛点' && hallucinatedPainId.evidence === '保留证据',
    hallucinatedPainId, {painId:'', pain:'完全自定义痛点', evidence:'保留证据'});
  const hit = W3.resolvePainBinding({painId:'pain_exact', pain:'AI 转述不采信', evidence:''});
  ok('3c valid painId uses map pain and fills empty evidence',
    hit.painId === 'pain_exact' && hit.pain === '控温不准，能源浪费！' && hit.evidence === '证据-精确',
    hit, {painId:'pain_exact', pain:'控温不准，能源浪费！', evidence:'证据-精确'});
  const hitWithEvidence = W3.resolvePainBinding({painId:'pain_exact', pain:'旧文本', evidence:'用户证据'});
  ok('3d valid painId keeps existing evidence', hitWithEvidence.evidence === '用户证据', hitWithEvidence.evidence, '用户证据');
  const unboundInput = {painId:'', pain:'完全对不上的自定义描述', evidence:'自有证据'};
  const before = structuredClone(unboundInput);
  const after = W3.resolvePainBinding(unboundInput);
  ok('3e unbound candidate preserves painId/pain/evidence exactly', json(after) === json(before), after, before);
}

console.log('\nCHECK 4 heal / stale painId self-healing');
{
  const existingMap = [{id:'pain_ok', pain:'地图原文', type:'痛点', evidence:'地图证据'}];
  const correct = candidate({painId:'pain_ok', pain:'用户改写但已绑定', evidence:'用户证据'});
  bindState(existingMap, [correct]);
  const before = structuredClone(correct);
  ok('4a already-correct binding is untouched and heal is idempotent',
    W3.healCandidatesPain() === false && json(correct) === json(before), {changed:W3.healCandidatesPain(), candidate:correct}, {changed:false, candidate:before});

  const stale = candidate({painId:'pain_deleted', pain:'地图条目删除后留下的自定义痛点', evidence:'自有证据'});
  bindState([{id:'pain_other', pain:'另一个完全不同的痛点', type:'痛点', evidence:'无关证据'}], [stale]);
  ok('4b candidatePainValue falls back to __custom for dangling id', W3.candidatePainValue(stale) === '__custom', W3.candidatePainValue(stale), '__custom');
  const resolvedStale = W3.resolvePainBinding(stale);
  ok('4c resolvePainBinding clears dangling id without rewriting custom fields',
    resolvedStale.painId === '' && resolvedStale.pain === stale.pain && resolvedStale.evidence === stale.evidence,
    resolvedStale, {painId:'', pain:stale.pain, evidence:stale.evidence});
  ok('4d heal removes dangling id and is then idempotent',
    W3.healCandidatesPain() === true && stale.painId === '' && W3.healCandidatesPain() === false,
    {afterFirst:{painId:stale.painId, pain:stale.pain, evidence:stale.evidence}, second:W3.healCandidatesPain()},
    {afterFirst:{painId:'', pain:'地图条目删除后留下的自定义痛点', evidence:'自有证据'}, second:false});

  const staleRender = candidate({painId:'pain_deleted', pain:'地图条目删除后留下的自定义痛点', evidence:'自有证据'});
  const renderState = bindState([{id:'pain_other', pain:'另一个完全不同的痛点', type:'痛点', evidence:'无关证据'}], [staleRender]);
  const {plate} = renderCandidates(renderState);
  const selected = selectedPainOption(plate);
  const selectedValues = selected ? selected.children.filter(o => o.tagName === 'OPTION' && o.selected).map(o => o.attrs.value) : [];
  const customInput = findNode(plate, n => n.nodeType === 1 && n.tagName === 'INPUT' && n.attrs.value === '地图条目删除后留下的自定义痛点');
  ok('4e dangling id renders as custom, not as a map binding',
    json(selectedValues) === json(['__custom']) && !!customInput,
    {selectedValues, customInput:!!customInput, painId:staleRender.painId},
    {selectedValues:['__custom'], customInput:true, painId:''});
}

console.log('\nCHECK 5 Work3 matrix MVO scoring domain');
{
  function matrixScoreCheck(candidateValue){
    bindState(PAIN_MAP, [candidateValue]);
    return W3.mvo.matrix().checks[0].test();
  }
  const dimOnly = candidate({
    importance:8, uniqueness:7, credibility:9,
    feasibility:8, communicability:7, sustainability:6,
    desirabilityScores:{}
  });
  ok('5a dimension scores only pass', matrixScoreCheck(dimOnly) === true, matrixScoreCheck(dimOnly), true);

  const personaOnly = candidate({
    desirabilityScores:{p1:{importance:8, uniqueness:7, credibility:9}},
    feasibility:8, communicability:7, sustainability:6
  });
  ok('5b persona subscores only pass with all c[d.key] empty',
    matrixScoreCheck(personaOnly) === true && ['importance','uniqueness','credibility'].every(k => personaOnly[k] == null),
    {result:matrixScoreCheck(personaOnly), desirabilityFields:['importance','uniqueness','credibility'].map(k => personaOnly[k])},
    {result:true, desirabilityFields:[null, null, null]});

  const noDesirability = candidate({feasibility:8, communicability:7, sustainability:6, desirabilityScores:{}});
  ok('5c neither dimension nor persona desirability scores fail', matrixScoreCheck(noDesirability) === false, matrixScoreCheck(noDesirability), false);

  const missingImplementability = candidate({
    desirabilityScores:{p1:{importance:8, uniqueness:7, credibility:9}},
    feasibility:8, communicability:7
  });
  ok('5d missing implementability dimension fails', matrixScoreCheck(missingImplementability) === false, matrixScoreCheck(missingImplementability), false);
}

console.log('\nCHECK 6 computeMatrix copy semantics and review overrides');
{
  const c = candidate({
    importance:8, uniqueness:7, credibility:9,
    feasibility:8, communicability:7, sustainability:6,
    desirabilityScores:{p1:{importance:2, uniqueness:2, credibility:2}, p2:{importance:4, uniqueness:4, credibility:4}},
    reviewDes:4.25, reviewImp:7.5
  });
  bindState(PAIN_MAP, [c]);
  const before = json(sandbox.state.work3.candidates);
  const points = W3.computeMatrix();
  const after = json(sandbox.state.work3.candidates);
  ok('6a computeMatrix does not write x/y or aggregates into state', before === after && points[0] !== c,
    {stateBefore:before, stateAfter:after, sameReference:points[0] === c},
    {stateBefore:before, stateAfter:before, sameReference:false});
  ok('6b no x/y/aggregate fields are present on the state candidate',
    !Object.prototype.hasOwnProperty.call(c, 'x') && !Object.prototype.hasOwnProperty.call(c, 'y') &&
    !Object.prototype.hasOwnProperty.call(c, 'src_importance') && !Object.prototype.hasOwnProperty.call(c, 'src_uniqueness') &&
    !Object.prototype.hasOwnProperty.call(c, 'src_credibility'),
    Object.keys(c).filter(k => k === 'x' || k === 'y' || k.startsWith('src_')), []);
  ok('6c reviewDes/reviewImp override all lower-priority sources and are clamped consistently',
    points[0].y === 4.25 && points[0].x === 7.5,
    {x:points[0].x, y:points[0].y}, {x:7.5, y:4.25});
}

console.log('\nCHECK 7 read-only aggregates, direct dimensions and current persona fallback');
{
  const c = candidate({
    importance:1,
    desirabilityScores:{
      p1:{importance:10, uniqueness:8, credibility:4},
      p2:{importance:10, uniqueness:10, credibility:8}
    }
  });
  bindState(PAIN_MAP, [c]);
  const snapshot=json(c);
  const firstAggregate = W3.ensureDesirabilityAggregates();
  ok('7a returns distinct views without writing candidates', firstAggregate[0]!==c && json(c)===snapshot);
  ok('7b missing dimensions use persona means in the view', firstAggregate[0].uniqueness===9 && firstAggregate[0].credibility===6,
    firstAggregate[0], {importance:1, uniqueness:9, credibility:6});
  ok('7c direct dimension score takes priority over persona fallback', firstAggregate[0].importance===1 && W3.computeMatrix()[0].y===16/3);
  const secondAggregate = W3.ensureDesirabilityAggregates();
  ok('7d repeated evaluation remains read-only and stable', json(secondAggregate)===json(firstAggregate) && json(c)===snapshot);
  c.uniqueness=99;c.src_uniqueness='personas';
  c.desirabilityScores={p1:{importance:10,uniqueness:3,credibility:4}};
  ok('7e legacy persona cache does not override current subscores', W3.ensureDesirabilityAggregates()[0].uniqueness===3);
  c.desirabilityScores={p1:{}};
  ok('7f empty persona records do not satisfy scoring MVO', W3.mvo.matrix().checks[0].test()===false);
}

console.log('\nCHECK 8 ui.js mvoCard live refresh + Work3 matrix CTA gate');
{
  const c = candidate({desirabilityScores:{p1:{importance:8, uniqueness:7, credibility:9}}});
  bindState(PAIN_MAP, [c]);
  const sec = el('section');
  const cfg = W3.mvo.matrix();
  const cta = UI.stepNextCta(3, 'matrix');
  sec.appendChild(cta);
  const card = UI.mvoCard(cfg, sec);
  const progress = findNode(card, n => n.className === 'mvo-progress');
  ok('8a initial MVO/CTA state is blocked', cta._gate() === false && cta.classList.contains('metric-next--hidden') && progress.textContent === '0/2',
    {gate:cta._gate(), hidden:cta.classList.contains('metric-next--hidden'), progress:progress.textContent},
    {gate:false, hidden:true, progress:'0/2'});
  Object.assign(c, {feasibility:8, communicability:7, sustainability:6});
  sec.dispatch('input');
  ok('8b input refresh advances MVO but keeps CTA blocked until all checks pass',
    progress.textContent === '1/2' && cta._gate() === false && cta.classList.contains('metric-next--hidden'),
    {gate:cta._gate(), hidden:cta.classList.contains('metric-next--hidden'), progress:progress.textContent},
    {gate:false, hidden:true, progress:'1/2'});
  c.selected = true;
  sec.dispatch('change');
  ok('8c later input/change refresh synchronizes CTA and _gate',
    progress.textContent === '2/2' && cta._gate() === true && !cta.classList.contains('metric-next--hidden'),
    {gate:cta._gate(), hidden:cta.classList.contains('metric-next--hidden'), progress:progress.textContent},
    {gate:true, hidden:false, progress:'2/2'});
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
