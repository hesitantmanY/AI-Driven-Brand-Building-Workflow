/* Node test: W5 进入即同步（2026-09-01 wayfinder T03）。
   进入 W5 自动带入上游章节；有变化才存档并覆盖；人工产物不动。
   Run: node tests/work5_sync.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', 'docs');
let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
const document = {
  createElement: () => ({ appendChild(){}, setAttribute(){}, style:{} }),
  head: { appendChild(){} },
  getElementById: () => null,
  querySelector: () => null
};
const counters = { saveNow: 0, archive: 0, autosave: 0 };
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document,
  el(){ return { appendChild(){ return this; } }; },
  esc: s => String(s??''),
  autosave(){ counters.autosave++; },
  showToast(){}, confirm: () => true,
  saveNow: async () => { counters.saveNow++; return true; },
  Archive: { create: async () => { counters.archive++; return {id:'time_'+counters.archive,name:'合成'+counters.archive}; } },
  state: null,
  Work1: {}, Work2: {}, Work3: {}, Work4: {}, Work5: {}, App: {}, Runner: {}, API: {}, UI: { mountMvo(){}, mountMark(){}, mountGuard(){ return true; }, demoNote(){ return null; } },
  AiContext: { buildPrompt: () => [] },
  renderMatrix(){}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'lib/interaction.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'workshop5.js'), 'utf8'), sandbox, {filename:'workshop5.js'});
const W5 = sandbox.Work5;
W5.rerender = function(){};

let tier1 = { marketId:'m1', name:'印尼', rationale:'市场规模大且母婴渗透率在爬升' };
sandbox.Work2 = {
  selectedTiers: () => ({ v:2, tier1: tier1 ? { ...tier1 } : null, tier2: [{ name:'越南' }, { name:'泰国' }] }),
  computeMatrix: () => [{ id:'m1', x:8, y:9 }]
};
sandbox.Work4 = {
  summaryText: k => ({ route:'路径：先印尼后越南', product:'产品：成分透明配方奶粉', price:'价格：中高端三档', place:'渠道：线上自营+本地分销', promotion:'促销：主题「成分透明」' })[k] || ''
};

function freshState(){
  return {
    meta: {},
    work1: {
      sbu: { name:'豆芽妈妈', summary:'为新手妈妈提供成分透明的母婴产品。', category:'母婴', stage:'成长期', scope:'东南亚' },
      values: { chosenFunctional:'成分透明', chosenEmotional:'安心', chosenSocial:'科学育儿认同' },
      analysis: { insights: '制造是强项，品牌认知是短板。' },
      environment: { political:'政策稳定', economic:'', social:'', technological:'' },
      personas: []
    },
    work2: {},
    work3: {
      proposition: { chosenValueText:'为新手妈妈提供成分透明的母婴产品', positioningStatement:'面向注重成分的新手妈妈，豆芽妈妈是成分透明的母婴品牌' },
      identity: { mbti:'INTJ', personalityTraits:['专业'], chosenSlogan:'看得见的成分' }
    },
    work4: {},
    work5: W5.defaultData()
  };
}

async function main(){
  // 1. 首次进入：全量带入 + 存档一次
  sandbox.state = freshState();
  const st = sandbox.state;
  st.work5.ch5_outlook = '保留的展望';
  st.work5.ch2_environment.strengths = ['S1 保留'];
  const changed = await W5.autoSync();
  ok('首次进入返回 true（有变化）', changed === true);
  ok('ch1 带入 SBU', (st.work5.ch1_business||'').includes('业务单元：豆芽妈妈'));
  ok('PEST 带入', st.work5.ch2_environment.political === '政策稳定');
  ok('targeting 带入', (st.work5.ch3_strategy.targeting||'').includes('目标市场：印尼'));
  ok('positioning 带入', (st.work5.ch3_strategy.positioning||'').includes('价值主张：'));
  ok('4P 带入', (st.work5.ch4_mix.product||'').includes('成分透明配方奶粉'));
  ok('覆盖前存档恰好一次', counters.archive === 1 && counters.saveNow >= 1);
  ok('人工产物不被覆盖（展望/SWOT）',
    st.work5.ch5_outlook === '保留的展望'
    && st.work5.ch2_environment.strengths[0] === 'S1 保留');
  ok('lastAggregated 已写', !!st.work5.lastAggregated);

  // 2. 上游无变化：不重复存档
  const before = counters.archive;
  const again = await W5.autoSync();
  ok('上游无变化 → false 且不再存档', again === false && counters.archive === before);

  // 3. 上游变化：只更新变化字段，再存档一次
  tier1 = { marketId:'m1', name:'印尼', rationale:'改为：本地 KOL 生态成熟' };
  const after = await W5.autoSync();
  ok('上游变化 → 再同步 true', after === true);
  ok('targeting 理由已更新', (st.work5.ch3_strategy.targeting||'').includes('本地 KOL 生态成熟'));
  ok('再存档一次', counters.archive === before + 1);

  // 4. 上游为空 → 不覆盖已有人工文本
  sandbox.state = freshState();
  const s2 = sandbox.state;
  s2.work1 = { sbu:{}, values:{}, analysis:{}, environment:{}, personas:[] };
  s2.work3 = { proposition:{}, identity:{} };
  tier1 = null;
  sandbox.Work4.summaryText = () => '';
  s2.work5.ch1_business = '人工保留的第 1 章';
  const archiveBefore = counters.archive;
  const changed2 = await W5.autoSync();
  ok('上游全空 → 不覆盖人工文本', changed2 === false && s2.work5.ch1_business === '人工保留的第 1 章');
  ok('上游全空 → 不存档', counters.archive === archiveBefore);

  // 5. 存档期间用户已开始输入 → 二次比对保护，不覆盖用户输入
  sandbox.state = freshState();
  const s3state = sandbox.state;
  tier1 = { marketId:'m1', name:'印尼', rationale:'初次理由' };
  await W5.autoSync();
  tier1 = { marketId:'m1', name:'印尼', rationale:'更新后的理由' };
  const userArchive = sandbox.Archive.create;
  sandbox.Archive.create = async () => {
    s3state.work5.ch3_strategy.targeting = '用户在存档期间手打的文字';
    counters.archive++;
    return {id:'time_'+counters.archive,name:'合成'+counters.archive};
  };
  const archiveBefore2 = counters.archive;
  await W5.autoSync();
  ok('存档期间用户输入不被覆盖', s3state.work5.ch3_strategy.targeting === '用户在存档期间手打的文字');
  ok('存档期间新增输入重新存档后才覆盖', counters.archive === archiveBefore2 + 2);
  sandbox.Archive.create = userArchive;

  // 6. 决策 2026-09-01 二次：SWOT 改回手动按键；4C 仍空态自动；进入清洗垃圾与残留 **
  {
    sandbox.state = freshState();
    const s4 = sandbox.state;
    const callsAI = [];
    sandbox.API = { async callJson(){
      callsAI.push(1);
      return { customerValue:'客户价值要点', customerCost:'客户成本要点', convenience:'便利要点', communication:'沟通要点' };
    } };
    sandbox.AiContext = { buildPrompt: ({system, instruction}) =>
      [{role:'system', content:system}, {role:'user', content:instruction}] };
    s4.work5.ch4_mix.product = '产品：成分透明配方奶粉';
    await W5._auto4C();
    ok('4C 空 + 4P 有 → 自动生成', (s4.work5.ch4_mix.customerValue||'') === '客户价值要点');
    s4.work5.ch2_environment.strengths = ['＋1添加'];
    s4.work5.ch5_outlook = '**战略复盘** 正文';
    await W5._entryHeal();
    ok('进入清洗：SWOT 误输垃圾被清', (s4.work5.ch2_environment.strengths||[]).length === 0);
    ok('进入清洗：正文残留 ** 已剥', s4.work5.ch5_outlook === '战略复盘 正文');
    ok('SWOT 不再进页自动调 API', callsAI.length === 1);
    sandbox.API = {};
    await W5._auto4C();
    ok('无 API → 静默跳过不抛错', true);
  }

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
