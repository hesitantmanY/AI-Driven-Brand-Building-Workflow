/* A4 红测试：案例上下文（demoCase 或 isDemo）下 Work4 写入口直接拒绝。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail == null ? '' : ' — ' + detail)); }
}
const toasts = [];
const sandbox = {
  console, JSON, Math, Object, Array, String, Number, Boolean, Date,
  setTimeout:()=>0, clearTimeout(){},
  document:{body:{dataset:{}},querySelector:()=>null,createElement:()=>({style:{},appendChild(){},addEventListener(){},setAttribute(){}})},
  el(){ return {appendChild(){return this;},addEventListener(){return this;},querySelector(){return null;}}; },
  uid:p=>p+'_id', autosave(){}, showToast:m=>toasts.push(String(m)), confirm:()=>true,
  state:null, Work1:{}, Work2:{}, Work3:{}, Work4:{}, UI:{}, App:{}, Runner:{}, API:{}
};
sandbox.window = sandbox;
sandbox.JsonExtract = require(path.join(__dirname, '..', '..', '..', 'docs', 'lib', 'json_extract.js'));
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'workshop4.js'), 'utf8'), sandbox, {filename:'workshop4.js'});
const W4 = sandbox.Work4;

function fresh(meta){
  return {
    meta:Object.assign({isDemo:false,demoCase:null}, meta),
    work1:{sbu:{name:'品牌'}}, work2:{}, work3:{proposition:{},identity:{}},
    work4:W4.defaultData()
  };
}

console.log('==== A4 / E：案例只读写入口闸门 ====');
for(const [label, meta] of [['demoCase',{demoCase:'case-a'}], ['isDemo',{isDemo:true}]]){
  sandbox.state = fresh(meta);
  const before = JSON.stringify(sandbox.state.work4);
  let aiCalls = 0;
  sandbox.API.aiButton = () => { aiCalls++; };
  toasts.length = 0;
  W4.runAiDraft('promotion', {short:'传播方案'}, {textContent:'AI 起草传播方案',disabled:false});
  ok(label + '：runAiDraft 不发起 LLM', aiCalls === 0, String(aiCalls));
  ok(label + '：runAiDraft 不写 state', JSON.stringify(sandbox.state.work4) === before);
  ok(label + '：runAiDraft 显式拒绝 toast', toasts.some(x=>x.includes('案例') && x.includes('不可')), JSON.stringify(toasts));

  const applied = W4.applyStepAll('promotion', '```json\n{"theme":"案例内改写"}\n```');
  ok(label + '：applyStepAll 直接拒绝', applied && applied.ok === false, JSON.stringify(applied));
  ok(label + '：applyStepAll 不写 state', JSON.stringify(sandbox.state.work4) === before);

  sandbox.state.work4.promotion.aiResult = '## 案例叙事';
  const adoptedBefore = JSON.stringify(sandbox.state.work4.promotion.adoptedSegments || {});
  W4.adoptAll('promotion');
  ok(label + '：adoptAll 不写 state', JSON.stringify(sandbox.state.work4.promotion.adoptedSegments || {}) === adoptedBefore);
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
