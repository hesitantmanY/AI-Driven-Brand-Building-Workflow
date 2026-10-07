/* Real Runner with deferred synthetic AI: lock, abort, pause and workspace boundaries. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
let serial=0;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function node(tag,attrs={}){
  const classes=new Set(String(attrs.class||'').split(/\s+/).filter(Boolean));
  const n={tagName:tag.toUpperCase(),children:[],attrs:{...attrs},style:{},disabled:false,parentNode:null,
    classList:{contains:x=>classes.has(x),add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
    appendChild(c){this.children.push(c);if(c&&typeof c==='object')c.parentNode=this;return c;},
    contains(c){return c===this||this.children.some(x=>x?.contains?.(c));},
    addEventListener(){},removeEventListener(){},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},
    remove(){},querySelector:()=>null,querySelectorAll:()=>[],insertAdjacentElement(){}};
  Object.defineProperty(n,'textContent',{get(){return this._text??this.children.map(c=>c?.textContent??c).join('');},set(v){this._text=String(v);this.children=[];}});
  Object.defineProperty(n,'innerHTML',{get(){return this._html??this.textContent;},set(v){this._html=String(v);this._text=String(v);this.children=[];}});
  return n;
}
const el=(tag,attrs={},...children)=>{const n=node(tag,attrs);children.flat().forEach(c=>n.appendChild(typeof c==='string'?{textContent:c}:c));return n;};
function harness(){
  const buttons=[],toasts=[],calls=[];
  const s={console,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,Map,Set,AbortController,DOMException,setInterval,clearInterval,setTimeout,clearTimeout,
    Work1:{},Work2:{},Work3:{},Work4:{},Work5:{},state:null,el,
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:sel=>sel==='button'?buttons:[]},
    uid:p=>p+'_'+(++serial),clamp:(v,l,h)=>Math.max(l,Math.min(h,v)),mean:a=>a.length?a.reduce((a,b)=>a+b,0)/a.length:0,
    autosave(){},showToast:m=>toasts.push(String(m)),AiContext:{buildPrompt:()=>[]},
    API:{config:()=>({apiKey:'synthetic'}),callJson:async(messages,opts)=>{calls.push(opts);return null;},manualBox(container,prompt,apply){s.manualApply=apply;}}};
  s.window=s;vm.createContext(s);
  for(const f of ['lib/runner.js','workshop2.js','workshop3.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs',f),'utf8'),s,{filename:f});
  s.state={meta:{},settings:{manualMode:false},work1:{},work2:s.Work2.defaultData(),work3:s.Work3.defaultData()};
  s.Work2.guardWork1=()=>true;s.Work2.rerender=()=>{};s.Work3.rerender=()=>{};
  s.Work3.simSystemPrompt=()=>'';s.Work3.simUserPrompt=()=>'';
  s.button=text=>{const b=el('button',{class:'primary'},text);el('div').appendChild(b);buttons.push(b);return b;};
  return {s,buttons,toasts,calls};
}
const tests=[];
function test(name,fn){tests.push([name,fn]);}
test('all existing AI entry labels are disabled by the global task',async()=>{
  const {s,buttons}=harness();
  for(const text of ['AI 从 work1 推导评估体系','重新推导评估体系','AI 招聘：该听哪 5 个视角','AI 收敛（取均值归一化）','AI 总结 4P 表','生成模拟语料（基于画像）','运行合成调研','补全合成调研','运行 5 persona 并行赋权','补全 persona 赋权'])s.button(text);
  const add=s.button('添加候选市场');
  s.Runner.start({id:'lock',label:'合成锁',button:null});
  try{for(const b of buttons.slice(0,-1)){assert.equal(b.disabled,true,b.textContent);assert.equal(b.getAttribute('title'),'已有 AI 任务进行中');}assert.equal(add.disabled,false);}
  finally{s.Runner.finish();}
  assert.ok(buttons.every(b=>!b.disabled));
});
test('single market scoring is abortable and abort keeps the old scores',async()=>{
  const {s,calls}=harness(),gate=deferred();
  s.state.work2.retained=[{id:'m1',name:'市场1'}];s.state.work2.scoring={m1:{kept:{score:3}}};
  s.API.callJson=(msgs,opts)=>{calls.push(opts);return gate.promise;};
  const promise=s.Work2.aiScore(s.button('重新生成'),null,'m1',{});
  try{await flush();assert.equal(s.Runner.current?.pausable,false);assert.equal(calls[0]?.signal,s.Runner.signal());s.Runner.abort();gate.resolve({scores:{new:8}});await promise;assert.deepEqual(JSON.parse(JSON.stringify(s.state.work2.scoring)),{m1:{kept:{score:3}}});assert.equal(s.Runner.current,null);}
  finally{gate.resolve(null);s.Runner.finish();}
});
test('late market scores cannot enter a replaced workspace',async()=>{
  const {s}=harness(),gate=deferred();let requested=false;
  s.state.work2.retained=[{id:'old-market',name:'旧市场'}];s.API.callJson=()=>{requested=true;return gate.promise;};
  const promise=s.Work2.aiScore(s.button('AI 评分'),null,'all',{});
  await flush();assert.equal(requested,true);
  s.state={meta:{},settings:{},work2:s.Work2.defaultData(),work3:s.Work3.defaultData()};
  gate.resolve({scores:{old:8}});await promise;await flush();
  assert.deepEqual(Object.keys(s.state.work2.scoring),[]);assert.equal(s.Runner.current,null);
});
test('multi-market pause commits the completed market and stops before the next call',async()=>{
  const {s,calls,toasts}=harness(),gate=deferred();
  const ind=s.Work2.allIndicators()[0].id;
  s.state.work2.retained=[{id:'m1',name:'市场1'},{id:'m2',name:'市场2'},{id:'m3',name:'市场3'}];
  s.state.work2.scoring={m2:{kept:{score:4}}};
  s.API.callJson=(msgs,opts)=>{calls.push(opts);return calls.length===1?gate.promise:Promise.resolve({scores:{[ind]:9}});};
  const promise=s.Work2.aiScore(s.button('AI 评分'),null,'all',{});
  try{
    await flush();assert.equal(s.Runner.current?.pausable,true);s.Runner.togglePause();
    gate.resolve({scores:{[ind]:8}});await flush();
    assert.equal(s.state.work2.scoring.m1[ind].score,8);assert.equal(calls.length,1);assert.equal(s.Runner.current.done,1);
    s.Runner.togglePause();await promise;
    assert.equal(s.state.work2.scoring.m2.kept.score,4);assert.equal(s.state.work2.scoring.m3,undefined);assert.ok(toasts.some(t=>t.includes('中止')));assert.equal(s.Runner.current,null);
  }finally{gate.resolve(null);s.Runner.abort();s.Runner.finish();}
});
test('convergence uses the task signal and cannot mutate the replacement after completion',async()=>{
  const {s,calls}=harness(),gate=deferred();
  const d=s.state.work2.delphi;d.personas=[{perspectiveName:'合成视角',ratings:{attractiveness:{},competitiveness:{}}}];
  for(const i of s.Work2.allIndicators())d.personas[0].ratings[i.axis][i.id]=1;
  s.API.callJson=(msgs,opts)=>{calls.push(opts);return gate.promise;};
  const promise=s.Work2.converge(s.button('AI 收敛'),null);
  try{
    assert.equal(s.Runner.current?.pausable,false);assert.equal(calls[0]?.signal,s.Runner.signal());
    s.state={meta:{},settings:{},work2:s.Work2.defaultData(),work3:s.Work3.defaultData()};
    gate.resolve({summary:'旧总结'});await promise;
    assert.equal(s.state.work2.delphi.summary,'');assert.equal(s.state.work2.delphi.status,'idle');assert.equal(s.Runner.current,null);
  }finally{gate.resolve(null);s.Runner.finish();}
});
test('simulated corpus generation uses the task signal and abort retains every source',async()=>{
  const {s,calls}=harness(),gate=deferred();
  const m=s.state.work3.mining;m.documents=['真实种子'];m.simulatedDocuments=['旧模拟语料'];m.topics=[{id:0}];
  const before=JSON.stringify(m);s.API.callJson=(msgs,opts)=>{calls.push(opts);return gate.promise;};
  const promise=s.Work3.generateSimulatedDocs(s.button('重新生成模拟语料'),null,{});
  try{assert.equal(s.Runner.current?.pausable,false);assert.equal(calls[0]?.signal,s.Runner.signal());s.Runner.abort();gate.resolve({documents:['新模拟语料']});await promise;assert.equal(JSON.stringify(m),before);assert.equal(s.Runner.current,null);}
  finally{gate.resolve(null);s.Runner.finish();}
});
test('late automatic and manual corpus results cannot invalidate another workspace',async()=>{
  const {s}=harness(),gate=deferred();s.API.callJson=()=>gate.promise;
  const promise=s.Work3.generateSimulatedDocs(null,null,{});
  s.state={meta:{},settings:{manualMode:false},work2:s.Work2.defaultData(),work3:s.Work3.defaultData()};
  s.state.work3.mining.topics=[{id:9}];gate.resolve({documents:['迟到模拟语料']});await promise;
  assert.equal(s.state.work3.mining.topics[0].id,9);assert.deepEqual(Object.keys(s.state.work3.mining.simulatedDocuments),[]);
  s.state.settings.manualMode=true;await s.Work3.generateSimulatedDocs(null,null,{});
  const callback=s.manualApply;s.state.work3=s.Work3.defaultData();s.state.work3.mining.topics=[{id:10}];callback({documents:['手动迟到模拟语料']});
  assert.equal(s.state.work3.mining.topics[0].id,10);
});
test('blocked task entry does not call AI or change the corpus and weights',async()=>{
  const {s,calls}=harness();s.Runner.start({id:'existing',label:'已有任务',button:null});
  const before=JSON.stringify(s.state);
  try{await s.Work3.generateSimulatedDocs(null,null,{});await s.Work2.aiScore(s.button('AI 评分'),null,'all',{});await s.Work2.converge(s.button('AI 收敛'),null);assert.equal(calls.length,0);assert.equal(JSON.stringify(s.state),before);assert.equal(s.Runner.current.id,'existing');}
  finally{s.Runner.finish();}
});
test('standalone simulated LDA is abortable and does not write late results',async()=>{
  const {s,calls}=harness(),gate=deferred();
  s.backendOnline=false;s.Work3.collectDocs=()=>['真实一','真实二','真实三'];s.Work3.collectDocsLabeled=()=>s.Work3.collectDocs().map(text=>({text,source:'真实'}));
  s.API.callJson=(msgs,opts)=>{calls.push(opts);return gate.promise;};
  const promise=s.Work3.runLDA(null);
  try{assert.equal(s.Runner.current?.id,'work3-lda');assert.equal(calls[0]?.signal,s.Runner.signal());s.Runner.abort();gate.resolve({topics:[{id:0,label:'迟到主题'}]});assert.equal(await promise,false);assert.equal(s.state.work3.mining.topics.length,0);assert.equal(s.Runner.current,null);}
  finally{gate.resolve(null);s.Runner.finish();}
});
test('LDA inside a pipeline uses its task signal and cannot revive cleared corpus results',async()=>{
  const {s}=harness(),gate=deferred();let signal;
  s.backendOnline=true;s.state.work3.mining.documents=['真实一','真实二','真实三'];
  s.Work3.collectDocs=()=>s.state.work3.mining.documents;s.Work3.collectDocsLabeled=()=>s.Work3.collectDocs().map(text=>({text,source:'真实'}));
  s.Backend={lda:(docs,params,opts)=>{signal=opts?.signal;return gate.promise;}};
  const task=s.Runner.start({id:'pipeline',label:'痛点流水线',button:null,total:2,pausable:true});
  const promise=s.Work3.runLDA(null,false,task);
  try{assert.equal(signal,task.controller.signal);s.state.work3.mining.documents=[];gate.resolve({topics:[{id:0,label:'旧语料主题'}]});assert.equal(await promise,false);assert.equal(s.state.work3.mining.topics.length,0);assert.equal(s.Runner.current,task);}
  finally{gate.resolve(null);s.Runner.finish();}
});
(async()=>{let failed=0;for(const [name,fn] of tests){try{await fn();console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+' — '+e.message);}}if(failed)process.exitCode=1;else console.log('AI TASK WORKSPACE PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
