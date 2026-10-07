/* Node test: work1/3/4/5（含 work2）嵌套毒值兜底（DEBT-2）。
   healWork2 只治 work2 整片；嵌套容器类型错配（默认数组→字符串、默认对象→false）
   此前无兜底，渲染 TypeError 被 goStep 吞掉 → 步骤区空白。
   修复：App.healNested 按各坊 defaultData() 容器形状回退默认值，与 healWork2
   同挂 renderAll（所有 state 替换路径的必经点）。

   Run: node tests/nested_poison_heal.test.js
*/
'use strict';
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const W1 = () => ({ environment:{political:'', competitors:[]}, personas:[], scenarios:[] });
const W2 = () => ({ candidates: [], screening:{criteria:[]} });
const W3 = () => ({ corpus:{docs:[]}, pains:[] });
const W4 = () => ({ channels:[], warn:null });
const W5 = () => ({ plan:'' });
global.Work1 = { defaultData: W1 };
global.Work2 = { defaultData: W2 };
global.Work3 = { defaultData: W3 };
global.Work4 = { defaultData: W4 };
global.Work5 = { defaultData: W5 };
global.showToast = () => {};

const App = require(path.join(__dirname, '..', 'docs', 'lib', 'app.js'));

const healthy = () => ({ work1: W1(), work2: W2(), work3: W3(), work4: W4(), work5: W5() });

// 数组毒值：personas 被写成字符串 → 回退 []
{
  const st = healthy();
  st.work1.personas = 'x';
  st.work1.environment = { political: 'ok', competitors: ['a'] };
  ok('heals work1.personas string → default array',
     App.healNested(st) === true && Array.isArray(st.work1.personas) && st.work1.personas.length === 0);
  ok('healthy siblings kept', st.work1.environment.political === 'ok' && st.work1.environment.competitors[0] === 'a');
}

// 对象毒值：work3.corpus 被写成 false → 回退默认对象
{
  const st = healthy();
  st.work3 = { corpus: false, pains: [1] };
  App.healNested(st);
  ok('heals work3.corpus false → default object',
     st.work3.corpus && typeof st.work3.corpus === 'object' && Array.isArray(st.work3.corpus.docs));
  ok('non-container field kept', Array.isArray(st.work3.pains) && st.work3.pains[0] === 1);
}

// 整片毒值（work1/3/4/5 与 work2 同级）→ 默认模板
{
  const st = healthy();
  st.work4 = false;
  ok('heals work4 slice false → default template',
     App.healNested(st) === true && Array.isArray(st.work4.channels));
}

// 健康数据不动引用、不重建
{
  const st = healthy();
  const good = st.work1;
  good.personas = [{ id: 'p1' }];
  ok('healthy state untouched', App.healNested(st) === false && st.work1 === good && st.work1.personas[0].id === 'p1');
  ok('idempotent after heal', App.healNested(st) === false);
}

// 缺字段不补（归 mergeWithDefaults），只挡类型错配
{
  const st = healthy();
  delete st.work1.personas;
  ok('missing key left for mergeWithDefaults',
     App.healNested(st) === false && st.work1.personas === undefined);
}

// 元素级毒值不在本轮范围（ponytail 上限）：数组保持原样
{
  const st = healthy();
  st.work1.personas = ['x', 42];
  ok('array elements passed through (documented ceiling)',
     App.healNested(st) === false && st.work1.personas[0] === 'x');
}

console.log(fail ? `\n${fail} FAILED` : `\nall ${pass} passed`);
process.exit(fail ? 1 : 0);
