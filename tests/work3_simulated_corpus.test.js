/* Node test: Work 3 语料双来源（真实 + 模拟混合建模，2026-08-29 共识）。
   Run: node tests/work3_simulated_corpus.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'docs');
let toasts = [];
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document: { body: { dataset: {} }, querySelector: () => null },
  el: function(tag, attrs, ...children){
    return { tag, attrs: attrs||{}, children, appendChild(){ return this; }, addEventListener(){ return this; }, querySelector(){ return null; } };
  },
  uid: (p='id') => p + '_' + Math.random().toString(36).slice(2, 9),
  mean: a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0,
  median: a => { if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  clamp: (v,lo,hi) => Math.max(lo, Math.min(hi, v)),
  autosave: () => {},
  showToast: (msg) => { toasts.push(msg); },
  backendOnline: false,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, UI: {}, App: {}, Runner: {}, API: {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'workshop2.js'), 'utf8'), sandbox, {filename:'workshop2.js'});
vm.runInContext(fs.readFileSync(path.join(root, 'workshop3.js'), 'utf8'), sandbox, {filename:'workshop3.js'});
const W3 = sandbox.Work3;

let pass=0, fail=0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail? ' — ' + detail : '')); }
}

function freshState(){
  return {
    settings: { manualMode: false },
    work1: {
      sbu: { name:'测试SBU', summary:'' },
      analysis: { openThemes: [] },
      personas: [{ id:'p1', name:'小明', painPoints:'价格敏感', values:['实惠'], quote:'能省就省' }],
      values: { chosenFunctional:'F', chosenEmotional:'E', chosenSocial:'S' }
    },
    work2: {},
    work3: W3.defaultData()
  };
}

(async function(){
  // ---- defaultData ----
  {
    const d = W3.defaultData();
    ok('defaultData: simulatedDocuments 空数组', Array.isArray(d.mining.simulatedDocuments) && d.mining.simulatedDocuments.length===0);
    ok('defaultData: includeSimulated 默认 true', d.mining.includeSimulated === true);
    ok('defaultData: includeNegative 默认 true', d.mining.includeNegative === true);
    ok('defaultData: corpusComposition 初始 null', d.mining.corpusComposition === null);
  }

  // ---- migrateWork3 ----
  {
    const old3 = {
      context: { sbuName:'旧' },
      mining: { documents:['d1'], topics:[], wordFreqTop:[], stats:null, painMap:[] },
      candidates: [], dimensions: { desirability:[], implementability:[] },
      matrix: {}, migration: { analyses:[] }, proposition: {}
    };
    const m = W3.migrateWork3(old3);
    ok('migrate3: 补 simulatedDocuments 空数组', Array.isArray(m.mining.simulatedDocuments) && m.mining.simulatedDocuments.length===0);
    ok('migrate3: 补 includeSimulated true', m.mining.includeSimulated === true);
  }

  // ---- migrateWork3 幂等（mergeWithDefaults 的"变更检测 + 落盘"依赖此不变量） ----
  {
    const legacy = {
      context: { sbuName:'旧' },
      mining: { documents:['d1'], topics:[], wordFreqTop:[], stats:null, painMap:[{id:'p1', pain:'痛', type:'痛点'}] },
      candidates: [{id:'c1', name:'卖点', pain:'痛'}],
      dimensions: { desirability:[], implementability:[] },
      matrix: {}, migration: { analyses:[] }, proposition: {}
    };
    const before = JSON.stringify(legacy);
    const m1 = W3.migrateWork3(legacy);
    const after1 = JSON.stringify(m1);
    ok('migrate3: 旧数据第一次迁移产生变更', after1 !== before);
    const m2 = W3.migrateWork3(JSON.parse(after1));
    ok('migrate3: 第二次迁移无变更（幂等，落盘后不再触发）', JSON.stringify(m2) === after1);
  }

  // ---- collectDocs / collectDocsLabeled ----
  {
    const st = freshState();
    sandbox.state = st;
    st.work3.mining.documents = ['真实评论1', '真实评论2'];
    st.work3.mining.simulatedDocuments = ['模拟1', '模拟2', '模拟3'];
    st.work3.mining.includeSimulated = true;
    ok('collectDocs: 真实+模拟合并为 5', W3.collectDocs().length === 5, 'got '+W3.collectDocs().length);
    const labeled = W3.collectDocsLabeled();
    ok('collectDocsLabeled: 2 真实 3 模拟', labeled.filter(x=>x.source==='真实').length===2 && labeled.filter(x=>x.source==='模拟').length===3);
    st.work3.mining.includeSimulated = false;
    ok('collectDocs: 取消勾选后只用真实', W3.collectDocs().length === 2);
    st.work3.mining.includeSimulated = true;
    st.work1.analysis.openThemes = [{ question:'你喜欢什么', texts:['开放题回答'] }];
    ok('collectDocs: 含 Work1 开放题为 6', W3.collectDocs().length === 6);
  }

  // ---- 生成提示词：负面反馈要求（默认开启） ----
  {
    const st = freshState();
    sandbox.state = st;
    st.work3.mining.documents = [];
    const sys = W3.simSystemPrompt();
    ok('simSystemPrompt: 默认要求至少一半负面语料', sys.includes('至少一半语料必须是负面/抱怨/吐槽'));
    ok('simSystemPrompt: 禁止种草腔（quote 是期望不是好评）', sys.includes('quote') && sys.includes('不要写'));
    st.work3.mining.includeNegative = false;
    ok('simSystemPrompt: 关闭后不再要求负面', !W3.simSystemPrompt().includes('至少一半语料'));
  }

  // ---- resolvePainId / candidatePainValue（卖点 ↔ 痛点关联） ----
  {
    const st = freshState();
    sandbox.state = st;
    st.work3.mining.painMap = [
      { id:'pa1', pain:'新牌子不敢试，需要信任锚点', evidence:'e', frequency:'高', linkedNeeds:[], type:'痛点', scenarioId:'' },
      { id:'pa2', pain:'红 PP 反复发作', evidence:'e', frequency:'高', linkedNeeds:[], type:'痛点', scenarioId:'' }
    ];
    ok('resolvePainId: 精确匹配', W3.resolvePainId('新牌子不敢试，需要信任锚点')==='pa1');
    ok('resolvePainId: 包含匹配', W3.resolvePainId('新牌子不敢试')==='pa1');
    ok('resolvePainId: 无匹配返回空', W3.resolvePainId('完全无关内容')==='');
    ok('candidatePainValue: painId 优先', W3.candidatePainValue({painId:'pa2', pain:'旧文本'})==='pa2');
    ok('candidatePainValue: 文本兜底', W3.candidatePainValue({painId:'', pain:'红 PP 反复'})==='pa2');
    ok('candidatePainValue: 自定义', W3.candidatePainValue({painId:'', pain:'全新的痛点'})==='__custom');
  }

  // ---- painPrompt 来源标注 ----
  {
    const st = freshState();
    sandbox.state = st;
    st.work3.mining.documents = ['真实评论1'];
    st.work3.mining.simulatedDocuments = ['模拟评论1', '模拟评论2', '模拟评论3'];
    const p = W3.painPrompt(false);
    ok('painPrompt: 样例含 [真实] 标注', p.user.includes('[真实]'));
    ok('painPrompt: 样例含 [模拟] 标注', p.user.includes('[模拟]'));
    ok('painPrompt: 含语料构成行', p.user.includes('语料构成：真实 1 条 + 模拟 3 条'));
  }

  // ---- runLDA 不足 3 条提示 ----
  {
    const st = freshState();
    sandbox.state = st;
    toasts = [];
    st.work3.mining.documents = ['一条'];
    const r = await W3.runLDA(null);
    ok('runLDA: 语料 <3 返回 false', r === false);
    ok('runLDA: 提示包含「生成模拟语料」', toasts.some(t=>t.includes('生成模拟语料')));
  }

  // ---- exportMd 语料构成 ----
  {
    const st = freshState();
    sandbox.state = st;
    st.work3.mining.documents = ['真实1','真实2','真实3'];
    st.work3.mining.simulatedDocuments = ['模拟1','模拟2','模拟3'];
    st.work3.mining.topics = [{id:0,label:'主题A',share:100,keywords:[{word:'x',weight:1}],representative_docs:['模拟1']}];
    st.work3.mining.stats = {valid_count:6, coherence:0.5};
    st.work3.mining._simulated = false;
    st.work3.mining.corpusComposition = {real:3, simulated:3, total:6};
    const md = W3.exportMd();
    ok('exportMd: 含实际语料数量与占比', md.includes('实际建模语料构成：真实 3 条（50.0%）+ 模拟 3 条（50.0%），共 6 条'));
    ok('exportMd: 无模拟建模标注（真实 LDA）', !md.includes('建模方式：LLM 模拟'));
    st.work3.mining._simulated = true;
    ok('exportMd: 模拟建模时标注 LLM 模拟', W3.exportMd().includes('建模方式：LLM 模拟'));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
