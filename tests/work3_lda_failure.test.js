/* LDA rerun failure must not leave stale prior stats/topics as current output. */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0,fail=0;
const ok=(n,c,d)=>{if(c){pass++;console.log('PASS '+n)}else{fail++;console.log('FAIL '+n+(d?' — '+d:''))}};
const document={createElement:()=>({appendChild(){},addEventListener(){},querySelector(){return null},style:{},innerHTML:''}),createTextNode:s=>({text:String(s)}),querySelector:()=>null,getElementById:()=>null};
const sandbox={console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,AbortController,document,
 el:()=>({appendChild(){},addEventListener(){},querySelector(){return null},style:{},innerHTML:''}),esc:s=>String(s??''),uid:p=>p,mean:a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,median:()=>0,sd:()=>0,clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),autosave(){},showToast(){},confirm:()=>true,backendOnline:true,
 state:{settings:{manualMode:false},work1:{sbu:{name:'S'},analysis:{openThemes:[]},personas:[]},work3:null},
 Work1:{},Work2:{},Work3:{},App:{},Runner:{current:null,start(){return this.current={aborted:false,controller:new AbortController()};},finish(){this.current=null;}},API:{},UI:{},AiContext:{}};
sandbox.window=sandbox; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs','workshop3.js'),'utf8'),sandbox,{filename:'workshop3.js'});
const W3=sandbox.Work3; sandbox.state.work3=W3.defaultData();
W3.collectDocs=()=>['a','b','c'];
W3.collectDocsLabeled=()=>[{text:'a',source:'真实'},{text:'b',source:'真实'},{text:'c',source:'真实'}];
sandbox.Backend={lda:async()=>{throw new Error('backend down')}};
const m=sandbox.state.work3.mining;
m.stats={raw_count:3,valid_count:3};m.topics=[{id:0,label:'old'}];m.corpusComposition={real:3,simulated:0,total:3};
(async()=>{
  const result=await W3.runLDA(null);
  ok('runLDA failure returns false',result===false);
  ok('runLDA failure clears stale stats',m.stats===null,JSON.stringify(m.stats));
  ok('runLDA failure clears stale topics',Array.isArray(m.topics)&&m.topics.length===0,JSON.stringify(m.topics));
  ok('runLDA failure records error',!!m.ldaError);
  console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
