/* Node test: Work4 关键伙伴 side（ticket 03/04/06 清单）。
   覆盖 partnerList 宽进解析矩阵、旧存档迁移（词表 + 结构归位）、
   applyStepAll 写入、summaryText 含本地渠道关系、≠100 callout 纯函数。
   Run: node tests/work4_partners.test.js
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

const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document: {
    body: { dataset: {} },
    querySelector: () => null,
    createElement: () => ({ style:{}, appendChild(){}, addEventListener(){}, setAttribute(){} })
  },
  el: () => ({ appendChild(){ return this; }, querySelector(){ return null; }, addEventListener(){ return this; } }),
  uid: p => 'id_' + Math.random().toString(36).slice(2, 9),
  autosave(){}, showToast(){}, confirm: () => true,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, Work4: {}, UI: {}, App: {}, Runner: {}, API: {}
};
const JE = require(path.join(__dirname, '..', 'docs', 'lib', 'json_extract.js'));
sandbox.JsonExtract = JE;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'lib', 'interaction.js'), 'utf8'), sandbox, {filename:'lib/interaction.js'});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop4.js'), 'utf8'), sandbox, {filename:'workshop4.js'});
const W4 = sandbox.Work4;

function stateWithPlace(place){
  return {
    work1:{sbu:{name:'X'}}, work2:{}, work3:{},
    work4:{ route:{scope:'domestic'}, place: Object.assign(W4.defaultData().place, place) }
  };
}

// 1. partnerList 宽进矩阵
{
  const r1 = JE.structured('```json\n[{"name":"A","side":"线上"},"B",{"name":"C"},{"name":"D","side":"线下"}]```', 'partnerList');
  ok('JSON 数组：字符串项升格 + side 保留', r1.ok === true
    && r1.value[0].name === 'A' && r1.value[0].side === '线上'
    && r1.value[1].name === 'B' && r1.value[1].side === null, JSON.stringify(r1));
  const r2 = JE.structured('```json\n[{"name":"A","side":"中间"},{"name":"B","side":"线上"},{"side":"线下"}]```', 'partnerList');
  ok('side 非法/缺失归 null，缺 name 丢弃不毁整组', r2.ok === true && r2.value.length === 2
    && r2.value[0].side === null && r2.value[1].side === '线上', JSON.stringify(r2));
  const r3 = JE.structured('MCN、小红书 KOC\n区域经销', 'partnerList');
  ok('JSON 全挂退顿号/换行切分且未分类', r3.ok === true && r3.value.length === 3
    && r3.value[0].name === 'MCN' && r3.value[0].side === null
    && r3.value[2].name === '区域经销', JSON.stringify(r3));
  const r3b = JE.structured('- MCN\n• 小红书 KOC\n- 区域经销', 'partnerList');
  ok('分隔兜底剥列表符', r3b.ok === true && r3b.value.every(p => !/^[-•*·]/.test(p.name)),
    JSON.stringify(r3b));
  const r4 = JE.structured('```json\n[{"side":"线上"}]```', 'partnerList');
  ok('全组缺 name → 解析失败不清空', r4.ok === false && /empty after clean/.test(r4.reason));
  const r5 = JE.structured('```json\n"小红书 KOC、抖音 MCN"\n```', 'partnerList');
  ok('JSON 字符串值（非数组）也退顿号切分',
    r5.ok === true && r5.value.length === 2
    && r5.value[0].name === '小红书 KOC' && r5.value[1].name === '抖音 MCN',
    JSON.stringify(r5));
}

// 2. 迁移：string[] 升格 + 词表 + 结构归位 + 幂等
{
  const old = {
    place: {
      keyPartners: ['小红书 KOC', '儿科医生顾问', 'Amazon 卖家', 'KA 商超', '任意伙伴'],
      structure: [
        { name:'线下', children:[{name:'门店', share:60}] },
        { name:'线上', children:[{name:'官网', share:40}] }
      ]
    }
  };
  W4.migrations[0](old);
  ok('迁移后为对象数组且不丢数据', old.place.keyPartners.length === 5
    && old.place.keyPartners.every(p => p && typeof p === 'object' && p.name));
  const sideOf = n => (old.place.keyPartners.find(p => p.name === n) || {}).side;
  ok('词表命中：小红书 KOC → 线上', sideOf('小红书 KOC') === '线上');
  ok('词表命中：KA 商超 → 线下', sideOf('KA 商超') === '线下');
  ok('词表命中：Amazon 卖家 → 线上', sideOf('Amazon 卖家') === '线上');
  ok('未命中归未分类', sideOf('儿科医生顾问') === '' && sideOf('任意伙伴') === '');
  ok('结构 [线下,线上] 归位为 [线上,线下]', old.place.structure[0].name === '线上' && old.place.structure[1].name === '线下');
  const before = JSON.stringify(old);
  W4.migrations[0](old);
  ok('二次跑幂等', JSON.stringify(old) === before);

  const single = { place:{ keyPartners:[{name:'儿科医生顾问',side:'线下'}], structure:[{name:'线上',children:[{name:'淘宝',share:100}]}] } };
  W4.migrations[0](single);
  ok('单组结构自动补缺失位置桶', single.place.structure.length === 2
    && single.place.structure[0].name === '线上' && single.place.structure[1].name === '线下'
    && single.place.structure[1].children.length === 0, JSON.stringify(single.place.structure));
}

// 3. applyStepAll('place') 写入 keyPartners
{
  sandbox.state = stateWithPlace({});
  const r = W4.applyStepAll('place', '```json\n{"keyPartners":[{"name":"豆芽 MCN","side":"线上"},{"name":"儿科医生顾问"},{"name":"","side":"线下"},"本地渠道商"]}\n```');
  const partners = sandbox.state.work4.place.keyPartners;
  ok('partners 分支应用成功', r.ok === true && partners.length === 3);
  ok('AI 返回的 side 保留', partners[0].side === '线上');
  ok('side 缺失归 null（未分类提示行用）', partners[1].side === null);
  ok('字符串项升格且侧 null', partners[2].name === '本地渠道商' && partners[2].side === null);

  sandbox.state = stateWithPlace({});
  const r2 = W4.applyStepAll('place', '```json\n{"structure":[{"name":"线下","children":[{"name":"门店","share":60}]},{"name":"线上","children":[{"name":"官网","share":40}]}]}\n```');
  const st = sandbox.state.work4.place.structure;
  ok('AI 结构 [线下,线上] 自动归位为 [线上,线下]', r2.ok === true
    && st.length === 2 && st[0].name === '线上' && st[1].name === '线下', JSON.stringify(st));
}

// 4. summaryText('place') 补 localChannelRelations + 伙伴按 name 输出
{
  sandbox.state = stateWithPlace({
    keyPartners:[{name:'豆芽 MCN',side:'线上'},{name:'儿科医生顾问',side:'线下'}],
    channelIncentives:'返点 10%',
    localChannelRelations:'本地账期 60 天'
  });
  const txt = W4.summaryText('place');
  ok('summaryText 含伙伴名', txt.includes('关键伙伴：豆芽 MCN、儿科医生顾问'));
  ok('summaryText 含本地渠道关系', txt.includes('本地渠道关系：本地账期 60 天'));
  ok('summaryText 仍含渠道激励', txt.includes('渠道激励：返点 10%'));
}

// 5. ≠100 callout 纯函数
{
  ok('合计 100 不提示', W4.structureMismatches([{name:'线上', children:[{name:'A',share:100}]}]).length === 0);
  const m = W4.structureMismatches([{name:'线上', children:[{name:'A',share:95}]}, {name:'线下', children:[{name:'B',share:100}]}]);
  ok('合计 95 提示且只列问题组', m.length === 1 && m[0].name === '线上' && m[0].total === 95, JSON.stringify(m));
}

// 6. partnerBox 段控（03 号票 (a) 的 UI 契约：两键切换/再点取消/手动新增默认未分类）
{
  function textOf(n){
    if(typeof n === 'string') return n;
    if(n && typeof n.text === 'string') return n.text;
    let out = n._html || '';
    for(const c of (n.children || [])) out += textOf(c);
    return out;
  }
  function allButtons(n, out){
    if(!n || typeof n !== 'object') return out;
    if(n.tagName === 'button') out.push(n);
    for(const c of (n.children || [])) allButtons(c, out);
    return out;
  }
  function fire(btn, type){
    const fns = btn._listeners && btn._listeners[type];
    if(fns && fns.length) fns[0]({ preventDefault(){}, target:{ value: btn.value || '' } });
  }
  sandbox.el = (tag, attrs = {}, ...children) => {
    const e = {
      tagName: String(tag), className:'', attrs:{}, children:[], _html:'', value:'',
      _listeners:{},
      set innerHTML(v){ this._html = String(v); this.children = []; },
      get innerHTML(){ return this._html; },
      appendChild(c){ this.children.push(c); return c; },
      addEventListener(type, fn){ (this._listeners[type] = this._listeners[type] || []).push(fn); }
    };
    for(const [k,v] of Object.entries(attrs)){
      if(k === 'class') e.className = v;
      else if(k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if(typeof v === 'boolean'){ if(v) e.attrs[k] = ''; }
      else if(v != null) e.attrs[k] = v;
    }
    for(const c of children.flat()){
      if(c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? { text:c, children:[] } : c);
    }
    return e;
  };
  let last = null;
  const box = W4.partnerBox([
    { name:'豆芽 MCN', side:'线上' },
    { name:'儿科医生顾问', side:'' }
  ], v => { last = v; });
  const buttons = allButtons(box, []);
  ok('partnerBox 每个伙伴有 线上/线下/删除 三键', buttons.length === 6, String(buttons.length));
  const label = b => textOf(b).trim();
  const chip1 = box.children[0];
  const chip1Buttons = allButtons(chip1, []);
  fire(chip1Buttons.find(b => label(b) === '线下'), 'click');
  ok('点亮键可切换 side', last && last[0].side === '线下' && last[1].side === '');
  const chip1After = box.children[0];
  const chip1ButtonsAfter = allButtons(chip1After, []);
  fire(chip1ButtonsAfter.find(b => label(b) === '线下'), 'click');
  ok('点亮的键再点一次取消回未分类', last && last[0].side === '');
  const input = box.children[box.children.length - 1];
  input.value = '新伙伴';
  const keydowns = input._listeners && input._listeners.keydown;
  keydowns[0]({ key:'Enter', preventDefault(){}, target: input });
  ok('手动新增默认未分类', last && last[2] && last[2].name === '新伙伴' && last[2].side === '');
}

// 7. ≠100 callout 实时刷新（行内编辑走 refreshCharts，不能等整步重渲染）
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop4.js'), 'utf8');
  ok('render.place 常驻 mismatch 宿主（data-channel-mismatch）', src.includes('data-channel-mismatch'));
  ok('结构表输入刷新 mismatch callout',
    src.includes("if(stepId === 'place') Work4.refreshStructureMismatches(stepId);")
    && typeof W4.refreshStructureMismatches === 'function'
    && typeof W4.renderStructureMismatches === 'function');
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
