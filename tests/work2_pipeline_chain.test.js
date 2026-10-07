/* Node test: Work2 主流水线单元间链式传参（2026-09-01）。
   现象：runFrameworkPipeline 的 mk() 在点击时就把 instruction 拼成字符串冻结，
   轮到「1.3 应用筛选」执行时，1.1/1.2 刚写入 state 的候选/标准不在提示词里
   （点击时是空清单 → AI 从空清单幻觉出候选之外的市场：墨西哥/哥斯达黎加/巴拿马）。
   修复：instruction 支持函数，buildPrompt 执行时才读 state。

   Run: node tests/work2_pipeline_chain.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'docs');
let capturedUnits = null;
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document: { body: { dataset: {} }, querySelector: () => null },
  uid: (p='id') => p + '_' + Math.random().toString(36).slice(2, 9),
  clamp: (v,lo,hi) => Math.max(lo, Math.min(hi, v)),
  median: a => 0, mean: a => 0,
  autosave: () => {},
  showToast: () => {},
  el: (tag, attrs, ...children) => ({
    tag, attrs: attrs || {}, style: {}, dataset: {},
    appendChild(){}, addEventListener(){}, classList:{add(){},remove(){},toggle(){},contains(){return false;}}
  }),
  state: null,
  Work2: {},
  UI: {}, App: {}, Runner: {},
  AiContext: {
    mountSettings: () => ({ current: () => ({ sections: ['sbu'] }) }),
    buildPrompt: ({system, instruction}) => [{role:'system',content:system},{role:'user',content:String(instruction)}],
    fewShotText: () => ''
  },
  API: { aiPipeline: opts => { capturedUnits = opts.units; } }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'workshop2.js'), 'utf8'), sandbox, {filename:'workshop2.js'});
const W2 = sandbox.Work2;
sandbox.state = {
  work1: { sbu: { name: '智能温度控制器' }, personas: [] },
  work2: W2.defaultData()
};
sandbox.state.work2._pipeDone = [];

let pass=0, fail=0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail? ' — ' + detail : '')); }
}

// 启动流水线（此刻 candidates/criteria 为空）
W2.runFrameworkPipeline({addEventListener(){}}, {}, {});
ok('pipeline captured 5 units', Array.isArray(capturedUnits) && capturedUnits.length === 5);
// 空结果不能被流水线标成完成：候选单元必须抛错交给手动箱/断点续跑。
{
  let threw=false;
  try{ capturedUnits[0].onResult(null); }catch(e){ threw=true; }
  ok('候选单元收到 null 直接抛错（不静默完成）', threw);
}
ok('指标拆成两轴单元', capturedUnits[3].key==='fw:indicators:attractiveness'
  && capturedUnits[4].key==='fw:indicators:competitiveness');

// 模拟串行执行：单元 1（候选）和 2（标准）已写回 state
capturedUnits[0].onResult({ candidates: [
  {name:'英国', reason:'r1'}, {name:'德国', reason:'r2'}, {name:'日本', reason:'r3'}
]});
capturedUnits[1].onResult({ criteria: [{name:'住宅电价高于全美均值', source:'EIA'}] });
ok('unit1 wrote candidates', sandbox.state.work2.candidates.length === 3);
ok('unit2 wrote criteria', sandbox.state.work2.screening.criteria.length === 1);

// 单元 3（应用筛选）的提示词必须包含前序单元刚写入的数据
const u3prompt = JSON.stringify(capturedUnits[2].buildPrompt());
ok('unit3 prompt contains fresh candidates', u3prompt.includes('英国') && u3prompt.includes('德国'),
  'prompt: ' + u3prompt.slice(0, 200));
ok('unit3 prompt contains fresh criteria', u3prompt.includes('住宅电价高于全美均值'));
// 2026-09-01：region/population/gdpPerCapita 不得留空——空串占位示例会被模型照抄成空值
ok('unit3 prompt demands filled region/population/gdp', u3prompt.includes('不得留空'));

// 单元 4/5（指标）：null（典型为超长截断后两次解析失败）必须抛错，
// pipeline 的 catch 才会降级手动箱且不 markDone——旧逻辑静默 return 却判完成。
let threw = false;
try { capturedUnits[3].onResult(null); } catch(e){ threw = true; }
ok('吸引力单元收到 null 直接抛错（不静默完成）', threw);
threw = false;
try { capturedUnits[3].onResult({}); } catch(e){ threw = true; }
ok('吸引力单元收到缺 categories 的 JSON 也抛错', threw);

// 少给归一化：3 个一级（其中一个只给 1 个二级）→ 补到 4×2
capturedUnits[3].onResult({ categories: [
  { name:'经济', indicators:[{name:'市场规模',rubric:{high:'h',mid:'m',low:'l'}},{name:'景气度',rubric:{high:'h',mid:'m',low:'l'}}]},
  { name:'政治法律', indicators:[{name:'贸易摩擦',rubric:{high:'h',mid:'m',low:'l'}}]},
  { name:'社会文化', indicators:[{name:'需求强度',rubric:{high:'h',mid:'m',low:'l'}},{name:'文化匹配',rubric:{high:'h',mid:'m',low:'l'}}]}
]});
const ac = sandbox.state.work2.attractiveness.categories;
ok('吸引力补到 4 个一级（缺的「风险」按模板名补）', ac.length===4 && ac[3].name==='风险',
  JSON.stringify(ac.map(c=>c.name)));
ok('每个一级恰好 2 个二级、权重 0.25/0.5', ac.every(c=>c.indicators.length===2
  && Math.abs(c.weight-0.25)<1e-9 && c.indicators.every(i=>Math.abs(i.weight-0.5)<1e-9)));
ok('缺二级补的是空行（空名 + 空锚点）', ac[1].indicators[1].name===''
  && ac[1].indicators[1].rubric.mid==='');

// 多给截断：5 一级 × 3 二级 → 4 × 2
capturedUnits[4].onResult({ categories: Array.from({length:5}, (_,k)=>({
  name:'C'+k, indicators:[1,2,3].map(j=>({name:'I'+j,rubric:{high:'',mid:'',low:''}}))
}))});
const cc = sandbox.state.work2.competitiveness.categories;
ok('竞争力多给截断为 4×2', cc.length===4 && cc.every(c=>c.indicators.length===2));

console.log(fail ? `\n${fail} FAILED` : `\nall ${pass} passed`);
process.exit(fail ? 1 : 0);
