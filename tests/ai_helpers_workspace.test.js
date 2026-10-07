/* Shared AI helpers: deferred synthetic requests and manual fallbacks keep task/workspace identity. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','docs/global-brand-building.html'),'utf8');
const start=html.indexOf('const API = {'),end=html.indexOf('\n};',start);
const source=html.slice(start,end+3)+'\nthis.API=API;';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
function node(tag,attrs={},...children){
  const n={tag,attrs,children:children.flat().filter(x=>x!=null),value:'',style:{},appendChild(c){this.children.push(c);return c;},addEventListener(){},click(){this.attrs.onclick?.();}};
  Object.defineProperty(n,'textContent',{get(){return n.children.map(c=>typeof c==='object'?c.textContent:String(c)).join('');},set(v){n.children=[String(v)];}});
  Object.defineProperty(n,'innerHTML',{get(){return'';},set(){n.children=[];}});
  return n;
}
function find(n,p){if(p(n))return n;for(const c of n.children||[])if(typeof c==='object'){const r=find(c,p);if(r)return r;}return null;}
function workspace(){return {meta:{},settings:{manualMode:false,api:{apiKey:'synthetic'}},work1:{},work2:{},work3:{},work4:{},work5:{}};}
function harness(){
  const s={console,Map,Set,AbortController,DOMException,Promise,JSON,state:workspace(),el:node,autosave(){},showToast(){},
    Runner:{current:null,start(opts){if(this.current)return null;return this.current={...opts,aborted:false,done:0,controller:new AbortController()};},finish(){this.current=null;},async checkpoint(){if(this.current?.aborted)throw new DOMException('Aborted','AbortError');},renderUI(){}}};
  s.window=s;vm.createContext(s);vm.runInContext(source,s,{filename:'global-brand-building.html#API'});return s;
}
const tests=[];const test=(n,f)=>tests.push([n,f]);
test('single helper ignores a replaced workspace and does not finish a newer task',async()=>{
  const s=harness(),gate=deferred();let writes=0;s.API.callJson=()=>gate.promise;
  const run=s.API.aiButton({button:null,container:node('div'),label:'起草',buildPrompt:()=>[],onResult:()=>writes++});
  s.state=workspace();s.Runner.finish();const newer=s.Runner.start({id:'newer'});
  gate.resolve({old:true});await run;assert.equal(writes,0);assert.equal(s.Runner.current,newer);
});
test('an ended single task cannot apply a late result over a newer task in the same workspace',async()=>{
  const s=harness(),gate=deferred();let writes=0;s.API.callJson=()=>gate.promise;
  const run=s.API.aiButton({container:node('div'),label:'旧任务',buildPrompt:()=>[],onResult:()=>writes++});
  s.Runner.finish();const newer=s.Runner.start({id:'newer'});gate.resolve({old:true});await run;
  assert.equal(writes,0);assert.equal(s.Runner.current,newer);
});
test('a failed pipeline manual unit cannot finish another running task',async()=>{
  const s=harness(),manual=deferred();let stored=[],writes=0;
  s.API.callJson=async()=>{throw new Error('synthetic failure');};
  s.API._manualUnit=(container,u,onDone)=>{s.fill=()=>{u.onResult({});onDone();manual.resolve(true);};return manual.promise;};
  const run=s.API.aiPipeline({button:null,container:node('div'),label:'旧流水线',units:[1,2].map(i=>({key:'u'+i,label:'单元'+i,buildPrompt:()=>[],onResult:()=>writes++})),store:{get:()=>stored,set:x=>{stored=x;}}});
  await flush();assert.equal(s.Runner.current,null);const newer=s.Runner.start({id:'newer'});
  s.fill();await run;assert.equal(writes,1);assert.equal(stored.length,1);assert.equal(s.Runner.current,newer);
});
test('a late pipeline response cannot write or mark complete in another workspace',async()=>{
  const s=harness(),gate=deferred();let writes=0,marked=0,complete=0;s.API.callJson=()=>gate.promise;
  const run=s.API.aiPipeline({button:null,container:node('div'),label:'流水线',units:[{key:'one',label:'单元',buildPrompt:()=>[],onResult:()=>writes++}],store:{get:()=>[],set:()=>marked++},onDone:()=>complete++});
  s.state=workspace();gate.resolve({old:true});await run;assert.equal(writes,0);assert.equal(marked,0);assert.equal(complete,0);
});
test('single manual result cannot enter a replaced workshop in the same state object',async()=>{
  const s=harness();let writes=0;s.state.settings.manualMode=true;s.API.manualBox=(container,prompt,apply)=>{s.apply=apply;};
  await s.API.aiButton({container:node('div'),label:'手动起草',buildPrompt:()=>[],onResult:()=>writes++});
  s.state.work3={newWorkspace:true};s.apply({old:true});assert.equal(writes,0);
});
test('manual JSON and text units reject stale fill before callbacks and resolve false',async()=>{
  for(const textMode of [false,true]){
    const s=harness(),container=node('div');let writes=0,marks=0;
    const run=s.API._manualUnit(container,{label:'手动单元',jsonMode:!textMode,buildPrompt:()=>[],onResult:()=>writes++},()=>marks++);
    const ta=find(container,n=>n.tag==='textarea');ta.value='{"ok":true}';
    s.state=workspace();find(container,n=>n.tag==='button'&&n.textContent===(textMode?'作为文本填入':'解析并填入')).click();
    assert.equal(await run,false);assert.equal(writes,0);assert.equal(marks,0);
  }
});
test('manual pipeline does not advance to a new workspace',async()=>{
  const s=harness(),container=node('div');let builds=0,marks=0;
  const units=[1,2].map(i=>({key:'u'+i,label:'单元'+i,buildPrompt:()=>{builds++;return[];},onResult(){}}));
  s.API._manualPipeline(container,'手动流水线',units,new Set(),()=>marks++);
  const ta=find(container,n=>n.tag==='textarea');ta.value='{}';s.state=workspace();
  find(container,n=>n.tag==='button'&&n.textContent==='解析并填入').click();await flush();assert.equal(builds,1);assert.equal(marks,0);
});
(async()=>{let fail=0;for(const [n,f] of tests){try{await f();console.log('PASS '+n);}catch(e){fail++;console.error('FAIL '+n+' — '+e.message);}}if(fail)process.exitCode=1;else console.log('AI HELPERS WORKSPACE PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
