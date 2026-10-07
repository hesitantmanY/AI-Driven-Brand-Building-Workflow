/* Node test: 位置 URL 路由（BIZ14，2026-09-07）

   位置真值从 state.meta + pagehide/localStorage 三层兜底（BIZ11/12/13），
   改为 URL（?w=&s=&case=）。URL 由浏览器原生保留——刷新天然回到当前页面，
   无 64KB 限制、不依赖网络、不产生"未保存"。

   契约：
   1. goStep / goWork 导航后同步 URL（history.replaceState，不污染 history 栈）
   2. renderAll 末尾让 URL 与最终恢复位置一致（覆盖 init/案例/历史/导入/重置）
   3. init 从 URL 恢复位置（含 case 深链/刷新在案例中）
   4. case 参数进入/退出案例时写入/清除
   5. 非法 URL 参数静默 fallback（work 非 1-5、step 不存在、case 未知）
   6. BIZ11/12/13 机制退役：defaultState 无 lastSaved*、saveNow 不再写 lastSaved*、
      pagehide 守门回归 dirty-only、goStep 不再写 localStorage

   Run: node tests/w_url_routing.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0,200) : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'global-brand-building.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'docs', 'lib', 'app.js'), 'utf8');

// ─────────────────────────── 源层契约 ───────────────────────────
// BIZ11/12 退役：schema 不再声明 lastSaved*，saveNow 不再写，pagehide 不比对位置
ok('defaultState 不再声明 lastSavedStep',
   !/lastSavedStep\s*:/.test(html));
ok('defaultState 不再声明 lastSavedWork',
   !/lastSavedWork\s*:/.test(html));

const saveNowBody = html.match(/async function saveNow\(\)\{[\s\S]+?\n\}/);
ok('saveNow 函数体在源里', !!saveNowBody);
if(saveNowBody){
  ok('saveNow 不再写 lastSavedStep/lastSavedWork',
     !/lastSavedStep|lastSavedWork/.test(saveNowBody[0]));
}

const pagehideBlock = html.match(/window\.addEventListener\('pagehide'[\s\S]+?\}\);/);
ok('pagehide 处理器在源里', !!pagehideBlock);
if(pagehideBlock){
  ok('pagehide 守门回归 dirty-only（不再比对 stepChanged/workChanged）',
     /if\s*\(\s*!dirty\s*\|\|\s*!state\s*\)\s*return;/.test(pagehideBlock[0]));
  ok('pagehide 不再引用 lastSaved*',
     !/lastSavedStep|lastSavedWork|stepChanged|workChanged/.test(pagehideBlock[0]));
}

// BIZ13 退役：不再有 localStorage 位置兜底
ok('app.js 不再引用 brand.lastPos',
   !/brand\.lastPos/.test(appJs));

// BIZ14：URL 路由骨架
ok('app.js 定义 syncUrl', /syncUrl\s*\(\)\s*\{/.test(appJs));
ok('app.js 定义 posFromUrl', /posFromUrl\s*\(\)\s*\{/.test(appJs));
ok('app.js 定义 restoreFromUrl', /restoreFromUrl\s*\(\s*\)\s*\{/.test(appJs));
ok('syncUrl 用 history.replaceState', /history\.replaceState\(/.test(appJs));
ok('goStep 调用 syncUrl', /goStep\(id\)\{[\s\S]{0,1200}this\.syncUrl\(\);/.test(appJs));
ok('renderAll 末尾调用 syncUrl', /this\.updateArchiveLabel\(\);[\s\S]{0,300}this\.syncUrl\(\);/.test(appJs));
ok('init 调用 restoreFromUrl', /await this\.restoreFromUrl\(\)/.test(appJs));
ok('toggleDemo 调用 syncUrl', /toggleDemo\(caseKey\)\{[\s\S]{0,4000}this\.syncUrl\(\);/.test(appJs));

// ─────────────────────────── 行为层 ───────────────────────────
const el = (tag, attrs={}, ...children) => {
  const node = {
    tag: String(tag).toUpperCase(), attrs: attrs||{}, children: [],
    _classes: (attrs && attrs.class) ? String(attrs.class).split(/\s+/).filter(Boolean) : [],
    _txt: '', _value: '',
    dataset: Object.assign({}, (attrs && attrs.dataset) || {}),
    style: (attrs && attrs.style) || {},
    hidden: false,
    classList: {
      _set: new Set((attrs && attrs.class) ? String(attrs.class).split(/\s+/).filter(Boolean) : []),
      add(...c){ c.forEach(x=>this._set.add(x)); },
      remove(...c){ c.forEach(x=>this._set.delete(x)); },
      toggle(c, force){
        if(force === true){ this._set.add(c); return true; }
        if(force === false){ this._set.delete(c); return false; }
        if(this._set.has(c)){ this._set.delete(c); return false; }
        this._set.add(c); return true;
      },
      contains(c){ return this._set.has(c); },
      toString(){ return [...this._set].join(' '); }
    },
    appendChild(c){ if(c != null) this.children.push(c); return c; },
    addEventListener(){ return this; },
    setAttribute(){}, querySelector(){ return null; }, querySelectorAll(){ return []; },
    set innerHTML(v){ this._innerHTML=v; this.children=[]; },
    get innerHTML(){ return this._innerHTML||''; },
    set textContent(v){ this._txt=String(v); }, get textContent(){ return this._txt; },
    set value(v){ this._value=v; }, get value(){ return this._value; },
    get className(){ return this.classList.toString(); },
    set className(v){ this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  };
  for(const c of children.flat()){
    if(c == null) continue;
    if(typeof c === 'string' || typeof c === 'number'){
      node.appendChild({tag:'#text', _txt:String(c), children:[]});
    } else node.appendChild(c);
  }
  if(children.length === 1 && typeof children[0] === 'string') node._txt = children[0];
  return node;
};
const elements = new Map();
const $ = s => {
  if(!elements.has(s)) elements.set(s, el('div', {id: String(s).replace(/^#/,'')}));
  return elements.get(s);
};
const $$ = () => [];

const WORKSHOPS = {
  1: [
    {id:'sbu', label:'1. SBU'}, {id:'environment', label:'2. 环境'},
    {id:'personas', label:'3. 客户画像'}, {id:'metrics', label:'4. 指标体系'},
    {id:'survey', label:'5. 合成调研'}, {id:'analysis', label:'6. 数据分析'},
    {id:'values', label:'7. 价值框架'}, {id:'recommendations', label:'8. 建议'}
  ],
  2: [
    {id:'tier', label:'1. 市场分层'}, {id:'delphi', label:'2. 德尔菲'},
    {id:'matrix', label:'3. 矩阵'}
  ],
  3: [
    {id:'pain', label:'1. 痛点'}, {id:'candidates', label:'2. 候选'},
    {id:'matrix', label:'3. 矩阵'}, {id:'chosen', label:'4. 选定'}
  ],
  4: [
    {id:'sbu', label:'1. SBU'}, {id:'partners', label:'2. 伙伴'},
    {id:'place', label:'3. 渠道'}, {id:'promotion', label:'4. 促销'},
    {id:'product', label:'5. 产品'}, {id:'price', label:'6. 价格'}
  ],
  5: [
    {id:'cover', label:'1. 封面'}, {id:'ch1', label:'2. 业务与市场'},
    {id:'ch2', label:'3. 环境'}, {id:'ch3', label:'4. 战略'},
    {id:'ch4', label:'5. 营销组合'}, {id:'ch5', label:'6. 展望'}
  ]
};
function mkWork(steps, extra){
  return Object.assign({
    BUILD:'t', steps, titles:{}, subtitles:{}, defaultData:()=>({}),
    render: Object.fromEntries(steps.map(s=>[s.id, ()=>{}]))
  }, extra || {});
}
const Work1 = mkWork(WORKSHOPS[1], { backfillScores(){} });
const Work2 = mkWork(WORKSHOPS[2]);
const Work3 = mkWork(WORKSHOPS[3]);
const Work4 = mkWork(WORKSHOPS[4], { currentStepId:()=>null });
const Work5 = mkWork(WORKSHOPS[5], { autoSync: async()=>{} });
const Settings = { renderModeSwitch(){} };

// URL / history 模拟：replaceState 会把 query 写回 location.search
const location = { pathname: '/brand-building.html', search: '', hash: '' };
const history = {
  replaceState(_s, _t, url){
    const noHash = String(url).split('#')[0];
    const qi = noHash.indexOf('?');
    location.pathname = qi >= 0 ? noHash.slice(0, qi) : noHash;
    location.search = qi >= 0 ? noHash.slice(qi) : '';
  }
};
function query(){
  return new URLSearchParams(location.search);
}

let serverState = {
  meta: { savedAt: null, isDemo: false, currentWork: 1, currentStep: 'personas' },
  work1:{}, work2:{}, work3:{}, work4:{}, work5:{}
};
let state = JSON.parse(JSON.stringify(serverState));
let dirty = false;
const markDirty = () => { if(!state?.meta?.isDemo) dirty = true; };
async function saveNow(){ if(state?.meta?.isDemo) return true; return true; }

const Cases = {
  _keys: new Set(['hengrui-zao', 'xiaoguoji']),
  has(k){ return this._keys.has(k); },
  load(k){
    if(!this._keys.has(k)) return null;
    return { work1:{}, work2:{}, work3:{}, work4:{}, work5:{} };
  }
};

const ctx = {
  el, $, $$, state, dirty,
  location, history, URLSearchParams,
  document: {
    getElementById(){ return null; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    createElement(t){ return el(t, {}); },
    body: { classList: { add(){}, remove(){}, contains(){ return false; } } }
  },
  Work1, Work2, Work3, Work4, Work5, Settings,
  Cases,
  backendOnline: false,
  DEFAULT_SETTINGS:{}, showToast(){}, saveNow, autosave: markDirty, markDirty,
  Store: { save(){}, load(){ return null; }, migrateFromLocalStorage(){ return null; }, projectId: 'default' },
  Backend: { health(){ return Promise.resolve(true); } },
  mergeWithDefaults: d => d, defaultState: () => state,
  Archive: { create(){ return Promise.resolve(); } },
  runSchemaMigrations: () => false,
  fetch: () => Promise.resolve({ json: () => ({}) }),
  apiUrl: () => '/api', DemoMenu: undefined,
  window: { scrollTo(){}, addEventListener(){}, location: { reload(){} } },
  setTimeout, clearTimeout, console,
  requestAnimationFrame(fn){ if(typeof fn === 'function') fn(); },
  Math, JSON, Array, Object, String, Number, Boolean, Date, Map, Set, Symbol, Promise, Error, RegExp,
  parseInt, parseFloat, isNaN, isFinite
};
vm.createContext(ctx);
vm.runInContext(appJs, ctx, { filename: 'app.js' });
const App = ctx.window.App;

function resetLocation(qs){
  location.search = qs || '';
  location.pathname = '/brand-building.html';
  location.hash = '';
}
function resetState(overrides){
  state = Object.assign(JSON.parse(JSON.stringify(serverState)), overrides || {});
  ctx.state = state;   // vm ctx 持引用：mutate 同一对象
  dirty = false;
  ctx.dirty = dirty;
}

(async () => {
  // ── Case 1: goStep 同步 URL ──
  resetState();
  resetLocation('');
  App.goWork(1);
  App.goStep('recommendations');
  ok('goStep 后 URL w=1 s=recommendations',
     query().get('w') === '1' && query().get('s') === 'recommendations', location.search);

  // ── Case 2: goWork 切换 + W4 首步撞 id 'sbu' ──
  App.goWork(4);
  ok('goWork(4) 后 URL w=4', query().get('w') === '4', location.search);
  ok('goWork(4) 后 URL s=sbu（W4 首步）', query().get('s') === 'sbu', location.search);
  App.goStep('place');
  ok('goStep(place) 后 URL s=place', query().get('s') === 'place', location.search);

  // ── Case 3: URL 恢复位置（纯导航刷新场景）──
  resetState({ meta: { savedAt: null, isDemo: false, currentWork: 1, currentStep: 'sbu' } });
  resetLocation('?w=4&s=place');
  await App.restoreFromUrl();
  ok('restoreFromUrl 后 currentWork=4', state.meta.currentWork === 4, state.meta.currentWork);
  ok('restoreFromUrl 后 currentStep=place', state.meta.currentStep === 'place', state.meta.currentStep);

  // ── Case 4: 非法 URL 参数静默 fallback ──
  resetState({ meta: { savedAt: null, isDemo: false, currentWork: 1, currentStep: 'sbu' } });
  resetLocation('?w=99&s=nonexistent');
  await App.restoreFromUrl();
  ok('非法 w/s 不覆盖（保留 server 位置）',
     state.meta.currentWork === 1 && state.meta.currentStep === 'sbu',
     JSON.stringify(state.meta));

  // ── Case 4b: malformed numeric work must fallback, not parseInt('1foo') → 1 ──
  resetState({ meta: { savedAt: null, isDemo: false, currentWork: 4, currentStep: 'product' } });
  resetLocation('?w=1foo&s=sbu');
  await App.restoreFromUrl();
  ok('非法 w=1foo 不覆盖（parseInt 不能当校验）',
     state.meta.currentWork === 4 && state.meta.currentStep === 'product',
     JSON.stringify(state.meta));

  resetState({ meta: { savedAt: null, isDemo: false, currentWork: 1, currentStep: 'sbu' } });
  resetLocation('?case=hengrui-zao&w=1&s=environment');
  await App.restoreFromUrl();
  ok('case 深链后 isDemo=true', state.meta.isDemo === true);
  ok('case 深链后 demoCase=hengrui-zao', state.meta.demoCase === 'hengrui-zao', state.meta.demoCase);
  ok('case 深链后 currentStep=environment', state.meta.currentStep === 'environment', state.meta.currentStep);

  // ── Case 6: 已在案例中刷新 → 直接按 URL 恢复位置（不重复进入）──
  state.meta.demoCase = 'hengrui-zao';
  state.meta.isDemo = true;
  state.meta.demoSnapshot = {};
  resetLocation('?case=hengrui-zao&w=1&s=metrics');
  await App.restoreFromUrl();
  ok('案例内刷新后 currentStep=metrics', state.meta.currentStep === 'metrics', state.meta.currentStep);
  ok('案例内刷新后 demoCase 不变', state.meta.demoCase === 'hengrui-zao');

  // ── Case 7: 未知 case 参数忽略 ──
  resetState({ meta: { savedAt: null, isDemo: false, currentWork: 1, currentStep: 'sbu' } });
  resetLocation('?case=does-not-exist&w=3&s=matrix');
  await App.restoreFromUrl();
  ok('未知 case 忽略且不进入案例', state.meta.isDemo === false && !state.meta.demoCase);
  ok('未知 case 时仍应用 w/s', state.meta.currentWork === 3 && state.meta.currentStep === 'matrix');

  // ── Case 8: syncUrl 保留其他 query、删除无值参数 ──
  resetState({ meta: { savedAt: null, isDemo: false, currentWork: 2, currentStep: 'delphi' } });
  resetLocation('?project=alpha&w=1&s=sbu&case=hengrui-zao');
  state.meta.demoCase = null;   // 退出案例后
  App.syncUrl();
  ok('syncUrl 保留无关参数 project=alpha', query().get('project') === 'alpha', location.search);
  ok('syncUrl 清除 case 参数', query().get('case') === null, location.search);
  ok('syncUrl 更新 w/s', query().get('w') === '2' && query().get('s') === 'delphi', location.search);

  // ── Case 9: renderAll 后 URL 与 state 一致（覆盖重置/导入路径）──
  resetState({ meta: { savedAt: null, isDemo: false, currentWork: 4, currentStep: 'product' } });
  resetLocation('?w=1&s=sbu');
  App.renderAll();
  ok('renderAll 后 URL 反映 state（w=4 s=product）',
     query().get('w') === '4' && query().get('s') === 'product', location.search);

  console.log('\n' + pass + ' pass / ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})();
