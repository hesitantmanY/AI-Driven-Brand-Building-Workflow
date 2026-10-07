/* Work2 migrate contract: migration functions must not call showToast. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const toasts = [];
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document: { body: { dataset: {} }, querySelector: () => null },
  uid: p => p + '_id', mean: a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0,
  median: () => 0, clamp: (v,lo,hi) => Math.max(lo, Math.min(hi, v)),
  autosave(){}, showToast(msg){ toasts.push(String(msg)); },
  state: null, Work2: {}, UI: {}, App: {}, Runner: {}, API: {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop2.js'), 'utf8'), sandbox, {filename:'workshop2.js'});
const W2 = sandbox.Work2;
const v1 = {
  scope: {question:'q'},
  attractiveness: {indicators:[{id:'a1',name:'经济规模',rubric:{high:'h',mid:'m',low:'l'}}]},
  competitiveness: {indicators:[{id:'b1',name:'渠道可达',rubric:{high:'',mid:'',low:''}}]},
  markets: [{id:'m1',name:'A'},{id:'m2',name:'B'},{id:'m3',name:'C'},{id:'m4',name:'D'}]
};
let pass = 0, fail = 0;
const ok = (name, cond, detail) => cond ? (pass++, console.log('PASS ' + name))
  : (fail++, console.log('FAIL ' + name + (detail ? ' — ' + detail : '')));

W2.migrateWork2(JSON.parse(JSON.stringify(v1)));
ok('migrateWork2 does not call showToast', toasts.length === 0, toasts.join(' | '));
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
