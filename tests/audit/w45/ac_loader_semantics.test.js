/* AC-W45-B: loader partial/null/array/idempotence semantics. */
'use strict';
const assert = require('assert');
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const base = path.join(root, 'docs', 'cases');
const fakeWindow = {};
function defaultData(tag){
  return {
    id: 'default-' + tag,
    nested: { value: 'default-' + tag, tags: ['default-' + tag] },
    list: [{ name: 'default-' + tag, children: [{ value: 1 }] }]
  };
}
fakeWindow.Work1 = { defaultData: () => defaultData('work1') };
fakeWindow.Work2 = { defaultData: () => defaultData('work2') };
fakeWindow.Work3 = { defaultData: () => defaultData('work3') };
fakeWindow.Work4 = { defaultData: () => defaultData('work4') };
fakeWindow.Work5 = { defaultData: () => defaultData('work5') };
const caseState = {
  work1: { id: 'case-work1', nested: { value: 'case-work1' } },
  work2: null,
  work4: { id: 'case-work4', list: [{ name: 'case-list', children: [{ value: 2 }] }] },
  work5: { id: 'case-work5' }
};
fakeWindow.__case_douya_mama = {
  brand: 'douya-mama', label: 'case', summary: 'case', defaultWorks: ['work1','work2','work3','work4','work5'],
  getState(){ return caseState; }
};
global.window = fakeWindow;
global.document = { addEventListener(){} };
const Cases = require(path.join(base, 'loader.js'));

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function snapshot(v){ return JSON.stringify(v); }

let unknownThrew = false;
try { Cases.load('unknown-brand'); } catch (_) { unknownThrew = true; }
ok('未知 brand 抛错', unknownThrew);

const full = Cases.load('douya-mama');
ok('case 字段缺失回退 defaultData', full.work1.nested.tags[0] === 'default-work1', JSON.stringify(full.work1.nested));
ok('case 字段 null 回退 defaultData', full.work2.id === 'default-work2', JSON.stringify(full.work2));
ok('数组整体替换而非拼接', full.work4.list.length === 1 && full.work4.list[0].name === 'case-list', JSON.stringify(full.work4.list));

const beforeArray = JSON.parse(JSON.stringify(full.work4.list));
const another = Cases.load('douya-mama');
another.work4.list[0].children[0].value = 999;
const afterArray = Cases.load('douya-mama');
ok('数组按值拷贝，修改 load 结果不污染下一次 load', snapshot(afterArray.work4.list) === snapshot(beforeArray),
  snapshot(beforeArray) + ' => ' + snapshot(afterArray.work4.list));

const partial = Cases.load('douya-mama', { works: ['work1'] });
ok('部分加载：选中的 work1 用 case，未选中的 work2/work3/work4/work5 用 defaultData',
  partial.work1.id === 'case-work1' &&
  partial.work2.id === 'default-work2' &&
  partial.work3.id === 'default-work3' &&
  partial.work4.id === 'default-work4' &&
  partial.work5.id === 'default-work5',
  JSON.stringify([partial.work1.id, partial.work2.id, partial.work3.id, partial.work4.id, partial.work5.id]));

const empty = Cases.load('douya-mama', { works: [] });
ok('works:[] 表示没有选中 work，全部回落 defaultData',
  ['work1','work2','work3','work4','work5'].every((k) => empty[k].id === 'default-' + k),
  JSON.stringify(Object.fromEntries(['work1','work2','work3','work4','work5'].map(k => [k, empty[k].id]))));

const first = Cases.load('douya-mama', { works: ['work1','work4'] });
const second = Cases.load('douya-mama', { works: ['work1','work4'] });
try {
  assert.deepStrictEqual(first, second);
  ok('同输入 load 幂等', true);
} catch (e) {
  ok('同输入 load 幂等', false, e.message);
}
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
