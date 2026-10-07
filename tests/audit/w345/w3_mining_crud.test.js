/* 审计证据脚本（w345_crud）：Work3 卖点挖掘步的删除路径。

   跑法：node tests/audit/w345/w3_mining_crud.test.js
   红 = 当前代码有 bug。

   D. 删语料（真实/模拟）后 LDA 结果与「语料构成」徽标不失效：
      m.stats / m.topics / m.corpusComposition 是上次建模的快照，
      删完语料仍以现状口吻展示（导出也照写）。
   F. 痛点地图「对应需求」标签用 UI.tagsInput，删除只在组件内部数组里生效，
      调用方只在 blur 时同步 → 点 × 删掉的标签，任何重渲染后原样回来。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const docs = path.join(__dirname, '..', '..', '..', 'docs');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

function makeNode(tag){
  const node = {
    tagName: String(tag).toUpperCase(), nodeType: 1, children: [], attrs: {}, style: {}, className: '',
    _listeners: {}, _text: null,
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(t, fn){ (this._listeners[t] = this._listeners[t] || []).push(fn); },
    setAttribute(k, v){ this.attrs[k] = String(v); },
    removeAttribute(k){ delete this.attrs[k]; },
    querySelector(s){ return s === 'input' ? (this.children.find(c => c.tagName === 'INPUT') || null) : null; },
    closest(){return null;},
    focus(){}, select(){}
  };
  Object.defineProperty(node, 'textContent', {
    get(){ return this._text != null ? this._text : (this.children||[]).map(collectText).join(''); },
    set(v){ this._text = String(v); }
  });
  Object.defineProperty(node, 'innerHTML', {
    get(){ return ''; },
    set(v){ this.children = []; if(String(v).trim()) this._text = ''; }
  });
  return node;
}
function collectText(n){
  if(n.nodeType === 3) return String(n.text);
  return (n.children||[]).map(collectText).join('');
}
const document = {
  createElement: t => makeNode(t),
  createTextNode: s => ({ nodeType:3, text:String(s), children:[] }),
  getElementById: () => null,
  querySelector: () => null
};
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document,
  el: function(tag, attrs = {}, ...children){
    const e = document.createElement(tag);
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
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c);
    }
    return e;
  },
  esc: s => String(s ?? ''),
  uid: (p='id') => p + '_' + Math.random().toString(36).slice(2, 9),
  mean: a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
  median: a => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0,
  sd: () => 0,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  autosave: () => {},
  showToast: () => {},
  confirm: () => true,
  renderBarChart: () => {},
  backendOnline: true,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, App: {}, Runner: {}, API: {},
  AiContext: { mountSettings: (c, cfg) => ({ current: () => ({ sections:(cfg.needs||[]).slice(), fewShot: cfg.fewShotKey || null }) }) }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(docs, 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
sandbox.Interaction.confirm=async()=>true;
vm.runInContext(fs.readFileSync(path.join(docs, 'lib', 'ui.js'), 'utf8'), sandbox, { filename:'ui.js' });
sandbox.API = {
  aiCtxBox: cfg => { const box = sandbox.el('div'); box.appendChild(sandbox.el('button', {}, cfg.label || '')); return { box }; },
  aiPipeline: () => {}, callJson: async () => null, config: () => ({ apiKey:'' }), manualBox: () => {}
};
vm.runInContext(fs.readFileSync(path.join(docs, 'workshop3.js'), 'utf8'), sandbox, { filename:'workshop3.js' });
const W3 = sandbox.Work3;
W3.rerender = () => {};   // 点击后由脚本自己重渲染，避免真 DOM 依赖

const walk = (n, out = []) => {
  if(!n || typeof n !== 'object') return out;
  out.push(n);
  (n.children || []).forEach(c => walk(c, out));
  return out;
};
const textOf = n => (n.nodeType === 3 ? String(n.text) : (n.children || []).map(textOf).join(''));
const xButtons = rootNode => walk(rootNode).filter(n => n.tagName === 'BUTTON' && textOf(n) === '×');

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
  const plate = sandbox.el('div', {class:'plate'});
  W3.render.mining({ querySelector: () => plate });
  return plate;
}
function miningState(){
  const st = freshState();
  const m = st.work3.mining;
  m.documents = ['真实1', '真实2', '真实3'];
  m.simulatedDocuments = ['模拟1', '模拟2', '模拟3'];
  m.stats = { raw_count:6, valid_count:6, total_words:120, vocab_size:60, coherence:0.5 };
  m.wordFreqTop = [];
  m.topics = [{ id:0, label:'主题A', share:100, keywords:[{ word:'x', weight:0.1 }], representative_docs:[] }];
  m._simulated = true;
  m.corpusComposition = { real:3, simulated:3, total:6 };
  m.painMap = [{ id:'pa1', pain:'新牌子不敢试', evidence:'老客评论', frequency:'高', linkedNeeds:['安静', '省心'], type:'痛点', scenarioId:'' }];
  return st;
}

(async function(){
/* ---- D. 删模拟语料 → LDA 结果不失效 ---- */
{
  const st = miningState();
  let plate = renderMining(st);
  ok('D0 初始 LDA 结果区声称含模拟语料 3 条', textOf(plate).includes('含模拟语料 3 条'));
  const btns = xButtons(plate);
  const m = st.work3.mining;
  // × 按钮顺序：真实语料 3 条 → 模拟语料 3 条，第 4 个 = 模拟 #1
  ok('D0b 找到模拟语料删除按钮', btns.length >= 6, 'got ' + btns.length);
  await btns[3]._listeners.click[0]({currentTarget:btns[3]});
  ok('D1 模拟语料确实少了一条', m.simulatedDocuments.length === 2, JSON.stringify(m.simulatedDocuments));
  plate = renderMining(st);
  const txt = textOf(plate);
  ok('D2 删语料后 LDA 结果区不把旧构成当现状（应更新或标过期）',
     !txt.includes('含模拟语料 3 条') || /过期|重新运行|已失效/.test(txt),
     '仍显示「含模拟语料 3 条」而实际只剩 2 条；raw_count 仍是 ' + m.stats?.raw_count);
}

