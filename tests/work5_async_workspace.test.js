/* Late or aborted AI responses cannot write across W5 workspace boundaries. */
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
let saves=0, calls=[], toasts=[];
const sandbox={console,Date,Math,JSON,Object,Array,String,Number,Boolean,Promise,
  AbortController,setTimeout,clearTimeout,
  Work5:{},Work1:{},Work2:{},Work3:{},Work4:{},UI:{},App:{},
  document:{},el(){return {};},autosave(){saves++;},showToast(message){toasts.push(message);},
  AiContext:{buildPrompt:()=>[]},API:{
    call(){return new Promise(resolve=>calls.push(resolve));},
    callJson(){return new Promise(resolve=>calls.push(resolve));}
  },Runner:{
    current:null,
    start(options){
      if(this.current)return null;
      return this.current={...options,controller:new AbortController(),done:0,aborted:false};
    },
    abort(){if(this.current){this.current.aborted=true;this.current.controller.abort();}},
    finish(){this.current=null;},renderUI(){},checkpoint:async()=>{}
  }
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../docs/workshop5.js'),'utf8'),sandbox);
const W5=sandbox.Work5;
W5.rerender=()=>{};
W5.w1DeltaRows=()=>[{dim:'品牌',name:'可信度',self:4,actual:7,delta:3}];
function fresh(){
  sandbox.Runner.current=null;saves=0;calls=[];toasts=[];
  sandbox.state={meta:{},settings:{manualMode:false,api:{apiKey:'synthetic'}},
    work1:{sbu:{name:'合成品牌'}},work2:{},work3:{proposition:{}},work4:{},work5:W5.defaultData()};
  return sandbox.state;
}
async function response(value){assert(calls.length,'Expected a synthetic pending AI call');calls.shift()(value);await Promise.resolve();}

(async()=>{
  let count=0;
  async function test(label,fn){await fn();count++;console.log('PASS '+label);}
  await test('总结展望的迟到结果不写入新工作区',async()=>{
    fresh();const pending=W5.aiOutlook(null);
    const next={...sandbox.state,work5:W5.defaultData()};next.work5.ch5_outlook='新的正文';sandbox.state=next;
    await response('旧请求的总结');await pending;
    assert.equal(next.work5.ch5_outlook,'新的正文');assert.equal(saves,0);assert.equal(toasts.length,0);
  });
  await test('单调用中止后忽略不遵守signal的迟到结果',async()=>{
    const state=fresh();state.work5.ch5_outlook='原正文';const pending=W5.aiOutlook(null);
    sandbox.Runner.abort();await response('中止后的响应');await pending;
    assert.equal(state.work5.ch5_outlook,'原正文');assert.equal(saves,0);
  });
  await test('SWOT 迟到响应不写原案例/新工作区也不标脏',async()=>{
    const old=fresh();const pending=W5.aiSwot(null);
    sandbox.state={...old,work5:W5.defaultData()};
    await response({strengths:['旧结果']});await pending;
    assert.equal(old.work5.ch2_environment.strengths.length,0);
    assert.equal(sandbox.state.work5.ch2_environment.strengths.length,0);assert.equal(saves,0);
  });
  await test('4C 补空生成保留等待期间的新手动输入',async()=>{
    const state=fresh();const pending=W5._gen4C(undefined,true);
    state.work5.ch4_mix.customerValue='等待期间的手动输入';
    await response({customerValue:'旧补空结果',customerCost:'合成成本'});await pending;
    assert.equal(state.work5.ch4_mix.customerValue,'等待期间的手动输入');
    assert.equal(state.work5.ch4_mix.customerCost,'合成成本');
  });
  await test('4P 摘要的迟到结果不写入新表格',async()=>{
    const old=fresh();old.work5.ch4_mix.product='原产品';const pending=W5.aiSummary4P(null);
    const next={...old,work5:W5.defaultData()};sandbox.state=next;
    const before=JSON.stringify(next.work5.ch4_mix.pTable);
    await response({product:{core:'旧核心',actions:'· 旧举措',nums:'20'}});await pending;
    assert.equal(JSON.stringify(next.work5.ch4_mix.pTable),before);assert.equal(saves,0);
  });
  await test('反应机制中止保留原正文',async()=>{
    const state=fresh();state.work5.ch4_mix.reactionMechanism='原反应正文';const pending=W5.aiReaction(null);
    sandbox.Runner.abort();await response('旧反应结果');await pending;
    assert.equal(state.work5.ch4_mix.reactionMechanism,'原反应正文');assert.equal(saves,0);
  });
  await test('4P 多单元在工作区替换后停止，不污染新字段',async()=>{
    const old=fresh();old.work5.ch4_mix.product='原产品';old.work5.ch4_mix.price='原价格';
    const pending=W5.aiPolish4P(null);const next={...old,work5:W5.defaultData()};next.work5.ch4_mix.product='新产品';sandbox.state=next;
    await response('旧产品润色');await pending;
    assert.equal(next.work5.ch4_mix.product,'新产品');assert.equal(old.work5.ch4_mix.product,'原产品');
    assert.equal(calls.length,0);assert.equal(saves,0);
  });
  await test('全文多单元中止后不写入或开始后续章节',async()=>{
    const state=fresh();state.work5.ch1_business='原业务';state.work5.ch5_outlook='原展望';
    const pending=W5.aiPolishAll(null);sandbox.Runner.abort();
    await response('迟到润色');await pending;
    assert.equal(state.work5.ch1_business,'原业务');assert.equal(state.work5.ch5_outlook,'原展望');
    assert.equal(calls.length,0);assert.equal(saves,0);
  });
  await test('单章节润色迟到响应不影响新工作区',async()=>{
    const old=fresh();old.work5.ch1_business='原业务';const pending=W5.aiPolish('ch1_business','业务',null);
    const next={...old,work5:W5.defaultData()};next.work5.ch1_business='新业务';sandbox.state=next;
    await response('旧业务润色');await pending;
    assert.equal(next.work5.ch1_business,'新业务');assert.equal(saves,0);
  });
  console.log(`\n${count} passed, 0 failed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
