/* AC-W45-A: Cases.load() must return detached copies of case data. */
'use strict';
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const base = path.join(root, 'docs', 'cases');
const brand = 'douya-mama';
const fakeWindow = {};
function defaultData(tag){
  return {
    _tag: tag,
    nested: { value: 'default-' + tag, tags: ['default-' + tag] },
    list: [{ name: 'default-' + tag, children: [{ value: 1 }] }]
  };
}
fakeWindow.Work1 = { defaultData: () => defaultData('work1') };
fakeWindow.Work2 = { defaultData: () => defaultData('work2') };
fakeWindow.Work3 = { defaultData: () => defaultData('work3') };
fakeWindow.Work4 = { defaultData: () => defaultData('work4') };
fakeWindow.Work5 = { defaultData: () => defaultData('work5') };
global.window = fakeWindow;
global.document = { addEventListener(){} };

for (const wk of ['work1','work2','work3','work4','work5']) require(path.join(base, brand, wk + '.js'));
require(path.join(base, brand, 'index.js'));
const Cases = require(path.join(base, 'loader.js'));

function snapshot(v){ return JSON.stringify(v); }
const rawBefore = JSON.stringify(fakeWindow.__case_douya_mama.getState());
const before = JSON.parse(JSON.stringify(Cases.load(brand)));
const loaded = Cases.load(brand);
loaded.work4.place.onlineSelf.push('污染渠道');
loaded.work4.place.structure[0].children[0].share = -999;
loaded.work4.place.keyPartners[0].side = '污染归属';
loaded.work5.ch2_environment.strengths[0] = '污染证据';
const after = Cases.load(brand);
const rawAfter = JSON.stringify(fakeWindow.__case_douya_mama.getState());

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
ok('load 后修改返回数组/嵌套对象/结构 children 不污染再次 load', JSON.stringify(after) === JSON.stringify(before),
  'before=' + JSON.stringify(before.work4.place.structure[0].children[0]) + ' after=' + JSON.stringify(after.work4.place.structure[0].children[0]));
ok('load 返回值不共享案例模块底层可变引用', rawAfter === rawBefore,
  'raw changed: ' + rawBefore.slice(0,180) + ' => ' + rawAfter.slice(0,180));
ok('两次 load 结构与值完全相同', snapshot(after) === snapshot(before),
  'before=' + snapshot(before).slice(0,180) + ' after=' + snapshot(after).slice(0,180));
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
