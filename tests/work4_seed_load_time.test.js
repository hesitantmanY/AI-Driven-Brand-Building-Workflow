/* BIZ15 回归：示例渠道结构在加载期落位（defaultData / 迁移），渲染路径零写入。
   背景：渲染期种子 + autosave 使全新工作区首渲染即置脏、首屏显示「未保存」。
   平台既定模式（AGENTS.md）是迁移幂等 + 随加载落盘、不置脏。

   Run: node tests/work4_seed_load_time.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail? ' — ' + detail : '')); }
}

const src = fs.readFileSync(path.join(__dirname, '..', 'docs', 'workshop4.js'), 'utf8');
const sandbox = {
  console, JSON, Math, Object, Array, String, Number, Boolean, Date,
  setTimeout:()=>0, clearTimeout(){},
  document:{body:{dataset:{}},querySelector:()=>null,createElement:()=>({style:{},appendChild(){},addEventListener(){},setAttribute(){}})},
  el(){ return {appendChild(){return this;},addEventListener(){return this;},querySelector(){return null;}}; },
  uid:p=>p+'_id', mean:a=>0, median:a=>0, clamp:(v,lo,hi)=>v,
  autosave(){ sandbox.__autosaveCalls = (sandbox.__autosaveCalls||0) + 1; }, showToast(){}, confirm:()=>true,
  state:null, Work1:{}, Work2:{}, Work3:{}, Work4:{}, Work5:{}, UI:{}, App:{}, Runner:{}, API:{},
  JsonExtract:{structured:()=>null, lastError:''},
  Interaction:{deleteButton:a=>a, removeItem:async()=>{}, objectName:()=>'x', confirm:async()=>true}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, {filename:'workshop4.js'});
const W4 = sandbox.Work4;

// 1. defaultData 自带示例结构：全新工作区无需渲染期写入
const d = W4.defaultData();
ok('defaultData 结构即示例种子（非空）', Array.isArray(d.place.structure) && d.place.structure.length === 2,
   JSON.stringify(d.place.structure && d.place.structure.map(g=>g.name)));
ok('种子顺序 [线上,线下]', d.place.structure.map(g=>g.name).join(',') === '线上,线下');
ok('每次 defaultData 返回新副本', W4.defaultData().place.structure !== d.place.structure);

// 2. 迁移层：空结构补种子，幂等；且注册顺序在 migrateKeyPartners 之前
ok('migrateSeedStructure 已注册且先于 keyPartners',
   Array.isArray(W4.migrations) && W4.migrations[0] === W4.migrateSeedStructure &&
   W4.migrations[1] === W4.migrateKeyPartners, String(W4.migrations && W4.migrations.length));
const w4 = {place:{structure:[]}};
ok('空结构迁移后补种子', W4.migrateSeedStructure(w4) === true && w4.place.structure.length === 2,
   JSON.stringify(w4.place.structure.map(g=>g.name)));
ok('迁移幂等（二次无变更）', W4.migrateSeedStructure(w4) === false);
const custom = {place:{structure:[{name:'线上',children:[{name:'我的',share:100}]}]}};
ok('非空自定义结构不受迁移影响',
   W4.migrateSeedStructure(custom) === false && custom.place.structure[0].children[0].name === '我的');

// 3. 渲染路径零写入：place 渲染中不再有「空则填种子 + autosave」
const seedBlock = src.slice(src.indexOf('渠道结构（销售占比）'), src.indexOf('渠道结构表'));
ok('渲染块不再写种子', !/p\.structure\s*=\s*\[/.test(seedBlock), seedBlock.slice(0, 200));
ok('渲染块不再 autosave', !/autosave\(\)/.test(seedBlock), seedBlock.slice(0, 200));
ok('示例告知保留（isSeedStructure 判定）', /isSeedStructure/.test(seedBlock) && /已为你填入示例渠道结构/.test(seedBlock));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