/* ---- D3. 删真实语料 → 原始文档数仍是旧值 ---- */
{
  const st = miningState();
  let plate = renderMining(st);
  for(let n=0;n<3;n++){
    const button=xButtons(plate)[0];
    await button._listeners.click[0]({currentTarget:button});
    plate=renderMining(st);
  }
  const m = st.work3.mining;
  ok('D3a 真实语料被清空', m.documents.length === 0, JSON.stringify(m.documents));
  plate = renderMining(st);
  const txt = textOf(plate);
  ok('D3b 语料清空后 LDA 结果区不把旧 6 条文档当现状（应更新或标过期）',
     !txt.includes('6') || /过期|重新运行|已失效/.test(txt),
     'stats.raw_count=' + m.stats?.raw_count + '，topics=' + m.topics.length + ' 个仍在');
}

/* ---- F. 痛点标签：点 × 删除后重渲染又回来 ---- */
{
  const st = miningState();
  let plate = renderMining(st);
  const chips = walk(plate).filter(n => n.className === 'chip' && textOf(n).startsWith('安静'));
  ok('F0 找到「安静」标签 chip', chips.length === 1, 'got ' + chips.length);
  const rm = walk(chips[0]).find(n => n.tagName === 'BUTTON' && textOf(n) === '×');
  ok('F0b 找到 chip 的删除按钮', !!rm);
  await rm._listeners.click[0]({currentTarget:rm});
  plate = renderMining(st);   // 任何重渲染（切步/其它控件触发）
  const back = walk(plate).some(n => n.className === 'chip' && textOf(n).startsWith('安静'));
  ok('F1 删除的标签不会在重渲染后复活',
     !back && !st.work3.mining.painMap[0].linkedNeeds.includes('安静'),
     'state 里 linkedNeeds=' + JSON.stringify(st.work3.mining.painMap[0].linkedNeeds) + '，重渲染后 chip 复活=' + back);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
sandbox.Interaction.invalidateUndo();
process.exit(fail ? 1 : 0);
})().catch(error=>{console.error(error);process.exit(1);});
