/* 审计证据脚本（w345_crud）：Work3「选定指针」在编辑 / 删除候选后的悬空。

   跑法：node tests/audit/w345/w3_chosen_pointer.test.js
   红 = 当前代码有 bug。

   现象：价值主张候选的「选定」把文案抄进 chosenValueText（按值不按 id）。
   之后（a）删除这条候选、（b）把它的文案改掉（重命名），chosenValueText 都不动
   → 卡片无选中态、导出/W4/W5 仍用一条已经不存在的文案。
   Slogan 同理（chosenSlogan）；AI 整组重新生成时反而会清（1531 行），手动删/改不会。
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', '..', '..', 'docs');

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
    focus(){}, select(){}
  };
  Object.defineProperty(node, 'textContent', {
    get(){ return this._text != null ? this._text : (this.children||[]).map(collectText).join(''); },
    set(v){ this._text = String(v); }
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
  renderMatrix: () => {},
  backendOnline: false,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, App: { updateSummary(){}, updateArchiveLabel(){} }, Runner: {}, API: {},
  UI: {
    field: (label, ...kids) => { const f = document.createElement('div'); f.appendChild(document.createTextNode(label)); kids.flat().forEach(k => k && f.appendChild(k)); return f; },
    tagsInput: arr => { const root = document.createElement('div'); const inp = document.createElement('input'); root.appendChild(inp); return { el: root, get: () => arr, set(){} }; }
  },
  AiContext: { mountSettings: (c, cfg) => ({ current: () => ({ sections:(cfg.needs||[]).slice(), fewShot: cfg.fewShotKey || null }) }), buildPrompt: () => [] }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
sandbox.Interaction.confirm=async()=>true;
vm.runInContext(fs.readFileSync(path.join(root, 'workshop3.js'), 'utf8'), sandbox, { filename:'workshop3.js' });
const W3 = sandbox.Work3;
sandbox.API = {
  aiCtxBox: cfg => { const box = sandbox.el('div'); box.appendChild(sandbox.el('button', {}, cfg.label || '')); return { box, current: () => ({}) }; },
  aiPipeline: () => {}, callJson: async () => null, config: () => ({ apiKey:'' }),
  manualBox: () => {}
};

const walk = (n, out = []) => {
  if(!n || typeof n !== 'object') return out;
  out.push(n);
  (n.children || []).forEach(c => walk(c, out));
  return out;
};
const textOf = n => (n.nodeType === 3 ? String(n.text) : (n.children || []).map(textOf).join(''));
const buttons = (rootNode, label) => walk(rootNode).filter(n => n.tagName === 'BUTTON' && textOf(n) === label);
const textareas = rootNode => walk(rootNode).filter(n => n.tagName === 'TEXTAREA');

function renderStep(step, state){
  sandbox.state = state;
  const plate = sandbox.el('div', {class:'plate'});
  const sec = { querySelector: () => plate };
  W3.render[step](sec);
  return plate;
}

(async function(){
/* ---- A/B. 价值主张候选：删除 / 改名后 chosenValueText 悬空 ---- */
{
  const st = { work1:{ sbu:{ name:'品牌' } }, work3: W3.defaultData() };
  const p = st.work3.proposition;
  p.alternatives = [
    { id:'alt1', text:'为高龄父母提供看得见的安心' },
    { id:'alt2', text:'为新手爸妈提供省心方案' }
  ];
  p.chosenValueText = '为高龄父母提供看得见的安心';

  const plate = renderStep('proposition', st);
  const delBtns = buttons(plate, '删除');
  ok('A0 渲染出候选删除按钮', delBtns.length >= 2, 'got ' + delBtns.length);
  await delBtns[0]._listeners.click[0]({currentTarget:delBtns[0]}); // 删掉「已选定」的那条
  ok('A1 选定项被删后 chosenValueText 不再指向候选池外的文案',
     !p.chosenValueText || p.alternatives.some(a => a.text === p.chosenValueText),
     'chosenValueText="' + p.chosenValueText + '"，候选池=' + JSON.stringify(p.alternatives.map(a => a.text)));

  const st2 = { work1:{ sbu:{ name:'品牌' } }, work3: W3.defaultData() };
  const p2 = st2.work3.proposition;
  p2.alternatives = [{ id:'alt1', text:'为高龄父母提供看得见的安心' }, { id:'alt2', text:'B' }];
  p2.chosenValueText = '为高龄父母提供看得见的安心';
  const plate2 = renderStep('proposition', st2);
  const tas = textareas(plate2);
  const chosenArea = tas.find(t => /高龄父母/.test(t.textContent || ''));
  ok('B0 找到已选定候选的编辑框', !!chosenArea && !!chosenArea._listeners.input);
  chosenArea._listeners.input[0]({ target: { value:'为高龄父母提供看得见的安心（改）' } });
  ok('B1 改名（编辑候选文案）后 chosenValueText 同步或清空',
     !p2.chosenValueText || p2.alternatives.some(a => a.text === p2.chosenValueText),
     'chosenValueText="' + p2.chosenValueText + '"，候选池=' + JSON.stringify(p2.alternatives.map(a => a.text)));
}

