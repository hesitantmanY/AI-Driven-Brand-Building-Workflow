/* Node test: 一级维度可编辑 + 删除影响面确认 + 整轴恢复默认模板（2026-09-11）。

   事故：Work2 指标体系里一级维度只渲染成 <summary> 的纯文本——名字与一级权重
   都没有输入框。用户删掉「风险」后点「+ 一级维度」，新维度永远卡在
   「新一级维度」改不了名，只能整轴重来；而「删除整个一级」是静默的，
   连带删掉的二级指标锚点与已打评分（scoring 按 ind.id 存）无法复原。

   共识：一级名称/一级权重给编辑入口（与二级同形）；删除前把连带影响摊开确认；
   每轴一个「恢复默认 4×2 模板」兜底，恢复即重置 Delphi（指标 id 全变）。

   Run: node tests/work2_category_edit.test.js
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

/* ---- 最小 DOM stub：够跑 render.framework 并回放事件 ---- */
function makeNode(tag, attrs){
  return {
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
    // 与真 DOM 一致：设 textContent 清空子节点；读则递归拼接子树文本
    set textContent(v){ this._text = v; this.children = []; },
    get textContent(){
      if(this._text != null) return this._text;
      return (this.children || []).map(c => (c.tag === '#text' ? c.text : c.textContent) || '').join('');
    }
  };
}
// 与 global-brand-building.html 里的 el 同形（attrs 分派 + children 扁平化）
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
const apiCalls = [];
const barCalls = [];
let confirmAnswer = true;
let dirtyCount = 0;

const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  el, walk,
  document: { createElement: makeNode, body: { dataset:{} }, querySelector: () => null },
  uid: (p='id') => p + '_' + Math.random().toString(36).slice(2, 9),
  mean: a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0,
  median: a => { if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  clamp: (v,lo,hi) => Math.max(lo, Math.min(hi, v)),
  autosave: () => { dirtyCount++; },
  showToast: m => toasts.push(m),
  confirm: m => { confirmMsgs.push(m); return confirmAnswer; },
  renderBarChart: (c, items, opts) => barCalls.push({items, opts: opts||{}}),
  API: { aiCtxBox: () => ({ box: makeNode('div') }), aiPipeline: () => {}, aiButton: opts => { apiCalls.push(opts); } },
  Runner: { start: () => null, renderUI(){} },
  state: null,
  Work2: {}, UI: {}, App: {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'interaction.js'});
sandbox.Interaction.confirm=async ({message})=>{confirmMsgs.push(message);return confirmAnswer;};
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop2.js'), 'utf8'), sandbox, {filename:'workshop2.js'});
const W2 = sandbox.Work2;
W2.rerender = () => {};   // 无真实 DOM 挂载，重绘入口打桩

