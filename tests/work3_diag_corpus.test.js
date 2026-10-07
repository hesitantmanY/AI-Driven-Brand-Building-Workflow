/* Work3 corpus/model/staleness diagnostic tests.
   Run: node tests/work3_diag_corpus.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0;
let fail = 0;
const obs = {
  toasts: [],
  confirmCalls: [],
  confirmResult: true,
  apiCalls: [],
  manualBoxes: [],
  callJsonResult: { documents: [] },
  buildPromptCalls: []
};

function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

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
    _text: null,
    appendChild(child){ this.children.push(child); child.parentNode = this; return child; },
    addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); },
    setAttribute(key, value){
      this.attrs[key] = String(value);
      if(key === 'checked') this.checked = true;
    },
    removeAttribute(key){
      delete this.attrs[key];
      if(key === 'checked') this.checked = false;
    },
    querySelector(){ return null; },
    focus(){},
    select(){}
  };
  Object.defineProperty(node, 'textContent', {
    get(){ return this._text != null ? this._text : collectText(this); },
    set(value){ this._text = String(value); }
  });
  Object.defineProperty(node, 'innerHTML', {
    get(){ return ''; },
    set(value){ this.children = []; if(String(value).trim()) this._text = ''; }
  });
  return node;
}

function collectText(node){
  if(node.nodeType === 3) return String(node.text);
  return (node.children || []).map(collectText).join('');
}

const document = {
  createElement: makeNode,
  createTextNode: text => ({ nodeType:3, text:String(text), children:[] }),
  getElementById: () => null,
  querySelector: () => null
};

let uidCounter = 0;
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise, AbortController,
  document,
  el(tag, attrs = {}, ...children){
    const node = document.createElement(tag);
    for(const [key, value] of Object.entries(attrs || {})){
      if(key === 'class') node.className = value;
      else if(key === 'html') node.innerHTML = value;
      else if(key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if(key === 'style'){
        if(typeof value === 'object') Object.assign(node.style, value);
        else node.style.cssText = value;
      } else if(typeof value === 'boolean'){
        if(value) node.setAttribute(key, ''); else node.removeAttribute(key);
      } else if(value != null) node.setAttribute(key, value);
    }
    for(const child of children.flat()){
      if(child == null || child === false) continue;
      node.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(child) : child);
    }
    return node;
  },
  esc: value => String(value ?? ''),
  uid: prefix => `${prefix || 'id'}_${++uidCounter}`,
  mean: values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
  median: values => {
    if(!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  sd: () => 0,
  clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)),
  autosave(){},
  showToast(message){ obs.toasts.push(String(message)); },
  confirm(message){ obs.confirmCalls.push(String(message)); return obs.confirmResult; },
  renderBarChart(){},
  backendOnline: true,
  state: null,
  Work1: {},
  Work2: {},
  Work3: {},
  App: { updateSummary(){} },
  Runner: {current:null,start(){return this.current={aborted:false,controller:new AbortController()};},finish(){this.current=null;}},
  UI: {
    field(label, input){
      const root = sandbox.el('div', {class:'field'});
      input.fieldLabel = String(label);
      root.appendChild(sandbox.el('span', {}, String(label)));
      root.appendChild(input);
      return root;
    },
    tagsInput(values){
      const root = sandbox.el('div');
      const input = sandbox.el('input');
      root.appendChild(input);
      root.querySelector = selector => selector === 'input' ? input : null;
      return { el:root, get:()=>values };
    }
  },
  AiContext: {
    mountSettings(container, cfg){
      return { current:()=>({ sections:(cfg.needs || []).slice(), fewShot:cfg.fewShotKey || null }), reset(){} };
    },
    buildPrompt(cfg){
      obs.buildPromptCalls.push(cfg);
      return [
        { role:'system', content:String(cfg.system || '') },
        { role:'user', content:String(cfg.instruction || '') }
      ];
    }
  },
  API: {
    config: () => ({ apiKey:'diagnostic-key' }),
    callJson: async (...args) => {
      obs.apiCalls.push(args);
      return obs.callJsonResult;
    },
    manualBox: (...args) => { obs.manualBoxes.push(args); }
  },
  Backend: {
    lda: async () => {
      throw new Error('Backend.lda must be replaced by the active test');
    }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
sandbox.Interaction.confirm=async cfg=>{obs.confirmCalls.push(cfg.title);return obs.confirmResult;};
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop3.js'), 'utf8'), sandbox, { filename:'workshop3.js' });

const W3 = sandbox.Work3;
W3.rerender = () => {};

function freshState(){
  return {
    settings: { manualMode:false, api:{ apiKey:'diagnostic-key' } },
    work1: {
      sbu: { name:'诊断SBU', summary:'摘要' },
      analysis: {
        openThemes: []
      },
      personas: [{ id:'p1', name:'画像', painPoints:'痛点', values:['价值'], quote:'原话', region:'' }],
      values: { chosenFunctional:'功能', chosenEmotional:'情绪', chosenSocial:'社会' }
    },
    work2: {},
    work3: W3.defaultData()
  };
}

function walk(node, out = []){
  if(!node || typeof node !== 'object') return out;
  out.push(node);
  for(const child of (node.children || [])) walk(child, out);
  return out;
}

function findNode(root, predicate){ return walk(root).find(predicate) || null; }
function nodes(root, predicate){ return walk(root).filter(predicate); }
function button(root, label){
  return findNode(root, node => node.tagName === 'BUTTON' && collectText(node).trim() === label);
}
function markerSpan(root, marker){
  return findNode(root, node => node.tagName === 'SPAN' && collectText(node).includes(marker));
}
function labelWithInput(root, marker){
  const label = findNode(root, node => node.tagName === 'LABEL' && collectText(node).includes(marker));
  return label ? findNode(label, node => node.tagName === 'INPUT') : null;
}
function fieldInput(root, label){
  return findNode(root, node => node.tagName === 'INPUT' && node.fieldLabel === label);
}
function fire(node, type, event = {}){
  const listeners = (node && node._listeners && node._listeners[type]) || [];
  return Promise.all(listeners.map(fn => fn({ target:node, currentTarget:node, preventDefault(){}, ...event })));
}
function renderMining(state){
  sandbox.state = state;
  const plate = sandbox.el('div', {class:'plate'});
  W3.render.mining({ querySelector:()=>plate });
  return plate;
}

function realListAndCard(root, realCount, simulatedCount){
  const marker = markerSpan(root, `真实 ${realCount} 条 + 模拟 ${simulatedCount} 条`);
  return { marker, card:marker ? marker.parentNode : null };
}

function simulatedListAndCard(root, simulatedCount){
  const marker = markerSpan(root, `模拟语料（画像生成 ${simulatedCount} 条）`);
  return { marker, card:marker && marker.parentNode ? marker.parentNode.parentNode : null };
}

function seedStaleLda(mining){
  mining.stats = { raw_count:9, valid_count:9, total_words:90, vocab_size:20, coherence:0.42 };
  mining.topics = [{ id:0, label:'旧主题', share:100, keywords:[{ word:'旧词', weight:0.2 }], representative_docs:['旧文档'] }];
  mining.wordFreqTop = [{ word:'旧词', count:9 }];
  mining.corpusComposition = { real:0, simulated:9, total:9 };
  mining._simulated = true;
  mining.painMap = [
    { id:'pain-a', pain:'痛点A', evidence:'证据A', frequency:'高', linkedNeeds:[], linkedTopicId:'topic-a', type:'痛点', scenarioId:'' },
    { id:'pain-b', pain:'痛点B', evidence:'证据B', frequency:'中', linkedNeeds:[], linkedTopicId:'topic-b', type:'痒点', scenarioId:'' }
  ];
  return ldaSnapshot(mining);
}

function ldaSnapshot(mining){
  return {
    stats: mining.stats,
    topics: mining.topics,
    wordFreqTop: mining.wordFreqTop,
    corpusComposition: mining.corpusComposition,
    _simulated: mining._simulated,
    linkedTopicIds: (mining.painMap || []).map(pain => pain.linkedTopicId)
  };
}

const INVALID_LDA = {
  stats:null,
  topics:[],
  wordFreqTop:[],
  corpusComposition:null,
  _simulated:false,
  linkedTopicIds:[null, null]
};

function assertInvalidated(name, mining, invalidateCalls){
  const actual = ldaSnapshot(mining);
  ok(name + ': LDA 失效字段', JSON.stringify(actual) === JSON.stringify(INVALID_LDA),
     `actual=${JSON.stringify(actual)} expected=${JSON.stringify(INVALID_LDA)}`);
  if(invalidateCalls != null){
    ok(name + ': invalidateLda 调用次数', invalidateCalls === 1,
       `actual=${invalidateCalls} expected=1`);
  }
}

function beginInvalidateSpy(){
  const original = W3.invalidateLda;
  const spy = {
    calls:0,
    restore(){ W3.invalidateLda = original; }
  };
  W3.invalidateLda = function(){
    spy.calls++;
    return original.apply(this, arguments);
  };
  return spy;
}

function resetObs(){
  obs.toasts.length = 0;
  obs.confirmCalls.length = 0;
  obs.confirmResult = true;
  obs.apiCalls.length = 0;
  obs.manualBoxes.length = 0;
  obs.buildPromptCalls.length = 0;
  obs.callJsonResult = { documents:[] };
}

(async function run(){
  // 1. 真实 + 模拟混合建模与来源标注
  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实A', '真实B'];
    mining.simulatedDocuments = ['模拟A', '模拟B', '模拟C'];
    ok('1 defaultData: includeSimulated 默认 true', state.work3.mining.includeSimulated === true,
       `actual=${JSON.stringify(state.work3.mining.includeSimulated)} expected=true`);
    ok('1 collectDocs: 默认合并真实 + 模拟', JSON.stringify(W3.collectDocs()) === JSON.stringify(['真实A','真实B','模拟A','模拟B','模拟C']),
       `actual=${JSON.stringify(W3.collectDocs())} expected=${JSON.stringify(['真实A','真实B','模拟A','模拟B','模拟C'])}`);
    const expectedLabeled = [
      { text:'真实A', source:'真实' }, { text:'真实B', source:'真实' },
      { text:'模拟A', source:'模拟' }, { text:'模拟B', source:'模拟' }, { text:'模拟C', source:'模拟' }
    ];
    ok('1 collectDocsLabeled: 来源标注逐条正确', JSON.stringify(W3.collectDocsLabeled()) === JSON.stringify(expectedLabeled),
       `actual=${JSON.stringify(W3.collectDocsLabeled())} expected=${JSON.stringify(expectedLabeled)}`);
    mining.includeSimulated = false;
    ok('1 collectDocs: 取消模拟后排除模拟', JSON.stringify(W3.collectDocs()) === JSON.stringify(['真实A','真实B']),
       `actual=${JSON.stringify(W3.collectDocs())} expected=${JSON.stringify(['真实A','真实B'])}`);
    ok('1 collectDocsLabeled: 取消模拟后只剩真实来源', W3.collectDocsLabeled().every(item => item.source === '真实'),
       `actual=${JSON.stringify(W3.collectDocsLabeled())} expected=all source 真实`);
  }

  // 2. 语料构成在 mining / LDA / export 中可见
  {
    const state = freshState();
    const mining = state.work3.mining;
    mining.documents = ['真实A', '真实B'];
    mining.simulatedDocuments = ['模拟A', '模拟B', '模拟C'];
    mining.stats = { raw_count:5, valid_count:5, total_words:25, vocab_size:8, coherence:0.5 };
    mining.wordFreqTop = [];
    mining.topics = [{ id:0, label:'混合主题', share:100, keywords:[{ word:'混合', weight:0.2 }], representative_docs:['真实A'] }];
    mining.corpusComposition = { real:2, simulated:3, total:5 };
    mining._simulated = false;
    const plate = renderMining(state);
    const text = collectText(plate);
    ok('2 render.mining: 显示「真实 2 条 + 模拟 3 条」', text.includes('真实 2 条 + 模拟 3 条'),
       `actual=${JSON.stringify(text.match(/真实 [^条]+条 \+ 模拟 [^条]+条/g) || [])} expected=["真实 2 条 + 模拟 3 条"]`);
    ok('2 render.mining: LDA 结果含模拟语料标注', text.includes('含模拟语料 3 条'),
       `actual=${JSON.stringify(text.match(/含模拟语料 [^条]+条/g) || [])} expected=["含模拟语料 3 条"]`);
    mining._simulated = true;
    const simulatedText = collectText(renderMining(state));
    ok('2 render.mining: LLM 模拟建模标注可见', simulatedText.includes('模拟建模（LLM）'),
       `actual=${JSON.stringify(simulatedText.match(/模拟建模（[^）]+）/g) || [])} expected=["模拟建模（LLM）"]`);
    const md = W3.exportMd();
    ok('2 exportMd: 含实际数量与占比', md.includes('实际建模语料构成：真实 2 条（40.0%）+ 模拟 3 条（60.0%），共 5 条'),
       `actual=${JSON.stringify((md.match(/语料构成：[^\n]+/g) || []))}`);
    ok('2 exportMd: 模拟建模方式标注可见', md.includes('建模方式：LLM 模拟'),
       `actual=${JSON.stringify((md.match(/建模方式：[^\n]+/g) || []))} expected=["建模方式：LLM 模拟"]`);
  }

  // 3. 门槛、样本补足与真实种子保留
  {
    resetObs();
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一条'];
    mining.simulatedDocuments = ['模拟一条'];
    let backendCalls = 0;
    sandbox.backendOnline = true;
    sandbox.Backend.lda = async () => {
      backendCalls++;
      return { stats:{ raw_count:3, valid_count:3 }, topics:[], word_freq_top:[] };
    };
    const rejected = await W3.runLDA(null);
    ok('3 runLDA: 总语料 2 < 3 返回 false', rejected === false, `actual=${JSON.stringify(rejected)} expected=false`);
    ok('3 runLDA: 拒绝提示精确匹配', obs.toasts.includes('语料不足 3 条：请提交真实语料，或先生成模拟语料补足'),
       `actual=${JSON.stringify(obs.toasts)} expected=${JSON.stringify(['语料不足 3 条：请提交真实语料，或先生成模拟语料补足'])}`);
    ok('3 runLDA: 拒绝时不调用 Backend.lda', backendCalls === 0, `actual=${backendCalls} expected=0`);

    resetObs();
    mining.documents = [];
    mining.simulatedDocuments = ['模拟A', '模拟B', '模拟C'];
    mining.includeSimulated = true;
    let capturedDocs = null;
    sandbox.Backend.lda = async docs => {
      capturedDocs = docs.slice();
      return {
        stats:{ raw_count:3, valid_count:3, total_words:9, vocab_size:3, coherence:0.5 },
        topics:[{ id:0, label:'模拟主题', share:100, keywords:[{ word:'模拟', weight:0.2 }], representative_docs:['模拟A'] }],
        word_freq_top:[{ word:'模拟', count:3 }]
      };
    };
    const ran = await W3.runLDA(null);
    ok('3 runLDA: 真实 0 + 模拟 3 可运行', ran === true, `actual=${JSON.stringify(ran)} expected=true`);
    ok('3 runLDA: 传入 3 条模拟语料', JSON.stringify(capturedDocs) === JSON.stringify(['模拟A','模拟B','模拟C']),
       `actual=${JSON.stringify(capturedDocs)} expected=${JSON.stringify(['模拟A','模拟B','模拟C'])}`);
    ok('3 runLDA: 构成快照为真实 0 + 模拟 3', JSON.stringify(mining.corpusComposition) === JSON.stringify({real:0,simulated:3,total:3}),
       `actual=${JSON.stringify(mining.corpusComposition)} expected=${JSON.stringify({real:0,simulated:3,total:3})}`);
    mining.includeSimulated = false;
    ok('3 collectDocs: 退出模拟后真实 0 条不可建模', W3.collectDocs().length === 0,
       `actual=${W3.collectDocs().length} expected=0`);

    resetObs();
    mining.documents = ['真实种子一', '真实种子二'];
    mining.simulatedDocuments = [];
    obs.callJsonResult = { documents:['模拟新增一', '模拟新增二', '模拟新增三'] };
    await W3.generateSimulatedDocs(null, sandbox.el('div'), {});
    ok('3 generateSimulatedDocs: 已有真实文本保留', JSON.stringify(mining.documents) === JSON.stringify(['真实种子一','真实种子二']),
       `actual=${JSON.stringify(mining.documents)} expected=${JSON.stringify(['真实种子一','真实种子二'])}`);
    ok('3 generateSimulatedDocs: 新模拟语料整组写入', JSON.stringify(mining.simulatedDocuments) === JSON.stringify(['模拟新增一','模拟新增二','模拟新增三']),
       `actual=${JSON.stringify(mining.simulatedDocuments)} expected=${JSON.stringify(['模拟新增一','模拟新增二','模拟新增三'])}`);
  }

  // 4. 默认参与、负面反馈与迁移
  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    ok('4 defaultData: includeSimulated 默认 true', mining.includeSimulated === true,
       `actual=${JSON.stringify(mining.includeSimulated)} expected=true`);
    ok('4 defaultData: includeNegative 默认 true', mining.includeNegative === true,
       `actual=${JSON.stringify(mining.includeNegative)} expected=true`);
    const defaultPrompt = W3.simSystemPrompt();
    ok('4 simSystemPrompt: 默认含负面/抱怨/吐槽指令', defaultPrompt.includes('负面/抱怨/吐槽') && defaultPrompt.includes('不推荐的理由'),
       `actual=${JSON.stringify(defaultPrompt)} expected includes=负面/抱怨/吐槽,不推荐的理由`);
    delete mining.includeNegative;
    ok('4 simSystemPrompt: includeNegative!==false 仍含负面指令', W3.simSystemPrompt().includes('负面/抱怨/吐槽'),
       `actual=${JSON.stringify(W3.simSystemPrompt())} expected includes=负面/抱怨/吐槽`);
    mining.includeNegative = false;
    const positiveOnlyPrompt = W3.simSystemPrompt();
    ok('4 simSystemPrompt: false 时不含负面指令', !positiveOnlyPrompt.includes('负面/抱怨/吐槽') && !positiveOnlyPrompt.includes('不推荐的理由'),
       `actual=${JSON.stringify(positiveOnlyPrompt)} expected excludes=负面/抱怨/吐槽,不推荐的理由`);

    const migrated = W3.migrateWork3({ mining:{ documents:['旧真实'] }, candidates:[] });
    ok('4 migrateWork3: 旧数据 includeSimulated 补 true', migrated.mining.includeSimulated === true,
       `actual=${JSON.stringify(migrated.mining.includeSimulated)} expected=true`);
    ok('4 migrateWork3: 旧数据 simulatedDocuments 补空数组', Array.isArray(migrated.mining.simulatedDocuments) && migrated.mining.simulatedDocuments.length === 0,
       `actual=${JSON.stringify(migrated.mining.simulatedDocuments)} expected=[]`);
    const keptFalse = W3.migrateWork3({ mining:{ documents:[], includeSimulated:false }, candidates:[] });
    ok('4 migrateWork3: 显式 false 不被迁移覆盖', keptFalse.mining.includeSimulated === false,
       `actual=${JSON.stringify(keptFalse.mining.includeSimulated)} expected=false`);
  }

  // 5. 所有语料/开关/参数变化必须让 LDA 快照失效
  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一', '真实二'];
    mining.simulatedDocuments = ['模拟一', '模拟二'];
    const stale = seedStaleLda(mining);
    const plate = renderMining(state);
    const real = realListAndCard(plate, 2, 2);
    const deleteReal = real.card ? nodes(real.card, node => node.tagName === 'BUTTON' && collectText(node).trim() === '×')[0] : null;
    const spy = beginInvalidateSpy();
    await fire(deleteReal, 'click');
    spy.restore();
    ok('5 删真实语料: 数量减少', JSON.stringify(mining.documents) === JSON.stringify(['真实二']),
       `actual=${JSON.stringify(mining.documents)} expected=${JSON.stringify(['真实二'])}`);
    assertInvalidated('5 删真实语料', mining, spy.calls);
  }

  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一', '真实二'];
    mining.simulatedDocuments = ['模拟一', '模拟二'];
    seedStaleLda(mining);
    const plate = renderMining(state);
    const simulated = simulatedListAndCard(plate, 2);
    const deleteSimulated = simulated.card ? nodes(simulated.card, node => node.tagName === 'BUTTON' && collectText(node).trim() === '×')[0] : null;
    const spy = beginInvalidateSpy();
    await fire(deleteSimulated, 'click');
    spy.restore();
    ok('5 删模拟语料: 数量减少', JSON.stringify(mining.simulatedDocuments) === JSON.stringify(['模拟二']),
       `actual=${JSON.stringify(mining.simulatedDocuments)} expected=${JSON.stringify(['模拟二'])}`);
    assertInvalidated('5 删模拟语料', mining, spy.calls);
  }

  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一', '真实二'];
    mining.simulatedDocuments = ['模拟一'];
    const stale = seedStaleLda(mining);
    const plate = renderMining(state);
    const real = realListAndCard(plate, 2, 1);
    const clearReal = real.card ? button(real.card, '清空本地真实语料') : null;
    const spy = beginInvalidateSpy();
    obs.confirmResult = false;
    obs.confirmCalls=[];
    await fire(clearReal, 'click');
    ok('5 清空真实语料 confirm=false: 不清空', JSON.stringify(mining.documents) === JSON.stringify(['真实一','真实二']),
       `actual=${JSON.stringify(mining.documents)} expected=${JSON.stringify(['真实一','真实二'])}`);
    ok('5 清空真实语料 confirm=false: 不调用 invalidateLda', spy.calls === 0, `actual=${spy.calls} expected=0`);
    ok('5 清空真实语料 confirm=false: 旧结果保留', JSON.stringify(ldaSnapshot(mining)) === JSON.stringify(stale),
       `actual=${JSON.stringify(ldaSnapshot(mining))} expected=${JSON.stringify(stale)}`);
    obs.confirmResult = true;
    await fire(clearReal, 'click');
    spy.restore();
    ok('5 清空真实语料 confirm 文案', obs.confirmCalls.join('|') === '清空本地真实语料？|清空本地真实语料？',
       `actual=${JSON.stringify(obs.confirmCalls)} expected=${JSON.stringify(['清空本地真实语料？','清空本地真实语料？'])}`);
    ok('5 清空真实语料 confirm=true: 已清空', mining.documents.length === 0, `actual=${JSON.stringify(mining.documents)} expected=[]`);
    assertInvalidated('5 清空真实语料', mining, spy.calls);
  }

  {
    resetObs();
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一'];
    mining.simulatedDocuments = ['模拟一', '模拟二'];
    seedStaleLda(mining);
    const plate = renderMining(state);
    const simulated = simulatedListAndCard(plate, 2);
    const clearSimulated = simulated.card ? button(simulated.card, '清空模拟语料') : null;
    const spy = beginInvalidateSpy();
    await fire(clearSimulated, 'click');
    spy.restore();
    ok('5 清空模拟语料 confirm 文案', JSON.stringify(obs.confirmCalls) === JSON.stringify(['清空模拟语料？']),
       `actual=${JSON.stringify(obs.confirmCalls)} expected=${JSON.stringify(['清空模拟语料？'])}`);
    ok('5 清空模拟语料: 已清空', mining.simulatedDocuments.length === 0,
       `actual=${JSON.stringify(mining.simulatedDocuments)} expected=[]`);
    assertInvalidated('5 清空模拟语料', mining, spy.calls);
  }

  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['已有真实'];
    mining.simulatedDocuments = ['模拟一'];
    seedStaleLda(mining);
    const plate = renderMining(state);
    const paste = findNode(plate, node => node.tagName === 'TEXTAREA' && node.attrs.placeholder && node.attrs.placeholder.includes('粘贴评论'));
    const add = button(plate, '添加到语料');
    if(paste) paste.value = '新增真实 A\n\n新增真实 B';
    const spy = beginInvalidateSpy();
    fire(add, 'click');
    spy.restore();
    ok('5 添加到语料: 按空行/换行拆分并追加', JSON.stringify(mining.documents) === JSON.stringify(['已有真实','新增真实 A','新增真实 B']),
       `actual=${JSON.stringify(mining.documents)} expected=${JSON.stringify(['已有真实','新增真实 A','新增真实 B'])}`);
    assertInvalidated('5 添加到语料', mining, spy.calls);
  }

  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一'];
    mining.simulatedDocuments = ['模拟一'];
    seedStaleLda(mining);
    const input = labelWithInput(renderMining(state), '建模时包含模拟语料');
    const spy = beginInvalidateSpy();
    fire(input, 'change', { target:{ checked:false } });
    spy.restore();
    ok('5 includeSimulated 变化: 值已切换', mining.includeSimulated === false,
       `actual=${JSON.stringify(mining.includeSimulated)} expected=false`);
    assertInvalidated('5 includeSimulated 变化', mining, spy.calls);
  }

  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一'];
    mining.simulatedDocuments = ['模拟一'];
    seedStaleLda(mining);
    const input = labelWithInput(renderMining(state), '包含 Work 1 开放题答案');
    const spy = beginInvalidateSpy();
    fire(input, 'change', { target:{ checked:false } });
    spy.restore();
    ok('5 includeWork1Open 变化: 值已切换', mining.includeWork1Open === false,
       `actual=${JSON.stringify(mining.includeWork1Open)} expected=false`);
    assertInvalidated('5 includeWork1Open 变化', mining, spy.calls);
  }

  {
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一'];
    mining.simulatedDocuments = ['模拟一'];
    seedStaleLda(mining);
    const input = labelWithInput(renderMining(state), '包含 Work 1 主题文本');
    const spy = beginInvalidateSpy();
    fire(input, 'change', { target:{ checked:false } });
    spy.restore();
    ok('5 includeWork1Themes 变化: 值已切换', mining.includeWork1Themes === false,
       `actual=${JSON.stringify(mining.includeWork1Themes)} expected=false`);
    assertInvalidated('5 includeWork1Themes 变化', mining, spy.calls);
  }

  const paramCases = [
    { label:'K 主题数', key:'k', value:'6', expected:6 },
    { label:'passes', key:'passes', value:'16', expected:16 },
    { label:'iterations', key:'iterations', value:'101', expected:101 },
    { label:'no_below', key:'no_below', value:'3', expected:3 },
    { label:'no_above', key:'no_above', value:'0.6', expected:0.6 }
  ];
  for(const item of paramCases){
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = ['真实一'];
    mining.simulatedDocuments = ['模拟一'];
    seedStaleLda(mining);
    const input = fieldInput(renderMining(state), item.label);
    const spy = beginInvalidateSpy();
    fire(input, 'input', { target:{ value:item.value } });
    spy.restore();
    ok(`5 ldaParams.${item.key} 变化: 值已更新`, mining.ldaParams[item.key] === item.expected,
       `actual=${JSON.stringify(mining.ldaParams[item.key])} expected=${JSON.stringify(item.expected)}`);
    assertInvalidated(`5 ldaParams.${item.key} 变化`, mining, spy.calls);
  }

  // 6. 重点疑似 bug：生成模拟语料 apply 后旧 LDA 快照不得残留
  {
    resetObs();
    const state = freshState();
    sandbox.state = state;
    const mining = state.work3.mining;
    mining.documents = [];
    mining.simulatedDocuments = [];
    const stale = seedStaleLda(mining);
    obs.callJsonResult = { documents:['模拟语料 A', '模拟语料 B', '模拟语料 C'] };
    const spy = beginInvalidateSpy();
    await W3.generateSimulatedDocs(null, sandbox.el('div'), { sections:['sbu','personas','scenarios','valueFramework'] });
    spy.restore();
    ok('6 generateSimulatedDocs: 走 API.callJson 自动分支', obs.apiCalls.length === 1 && obs.manualBoxes.length === 0,
       `actual=${JSON.stringify({apiCalls:obs.apiCalls.length,manualBoxes:obs.manualBoxes.length})} expected=${JSON.stringify({apiCalls:1,manualBoxes:0})}`);
    ok('6 generateSimulatedDocs: m.simulatedDocuments 整组替换', JSON.stringify(mining.simulatedDocuments) === JSON.stringify(['模拟语料 A','模拟语料 B','模拟语料 C']),
       `actual=${JSON.stringify(mining.simulatedDocuments)} expected=${JSON.stringify(['模拟语料 A','模拟语料 B','模拟语料 C'])}`);
    ok('6 generateSimulatedDocs: 生成前确实持有旧 LDA 快照', JSON.stringify(stale) === JSON.stringify({
      stats:{ raw_count:9, valid_count:9, total_words:90, vocab_size:20, coherence:0.42 },
      topics:[{ id:0, label:'旧主题', share:100, keywords:[{ word:'旧词', weight:0.2 }], representative_docs:['旧文档'] }],
      wordFreqTop:[{ word:'旧词', count:9 }],
      corpusComposition:{ real:0, simulated:9, total:9 },
      _simulated:true,
      linkedTopicIds:['topic-a','topic-b']
    }), `actual=${JSON.stringify(stale)} expected=seeded stale LDA snapshot`);
    assertInvalidated('6 generateSimulatedDocs', mining, spy.calls);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  console.log(`\n${pass} passed, ${fail + 1} failed`);
  process.exit(1);
});
