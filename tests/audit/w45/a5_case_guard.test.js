/* A: 案例上下文必须让 W5 同步/汇总/4C 完全跳过。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
function ok(name, cond, detail){ if(cond){ pass++; console.log('PASS '+name); } else { fail++; console.log('FAIL '+name+(detail?' — '+detail:'')); } }
const document = {
  createElement: () => ({ appendChild(){}, setAttribute(){}, style:{} }),
  head:{appendChild(){}}, getElementById:()=>null, querySelector:()=>null
};
const counters = { save:0, archive:0, autosave:0, api:0 };
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean, document,
  el(){ return { appendChild(){ return this; } }; }, esc:s=>String(s??''),
  autosave(){ counters.autosave++; }, showToast(){}, confirm:()=>true,
  saveNow:async()=>{ counters.save++; return true; },
  Archive:{create:async()=>{ counters.archive++; return {}; }},
  state:null, Work1:{}, Work2:{}, Work3:{}, Work4:{}, Work5:{}, App:{}, Runner:{
    start(){ return {done:0,aborted:false,controller:{signal:{}}}; }, renderUI(){}, checkpoint(){ return Promise.resolve(); }, finish(){}
  },
  API:{ async call(){ counters.api++; return '生成文本'; }, async callJson(){ counters.api++; return {customerValue:'价值',customerCost:'成本',convenience:'便利',communication:'沟通'}; } },
  UI:{mountMvo(){},mountMark(){},mountGuard(){return true;},demoNote(){return null;}}, AiContext:{buildPrompt:()=>[]}, renderMatrix(){}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','..','docs','workshop5.js'),'utf8'), sandbox, {filename:'workshop5.js'});
const W5 = sandbox.Work5;
W5.rerender = ()=>{};
sandbox.Work2 = { selectedTiers:()=>({tier1:{marketId:'m1',name:'案例市场',rationale:'案例理由'},tier2:[]}), computeMatrix:()=>[{id:'m1',x:8,y:9}] };
sandbox.Work4 = { summaryText:k=>({product:'案例产品',price:'案例价格',place:'案例渠道',promotion:'案例促销',route:'案例路径'})[k]||'' };
function state(){
  return {
    meta:{demoCase:'demo-case',isDemo:false},
    work1:{sbu:{name:'案例 SBU',summary:'案例概述'},values:{},analysis:{},environment:{political:'案例政策'},personas:[]},
    work2:{},work3:{proposition:{chosenValueText:'案例主张'},identity:{}},work4:{},
    work5:W5.defaultData()
  };
}
async function main(){
  sandbox.state = state();
  const before = JSON.stringify(sandbox.state);
  await W5.autoSync();
  await W5._auto4C();
  W5.aggregateAll();
  W5.aggregateCh1();
  W5.importPestFromWork1();
  W5.importTargeting();
  W5.importPositioning();
  W5.import4P();
  await Promise.resolve();
  ok('案例内 autoSync/aggregate*/import*/_auto4C 不改 state', JSON.stringify(sandbox.state) === before, JSON.stringify(sandbox.state));
  ok('案例内不存盘/不建快照/不 autosave', counters.save===0 && counters.archive===0 && counters.autosave===0, JSON.stringify(counters));
  ok('案例内不调 LLM', counters.api===0, 'api='+counters.api);
  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail===0?0:1);
}
main().catch(e=>{ console.error(e); process.exit(1); });