(async()=>{
/* ---- state：默认 4×2 + 3 个保留市场 + 每格都有分（删除会清理其评分引用）---- */
sandbox.state = { work1: { sbu: { name: '智能温控器' } }, work2: W2.defaultData() };
const w2 = sandbox.state.work2;
w2.retained = [{id:'m1',name:'德国'}, {id:'m2',name:'荷兰'}, {id:'m3',name:'瑞典'}];
w2.scoring = {};
w2.retained.forEach(m => {
  w2.scoring[m.id] = {};
  W2.allIndicators().forEach(i => { w2.scoring[m.id][i.id] = {score:7, evidence:'公开数据', url:'', source:'user'}; });
});
w2.delphi.status = 'done';
// 招聘 + persona 已完成，renderDelphi 才会画「最终权重」图
w2.delphi.recruitment.perspectives = [{ name:'视角一', rationale:'', keySignals:[] }];
w2.delphi.personas = [{ id:'p1', name:'P1', ratings:{ attractiveness:{}, competitiveness:{} } }];
W2.allIndicators().forEach(i => w2.delphi.personas[0].ratings[i.axis][i.id] = 0.125);

const plate = makeNode('div', { class: 'plate' });
const sec = { querySelector: sel => (sel === '.plate' ? plate : null) };
let threw = null;
try { W2.render.framework(sec); } catch(e){ threw = e; }
ok('render.framework 不抛异常', !threw, threw && threw.stack);

const all = walk(plate);
const inputs = all.filter(n => n.tag === 'input');
const nameInputs = inputs.filter(n => n.attrs.placeholder === '如：经济 / 政治法律 / 社会文化 / 风险');
ok('每个一级维度都有名称输入框（2 轴 × 4 = 8）', nameInputs.length === 8, 'got ' + nameInputs.length);
ok('一级权重与二级权重都是 number 输入（8 + 16 = 24；persona 打分为 toFixed 字符串，不计）',
  inputs.filter(n => n.attrs.type === 'number' && Number(n.attrs.step) === 0.05 &&
    typeof n.attrs.value === 'number').length === 24);
ok('每轴一个「+ 一级维度」按钮', buttons(plate, '+ 一级维度').length === 2);
ok('每轴一个「恢复默认 4×2 模板」按钮', buttons(plate, '恢复默认 4×2 模板').length === 2);
ok('每个一级维度都有删除按钮', buttons(plate, '删除整个一级').length === 8);

/* ---- 最终权重图：0–1 归一化权重、两位小数（与 persona 赋权表同口径，不用百分比）---- */
ok('Delphi done → 两轴各画一张最终权重条形图',
  barCalls.length === 2 && barCalls.every(b => b.opts.unit === '' && b.opts.decimals === 2),
  JSON.stringify(barCalls.map(b => b.opts)));
ok('每张图 8 个指标、权重按轴归一化（合计 1，值域 0–1）',
  barCalls.every(b => b.items.length === 8 &&
    b.items.every(i => i.value >= 0 && i.value <= 1) &&
    Math.abs(b.items.reduce((s, i) => s + i.value, 0) - 1) < 1e-6));

/* ---- 改名：写进 state、summary 同步、只标脏不写盘 ---- */
const cat0 = w2.attractiveness.categories[0];
const summary = all.find(n => n.tag === 'summary');
const sumNameSpan = summary.children[0];
nameInputs[0].handlers.input({ target: { value: '宏观经济与支付力' } });
ok('改一级名称写入 state', cat0.name === '宏观经济与支付力', cat0.name);
ok('改一级名称同步 summary 展示', sumNameSpan.textContent === '宏观经济与支付力', sumNameSpan.textContent);
ok('改名走 autosave（标脏，不直接写盘）', dirtyCount > 0);

/* ---- 改一级权重：写入 + 有效权重重算 + Delphi 标偏离 ---- */
const effSpans = all.filter(n => n.tag === 'span' && String(n.textContent).startsWith('有效 '));
const effBefore = effSpans[0].textContent;
const catWeightInput = inputs.find(n => n.attrs.type === 'number' && Number(n.attrs.value) === 0.25);
catWeightInput.handlers.input({ target: { value: '0.4' } });
ok('改一级权重写入 state', Math.abs(cat0.weight - 0.4) < 1e-9, String(cat0.weight));
ok('改一级权重同步 summary 权重展示', /一级权重 40%/.test(summary.textContent), summary.textContent);
ok('改一级权重后二级有效权重重算', effSpans[0].textContent !== effBefore, effBefore + ' → ' + effSpans[0].textContent);
ok('已收敛时手改一级权重 → 标记偏离', w2.delphi.drifted === true);

/* ---- 删除整个一级：取消不动，确认才删，且提示含影响面 ---- */
const riskCat = w2.attractiveness.categories.find(c => c.name === '风险');
const impact = W2.catImpact(riskCat);
ok('catImpact 数出二级指标数与已评分格数（2 × 3 市场 = 6）',
  impact.indCount === 2 && impact.scored === 6, JSON.stringify(impact));
const riskBtn = buttons(plate, '删除整个一级')[3];
confirmAnswer = false; confirmMsgs.length = 0;
await riskBtn.handlers.click({currentTarget:riskBtn});
ok('取消 → 一级维度不被删', w2.attractiveness.categories.length === 4 && w2.attractiveness.categories.some(c => c.name === '风险'));
ok('确认框写清连带删除的二级指标数', /连带删除 2 个二级指标/.test(confirmMsgs[0] || ''), confirmMsgs[0]);
ok('确认框写清会删除的评分格数', /已打的 6 格评分会删除/.test(confirmMsgs[0] || ''), confirmMsgs[0]);
ok('确认框写明不可撤销且模板救不回锚点', /不可撤销/.test(confirmMsgs[0] || '') && /锚点与评分不会回来/.test(confirmMsgs[0] || ''), confirmMsgs[0]);
confirmAnswer = true;
await riskBtn.handlers.click({currentTarget:riskBtn});
ok('确认 → 「风险」被删', w2.attractiveness.categories.length === 3 && !w2.attractiveness.categories.some(c => c.name === '风险'));
ok('确认 → 评分及 persona 的被删指标引用实际清理', riskCat.indicators.every(i=>!w2.scoring.m1[i.id]&&!w2.delphi.personas[0].ratings.attractiveness[i.id]));
ok('删最后一个一级 → 提示本轴将空', /本轴最后一个一级维度/.test(W2.catDeleteMsg({name:'经济', indicators:[{id:'x'}]}, '市场吸引力', 0)));

/* ---- 恢复默认 4×2 模板：只动本轴，Delphi 重置 ---- */
w2.attractiveness.categories = [];   // 模拟一级被删光（mergeWithDefaults 不会补回空数组）
w2.delphi.personas = [{id:'p1', ratings:{}}];
confirmAnswer = true; confirmMsgs.length = 0; toasts.length = 0;
await W2.restoreAxisTemplate('attractiveness');
const restored = w2.attractiveness.categories;
ok('空轴恢复出 4 个默认一级维度',
  restored.length === 4 && restored.map(c => c.name).join(',') === '经济,政治法律,社会文化,风险',
  JSON.stringify(restored.map(c => c.name)));
ok('恢复的一级各带 2 个二级 + 空锚点',
  restored.every(c => c.indicators.length === 2 && c.indicators.every(i => i.rubric.high === '' && i.source === 'template')));
ok('恢复模板 → Delphi 重置为未运行',
  w2.delphi.status === 'idle' && w2.delphi.personas.length === 0 && w2.delphi.finalWeights === null && w2.delphi.drifted === false);
ok('恢复模板 → 另一轴不动', w2.competitiveness.categories.length === 4 && w2.competitiveness.categories[0].indicators.length === 2);
ok('空轴恢复的确认文案说明可直接改名', /本轴现在是空的/.test(confirmMsgs[0] || ''), confirmMsgs[0]);
ok('恢复后给了 toast', /已恢复「市场吸引力」默认 4×2 模板/.test(toasts.join('|')), toasts.join('|'));

restored[0].indicators[0].rubric.high = '市场规模 > 5 亿';
confirmMsgs.length = 0;
await W2.restoreAxisTemplate('attractiveness');
ok('有内容时恢复 → 警告锚点/权重/评分不回', /不会回来/.test(confirmMsgs[0] || ''), confirmMsgs[0]);
ok('确认恢复 → 写过的锚点被模板覆盖', w2.attractiveness.categories[0].indicators[0].rubric.high === '');
confirmAnswer = false; confirmMsgs.length = 0;
const kept = w2.attractiveness.categories;
kept[0].indicators[0].rubric.high = '市场规模 > 5 亿';
await W2.restoreAxisTemplate('attractiveness');
ok('取消恢复 → 一级维度与刚写的锚点原样保留',
  w2.attractiveness.categories === kept && kept[0].indicators[0].rubric.high === '市场规模 > 5 亿');

/* ---- 每轴一级维度硬上限 4 个：满 4 时按钮置灰、handler 也挡 ---- */
const addBtns = buttons(plate, '+ 一级维度');
ok('每轴一个「+ 一级维度」按钮（置灰但还在，看得见上限）', addBtns.length === 2);
ok('两轴都满 4 个 → 两个新增按钮都 disabled',
  addBtns.every(b => b.attrs.disabled === ''), JSON.stringify(addBtns.map(b => b.attrs.disabled)));
toasts.length = 0;
const compBefore = w2.competitiveness.categories.length;
addBtns[1].handlers.click();
ok('满 4 个时点「+ 一级维度」→ 不新增，只提示上限',
  w2.competitiveness.categories.length === compBefore && /最多 4 个/.test(toasts.join('|')), toasts.join('|'));

/* ---- 每个一级下二级指标硬上限 2 个：满 2 置灰，删一个才能加 ---- */
const addIndBtns = buttons(plate, '+ 二级指标');
ok('每个一级一个「+ 二级指标」按钮（8 个）', addIndBtns.length === 8, 'got ' + addIndBtns.length);
ok('模板每个一级都有 2 个二级 → 8 个按钮全 disabled',
  addIndBtns.every(b => b.attrs.disabled === ''), JSON.stringify(addIndBtns.map(b => b.attrs.disabled)));
const anyCat = w2.competitiveness.categories[0];
toasts.length = 0;
addIndBtns[4].handlers.click();   // 竞争力第一个一级
ok('满 2 个时点「+ 二级指标」→ 不新增只提示',
  anyCat.indicators.length === 2 && /最多 2 个/.test(toasts.join('|')), toasts.join('|'));
// 删掉一个 → 按钮解除置灰、点击补回一个
anyCat.indicators.pop();
const plate1b = makeNode('div');
W2.render.framework({ querySelector: s => (s === '.plate' ? plate1b : null) });
const enabledAddInd = buttons(plate1b, '+ 二级指标')[4];
ok('只剩 1 个二级时按钮不 disabled', enabledAddInd.attrs.disabled == null);
enabledAddInd.handlers.click();
ok('未满 2 个时点 → 新增空名二级，权重 0.5，source=user',
  anyCat.indicators.length === 2 && anyCat.indicators[1].name === '' &&
  anyCat.indicators[1].weight === 0.5 && anyCat.indicators[1].source === 'user',
  JSON.stringify(anyCat.indicators.map(i => i.name)));

/* ---- AI 只补缺失的一级：不碰已有指标、锚点、id 与评分 ---- */
const att = () => w2.attractiveness.categories;
// 现状：吸引力 = 4 个模板一级；删掉「风险」模拟误删
w2.attractiveness.categories = att().filter(c => c.name !== '风险');
let miss = W2.missingTemplateCats('attractiveness');
ok('删掉「风险」→ 只报风险缺失', miss.length === 1 && miss[0][0] === '风险', JSON.stringify(miss.map(m => m[0])));
att().push({ id:'cat_renamed', name:'竞争与合规风险', weight:0.25, indicators:[] });
ok('改名成「竞争与合规风险」→ 不算缺失（双向包含匹配）', W2.missingTemplateCats('attractiveness').length === 0);
ok('竞争力 4 个一级都在 → 无缺失', W2.missingTemplateCats('competitiveness').length === 0);

// 回到缺「风险」，重渲染看按钮出现条件
w2.attractiveness.categories = att().filter(c => c.id !== 'cat_renamed');
const plate2 = makeNode('div', { class: 'plate' });
W2.render.framework({ querySelector: s => (s === '.plate' ? plate2 : null) });
const fillBtns = walk(plate2).filter(n => n.tag === 'button' && String((n.children[0] || {}).text || '').startsWith('AI 补齐'));
ok('两轴都常显补齐按钮：缺的点名、不缺的给通用文案',
  fillBtns.length === 2 &&
  fillBtns.some(b => b.children[0].text === 'AI 补齐一级：风险') &&
  fillBtns.some(b => b.children[0].text === 'AI 补齐缺失的一级'),
  JSON.stringify(fillBtns.map(b => b.children[0].text)));

// 未满 4 个时新增按钮不置灰：点吸引力轴「+ 一级维度」→ 第 4 个空名一级
const addAttBtn = buttons(plate2, '+ 一级维度')[0];
ok('只有 3 个一级时新增按钮不 disabled', addAttBtn.attrs.disabled == null);
addAttBtn.handlers.click();
const fourth = att()[3];
ok('未满 4 个时新增 → 空名、0.25 权重、indicators 为空',
  att().length === 4 && fourth.name === '' && fourth.weight === 0.25 &&
  Array.isArray(fourth.indicators) && !fourth.indicators.length,
  JSON.stringify(fourth));
att().pop();   // 撤掉测试一级：后续 AI 补齐仍从「3 个、缺风险」开始
ok('撤回测试一级 → 回到 3 个', att().length === 3);

// 点击直接跑（AGENTS.md：AI 生成类按钮不弹 confirm）
// 前面恢复模板换过 ind.id，先把评分重新对齐到当前指标集，才能真验“补齐不动评分”
w2.retained.forEach(m => {
  w2.scoring[m.id] = {};
  W2.allIndicators().forEach(i => { w2.scoring[m.id][i.id] = {score:7, evidence:'公开数据', url:'', source:'user'}; });
});
const catBefore = att().map(c => ({ id:c.id, name:c.name, rub:(c.indicators[0] || {}).rubric }));
w2.delphi.status = 'done'; w2.delphi.personas = [{ id:'p1', ratings:{} }]; w2.delphi.drifted = false;
apiCalls.length = 0; confirmMsgs.length = 0; toasts.length = 0;
fillBtns[0].handlers.click({ currentTarget: fillBtns[0] });
ok('点「AI 补齐一级」→ 不弹 confirm，直接走 aiButton 一次',
  apiCalls.length === 1 && confirmMsgs.length === 0, 'confirmMsgs=' + JSON.stringify(confirmMsgs));
ok('未回结果前不动数据', att().length === 3);
const promptText = JSON.stringify(apiCalls[0].buildPrompt());
ok('prompt 点名要补的一级并禁止重复生成', /风险/.test(promptText) && /不得重复生成/.test(promptText));
ok('prompt 带上已有一级清单', /经济/.test(promptText) && /社会文化/.test(promptText));

apiCalls[0].onResult({ categories: [
  { name: '风险', indicators: [
    { name: '竞争强度', rubric: { high:'h1', mid:'m1', low:'l1' } },
    { name: '技术迭代风险', rubric: { high:'h2', mid:'m2', low:'l2' } } ] },
  { name: '经济', indicators: [{ name: '重复项' }] }   // 已存在 → 必须丢弃
]});
ok('只追加缺的一级，AI 多给的「经济」被丢弃',
  att().length === 4 && att().filter(c => c.name === '经济').length === 1, JSON.stringify(att().map(c => c.name)));
const risk = att().find(c => c.name === '风险');
ok('补齐的一级带锚点、source=ai、默认权重 0.25 与二级均分',
  risk.indicators.length === 2 && risk.indicators[0].rubric.high === 'h1' && risk.weight === 0.25 &&
  risk.indicators.every(i => i.source === 'ai' && Math.abs(i.weight - 0.5) < 1e-9));
ok('已有一级/二级/锚点原样不动（按 id 逐个比）',
  catBefore.every(b => { const c = att().find(x => x.id === b.id); return !!c && c.name === b.name && c.indicators[0].rubric === b.rub; }));
ok('已打评分不孤儿化（旧 ind.id 的评分格全在）',
  W2.allIndicators().filter(i => i.axis === 'attractiveness' && i.source !== 'ai')
    .every(i => w2.scoring.m1[i.id] && w2.scoring.m1[i.id].score === 7));
ok('补齐 → 标偏离但保留 persona（不用重烧 N 次调用）',
  w2.delphi.drifted === true && w2.delphi.personas.length === 1 && w2.delphi.status === 'done');
ok('补齐后给了 toast', /已补齐 1 个一级维度：风险/.test(toasts.join('|')), toasts.join('|'));

// 无缺失 / AI 空返回
apiCalls.length = 0; toasts.length = 0;
W2.fillMissingCats('competitiveness', {}, plate2);
ok('本轴不缺 → 不调 AI，只提示无需补齐', apiCalls.length === 0 && /无需补齐/.test(toasts.join('|')), toasts.join('|'));
const attLen = att().length;
apiCalls.length = 0; toasts.length = 0;
att().splice(att().findIndex(c => c.name === '风险'), 1);
W2.fillMissingCats('attractiveness', {}, plate2);
apiCalls[0].onResult(null);
ok('AI 空返回 → 保留原值并提示', att().length === attLen - 1 && /已保留原值/.test(toasts.join('|')), toasts.join('|'));

/* ---- 满 4 个时 AI 补齐同样被上限挡住（两个入口同一口径）---- */
// 自定义一级占满名额：模板仍报「风险」缺失，但不允许再补
att().push({ id:'cat_esg', name:'ESG 与可持续性', weight:0.25, indicators:[] });
ok('4 个一级但自定义名不匹配 → 模板仍报「风险」缺失',
  att().length === 4 && W2.missingTemplateCats('attractiveness')[0][0] === '风险');
apiCalls.length = 0; toasts.length = 0;
W2.fillMissingCats('attractiveness', {}, plate2);
ok('已满 4 个 → AI 补齐不调用，只提示先删',
  apiCalls.length === 0 && att().length === 4 && /上限 4/.test(toasts.join('|')), toasts.join('|'));
att().pop();

// 名额在等待 AI 期间被手动占满：结果返回时不得再追加
W2.fillMissingCats('attractiveness', {}, plate2);
ok('3 个时点补齐 → 正常发出一次 AI 调用', apiCalls.length === 1);
att().push({ id:'cat_manual', name:'自定义一级', weight:0.25, indicators:[] });
toasts.length = 0;
apiCalls[0].onResult({ categories: [
  { name: '风险', indicators: [{ name: '竞争强度', rubric: { high:'h', mid:'m', low:'l' } }] }
]});
ok('等待期间加到 4 个 → AI 结果不采用、不超上限',
  att().length === 4 && !att().some(c => c.name === '风险') && /未采用/.test(toasts.join('|')),
  toasts.join('|') + ' :: ' + JSON.stringify(att().map(c => c.name)));
att().pop();

/* ---- AI 补齐：单个一级多给二级也只收 2 个 ---- */
// 前序用例走完后吸引力轴为 3 个（风险此前已删），直接调补齐
ok('前置：风险仍缺失', att().length === 3 && !att().some(c => c.name === '风险'));
apiCalls.length = 0;
W2.fillMissingCats('attractiveness', {}, plate2);
apiCalls[0].onResult({ categories: [
  { name: '风险', indicators: [1,2,3].map(n => ({ name: '指标'+n, rubric: { high:'h', mid:'m', low:'l' } })) }
]});
const riskAgain = att().find(c => c.name === '风险');
ok('AI 给 3 个二级 → 只收 2 个，权重均分 0.5',
  riskAgain.indicators.length === 2 && riskAgain.indicators.every(i => Math.abs(i.weight-0.5) < 1e-9),
  JSON.stringify(riskAgain.indicators.map(i => i.name)));

/* ---- 主流水线指标单元（2026-09-12 起每轴一个单元）：多给截断 / 少给补齐 ---- */
let pipeOpts = null;
sandbox.API.aiPipeline = opts => { pipeOpts = opts; };
W2.runFrameworkPipeline({}, {}, { sections:['sbu'] });
const attrUnit = pipeOpts.units.find(u => u.key === 'fw:indicators:attractiveness');
const compUnit = pipeOpts.units.find(u => u.key === 'fw:indicators:competitiveness');
const mkCats = n => Array.from({length:n}, (_,k) => ({
  name: 'C'+k, indicators: [1,2,3].map(j => ({ name:'I'+j, rubric:{high:'',mid:'',low:''} }))
}));
// AI 多给 5 一级 × 3 二级 → 截断为 4 × 2，权重 0.25 / 0.5
attrUnit.onResult({ categories: mkCats(5) });
compUnit.onResult({ categories: mkCats(5) });
ok('流水线指标结果截断为 4 个一级', w2.attractiveness.categories.length === 4 && w2.competitiveness.categories.length === 4);
ok('每个一级截断为 2 个二级，一级权重 0.25 / 二级权重 0.5',
  w2.attractiveness.categories.every(c => c.indicators.length === 2 &&
    Math.abs(c.weight-0.25) < 1e-9 && c.indicators.every(i => Math.abs(i.weight-0.5) < 1e-9)));
// AI 只给 2 个一级（自定义名）→ 用模板名补齐到 4，权重统一 0.25
attrUnit.onResult({ categories: mkCats(2) });
ok('AI 只给 2 个一级时按 4×2 模板补齐（不再接受残缺轴）',
  w2.attractiveness.categories.length === 4 &&
  w2.attractiveness.categories.slice(0,2).every((c,i)=>c.name==='C'+i) &&
  w2.attractiveness.categories.every(c=>Math.abs(c.weight-0.25)<1e-9),
  JSON.stringify(w2.attractiveness.categories.map(c=>c.name)));
// null / 缺 categories → 抛错（pipeline 据此降级手动箱，不 markDone）
ok('null 结果抛错', (()=>{ try{ attrUnit.onResult(null); return false; }catch(e){ return true; } })());
ok('空 categories 抛错', (()=>{ try{ attrUnit.onResult({categories:[]}); return false; }catch(e){ return true; } })());

/* ---- AI 锚点换键名/扁平写也要认（否则静默变空锚点、MVO 假失败）---- */
const full = n => ({ name:'一级'+n, indicators:[
  { name:'I1', high:'H', mid:'M', low:'L' },                       // 扁平英文键
  { name:'I2', rubric:{ 高分锚点:'好', 中分锚点:'中', 低分锚点:'差' } } // 中文嵌套键
]});
const fullFour = [full(1),full(2),full(3),full(4)];
attrUnit.onResult({ categories:fullFour });
compUnit.onResult({ categories:fullFour });
ok('扁平/中文键锚点都被识别', w2.attractiveness.categories.every(c=>
  c.indicators.every(i=>i.rubric.high && i.rubric.mid && i.rubric.low)),
  JSON.stringify(w2.attractiveness.categories[0].indicators.map(i=>i.rubric)));
ok('锚点值被 trim', w2.attractiveness.categories[0].indicators[0].rubric.high==='H');

/* ---- MVO：名称 + 高/中/低锚点齐全才算完整 ---- */
const mvoPass = () => W2.mvo.framework().checks[3].test();
ok('完整体系过 MVO', mvoPass() === true);
w2.attractiveness.categories[0].indicators[0].rubric.low = '   ';
ok('纯空格低分锚点不过 MVO（旧检查只看 high 真值会假通过）', mvoPass() === false);
w2.attractiveness.categories[0].indicators[0].rubric.low = 'L';
w2.attractiveness.categories[1].indicators[1].name = '';
ok('缺二级名称不过 MVO', mvoPass() === false);

/* ---- 悬空 tier id 消毒（MVO 假通过）---- */
w2.retained = [{ id:'m1', name:'德国' }, { id:'m2', name:'荷兰' }, { id:'m3', name:'瑞典' }];
w2.decision = {
  tier1: { marketId:'m_gone', rationale:'为什么选它', resourcesPct:60, milestones:['M1'], reEvalTrigger:'T' },
  tier2: { marketIds:['m2','m_gone'], observationMetrics:[] },
  tier3: { marketIds:['m_gone'] }
};
ok('消毒前 MVO 假通过（tier1 指向已不存在的市场）', W2.mvo.decision().checks[0].test() === true);
ok('pruneStaleTiers 报出改动', W2.pruneStaleTiers() === true);
ok('悬空 tier1 被清空', w2.decision.tier1.marketId === null);
ok('tier2/tier3 过滤掉悬空 id、保留合法的',
  w2.decision.tier2.marketIds.join() === 'm2' && w2.decision.tier3.marketIds.length === 0);
ok('消毒后 MVO 如实报未选主战场', W2.mvo.decision().checks[0].test() === false);
ok('pruneStaleTiers 幂等（第二次无改动）', W2.pruneStaleTiers() === false);
w2.decision.tier1.marketId = 'm1'; w2.decision.tier2.marketIds = ['m2']; w2.decision.tier3.marketIds = ['m3'];
ok('合法 tier id 不被误删', W2.pruneStaleTiers() === false &&
  w2.decision.tier1.marketId === 'm1' && w2.decision.tier2.marketIds.join() === 'm2' && w2.decision.tier3.marketIds.join() === 'm3');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
})().catch(e=>{console.error(e);process.exit(1);});