/* ---- C. Slogan：删除已选定项 ---- */
{
  const st = { work1:{ sbu:{ name:'品牌' } }, work3: W3.defaultData() };
  const id = st.work3.identity;
  id.sloganOptions = ['看得见的安心', '省心的选择'];
  id.chosenSlogan = '看得见的安心';
  const plate = renderStep('identity', st);
  const delBtns = buttons(plate, '删除');
  ok('C0 渲染出 Slogan 删除按钮', delBtns.length >= 2, 'got ' + delBtns.length);
  await delBtns[0]._listeners.click[0]({currentTarget:delBtns[0]});
  ok('C1 删掉已选定 Slogan 后 chosenSlogan 清空',
     !id.chosenSlogan, 'chosenSlogan="' + id.chosenSlogan + '"，候选=' + JSON.stringify(id.sloganOptions));
}

/* ---- D. Slogan：改名已选定项后 chosenSlogan 跟随 ---- */
{
  const st = { work1:{ sbu:{ name:'品牌' } }, work3: W3.defaultData() };
  const id = st.work3.identity;
  id.sloganOptions = ['看得见的安心', '省心的选择'];
  id.chosenSlogan = '看得见的安心';
  const plate = renderStep('identity', st);
  const ins = walk(plate).filter(n => n.tagName === 'INPUT' && n.attrs && n.attrs.value === '看得见的安心');
  ok('D0 找到已选定 Slogan 的编辑框', ins.length === 1 && !!ins[0]._listeners.input, 'got ' + ins.length);
  if(ins.length){ ins[0]._listeners.input[0]({ target:{ value:'看得见的安心（改）' } }); }
  ok('D1 改名已选定 Slogan 后 chosenSlogan 同步或清空',
     !id.chosenSlogan || id.sloganOptions.includes(id.chosenSlogan),
     'chosenSlogan="' + id.chosenSlogan + '"，候选=' + JSON.stringify(id.sloganOptions));
}

/* ---- E. Slogan：改名未选定项后再点「选定」，不得按旧文案悬空 ---- */
{
  const st = { work1:{ sbu:{ name:'品牌' } }, work3: W3.defaultData() };
  const id = st.work3.identity;
  id.sloganOptions = ['A', 'B'];
  id.chosenSlogan = '';
  const plate = renderStep('identity', st);
  const ins = walk(plate).filter(n => n.tagName === 'INPUT' && n.attrs && n.attrs.value === 'B');
  ok('E0 找到未选定 Slogan 的编辑框', ins.length === 1 && !!ins[0]._listeners.input, 'got ' + ins.length);
  if(ins.length){ ins[0]._listeners.input[0]({ target:{ value:'B改' } }); }
  const choose = buttons(plate, '选定');
  ok('E1 渲染出 Slogan 选定按钮', choose.length >= 2, 'got ' + choose.length);
  if(choose.length >= 2){ choose[1]._listeners.click[0](); }
  ok('E2 改名后点「选定」，chosenSlogan 必须指向候选池内文案',
     !!id.chosenSlogan && id.sloganOptions.includes(id.chosenSlogan),
     'chosenSlogan="' + id.chosenSlogan + '"，候选=' + JSON.stringify(id.sloganOptions));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
sandbox.Interaction.invalidateUndo();
process.exit(fail ? 1 : 0);
})().catch(error=>{console.error(error);process.exit(1);});
