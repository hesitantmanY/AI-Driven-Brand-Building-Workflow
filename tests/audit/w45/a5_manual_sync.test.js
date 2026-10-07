/* A: autoSync 人工 W5 章节优先保留，显式 force 才覆盖。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
function ok(name, cond, detail){ if(cond){ pass++; console.log('PASS '+name); } else { fail++; console.log('FAIL '+name+(detail?' — '+detail:'')); } }
const document={createElement:()=>({appendChild(){},setAttribute(){},style:{}}),head:{appendChild(){}},getElementById:()=>null,querySelector:()=>null};
const counters={archive:0,autosave:0};
const sandbox={console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,document,
  el(){return {appendChild(){return this;}};},esc:s=>String(s??''),autosave(){counters.autosave++;},showToast(){},confirm:()=>true,
  saveNow:async()=>true,Archive:{create:async()=>{counters.archive++;return{id:'time_'+counters.archive,name:'合成'+counters.archive};}},state:null,
  Work1:{},Work2:{},Work3:{},Work4:{},Work5:{},App:{},Runner:{start(){return {done:0,aborted:false,controller:{signal:{}}};},renderUI(){},checkpoint(){return Promise.resolve();},finish(){}},
  API:{async call(){return '';},async callJson(){return{};}},UI:{mountMvo(){},mountMark(){},mountGuard(){return true;},demoNote(){return null;}},AiContext:{buildPrompt:()=>[]},renderMatrix(){}};
sandbox.window=sandbox; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','..','docs','lib','interaction.js'),'utf8'),sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','..','docs','workshop5.js'),'utf8'),sandbox,{filename:'workshop5.js'});
const W5=sandbox.Work5; W5.rerender=()=>{};
sandbox.Work2={selectedTiers:()=>({tier1:{marketId:'m1',name:'上游市场',rationale:'上游理由'},tier2:[]}),computeMatrix:()=>[{id:'m1',x:8,y:9}]};
sandbox.Work4={summaryText:k=>({product:'上游产品',price:'上游价格',place:'上游渠道',promotion:'上游促销',route:'上游路径'})[k]||''};
function fresh(){
  return {meta:{},work1:{sbu:{name:'上游 SBU',summary:'上游概述'},values:{},analysis:{},environment:{political:'上游政策'},personas:[]},
    work2:{},work3:{proposition:{chosenValueText:'上游主张'},identity:{}},work4:{},work5:W5.defaultData()};
}
async function main(){
  sandbox.state=fresh();
  const w=sandbox.state.work5;
  w.ch1_business='人工第 1 章';
  w.ch2_environment.political='人工政策';
  w.ch3_strategy.targeting='人工目标市场';
  w.ch3_strategy.positioning='人工定位';
  w.ch4_mix.product='人工产品';
  await W5.autoSync();
  ok('autoSync 不覆盖人工章节',
    w.ch1_business==='人工第 1 章' && w.ch2_environment.political==='人工政策'
    && w.ch3_strategy.targeting==='人工目标市场' && w.ch3_strategy.positioning==='人工定位'
    && w.ch4_mix.product==='人工产品', JSON.stringify(w));
  w.ch1_business='旧自动值';
  w.syncedValues={ch1_business:'旧自动值'};
  w.ch3_strategy.targeting='旧自动目标';
  w.syncedValues['ch3_strategy.targeting']='旧自动目标';
  await W5.autoSync();
  ok('未手改的自动值仍随上游刷新', w.ch1_business.includes('上游 SBU') && w.ch3_strategy.targeting.includes('上游市场'), JSON.stringify(w));
  w.ch1_business='人工覆盖';
  await W5.aggregateCh1(true);
  ok('force 明确覆盖并可恢复（本测试只验覆盖边界）', w.ch1_business.includes('上游 SBU'), w.ch1_business);
  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail===0?0:1);
}
main().catch(e=>{console.error(e);process.exit(1);});
