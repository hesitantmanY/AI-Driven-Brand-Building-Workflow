/* Node test: 案例数据完整性（2026-09-01 回归补测）
   背景：cases/ 拆分迁移只搬了 work1-3 → 载入案例后 work4(4P)/work5(策划书) 变白板。
   本测试用真实案例文件 + loader 走一遍 Cases.load()，断言 5 个案例的
   work4/work5 均为案例自身数据（非 defaultData 空壳）。
*/
'use strict';
const path = require('path');

const fakeWindow = {};
// 最小 WorkN.defaultData 占位：loader 的 deepMerge 兜底会用到
function makeDefaultData(tag){
  return { _tag: tag, name: 'default-' + tag };
}
fakeWindow.Work1 = { defaultData: () => makeDefaultData('work1') };
fakeWindow.Work2 = { defaultData: () => makeDefaultData('work2') };
fakeWindow.Work3 = { defaultData: () => makeDefaultData('work3') };
fakeWindow.Work4 = { defaultData: () => makeDefaultData('work4') };
fakeWindow.Work5 = { defaultData: () => makeDefaultData('work5') };

global.window = fakeWindow;
global.document = { addEventListener:()=>{} };

const BRANDS = ['douya-mama','xiaohuo-ji','wenqu-shuyuan','hengrui-zao','maohaizi-house'];
const base = path.join(__dirname, '..', 'docs', 'cases');

for(const brand of BRANDS){
  for(const wk of ['work1','work2','work3','work4','work5']){
    require(path.join(base, brand, wk + '.js'));
  }
  require(path.join(base, brand, 'index.js'));
}
require(path.join(base, 'loader.js'));
const Cases = fakeWindow.Cases;

let pass=0, fail=0;
function assert(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail? ' — ' + detail: '')); }
}

assert('5 个案例全部注册', BRANDS.every(b => Cases.has(b)));

for(const brand of BRANDS){
  const loaded = Cases.load(brand);
  const w4 = loaded.work4;
  const w5 = loaded.work5;

  assert(brand + ': work4 有案例渠道数据（onlineSelf 非空）',
    Array.isArray(w4.place.onlineSelf) && w4.place.onlineSelf.length > 0,
    JSON.stringify(w4.place && w4.place.onlineSelf));

  assert(brand + ': work4 渠道结构非空',
    Array.isArray(w4.place.structure) && w4.place.structure.length > 0,
    JSON.stringify(w4.place && w4.place.structure));

  // 一级分组契约：两组、线上在前。界面按索引取组（structure[0] 挂在「+ 线上二级」上），
  // 案例源数据必须自己写对——运行期 Work4.migrateKeyPartners 会归位，但本测试的 fake
  // Work4 没有 migrations，走的正是源数据顺序。契约见 docs/cases/SCHEMA.md。
  assert(brand + ': work4 place.structure 为 [线上,线下]',
    w4.place.structure.map(g => g && g.name).join(',') === '线上,线下',
    JSON.stringify((w4.place.structure || []).map(g => g && g.name)));

  assert(brand + ': work4 营销组合 5 段齐全',
    ['route','product','price','place','promotion'].every(k => w4[k]),
    JSON.stringify(Object.keys(w4)));

  // 2026-09-01 ADR 0012：封面/摘要/参考文献已删除，正文与 pTable 是 work5 的内容载体
  assert(brand + ': work5 第 1 章正文非空',
    typeof w5.ch1_business === 'string' && w5.ch1_business.length > 0,
    JSON.stringify((w5.ch1_business||'').slice(0,20)));

  assert(brand + ': work5 展望/pTable 非空',
    typeof w5.ch5_outlook === 'string' && w5.ch5_outlook.length > 0 &&
    w5.ch4_mix && w5.ch4_mix.pTable && typeof w5.ch4_mix.pTable.product === 'object' &&
    typeof w5.ch4_mix.pTable.product.core === 'string' && w5.ch4_mix.pTable.product.core.length > 0,
    'outlook=' + (w5.ch5_outlook||'').slice(0,10));

  // 2026-09-01 候选 3：valueChain 从 demo-data.js 迁入案例自包含
  assert(brand + ': work1 微笑曲线 valueChain 非空（案例自包含）',
    Array.isArray(loaded.work1.environment.valueChain) &&
    loaded.work1.environment.valueChain.length === 6 &&
    loaded.work1.environment.valueChain.every(n => n.label && typeof n.v === 'number'),
    JSON.stringify(loaded.work1.environment.valueChain && loaded.work1.environment.valueChain.slice(0,1)));
}

// 回归：本次修好的 toggleDemo 主路径 — load() 不带 works → work4 为案例值而非默认占位
const x = Cases.load('xiaohuo-ji');
// 组序不再是「案例 vs 默认」的判据：位置契约固定 [线上,线下]，默认种子同样是线上在前，
// 且浏览器里 migrateKeyPartners 会统一归位。用案例独有的二级渠道名来证明是案例值。
assert('xiaohuo-ji: work4 渠道数据为案例值（整体替换语义）',
  x.work4.place && x.work4.place.onlineSelf.length === 2 &&
  x.work4.place.onlineSelf[0] === '小镬记小程序' &&
  x.work4.place.structure.map(g => g.name).join(',') === '线上,线下' &&
  x.work4.place.structure[0].children[0].name === '小程序',
  JSON.stringify(x.work4.place && x.work4.place.structure));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0? 0: 1);
