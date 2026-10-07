/* E: AI 按钮生成态文案、直接覆盖与空结果反馈。 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
let pass=0,fail=0;
function ok(n,c,d){if(c){pass++;console.log('PASS '+n);}else{fail++;console.log('FAIL '+n+(d?' — '+d:''));}}
function node(tag){return {tagName:String(tag).toUpperCase(),nodeType:1,children:[],attrs:{},style:{},className:'',dataset:{},appendChild(c){this.children.push(c);return c;},addEventListener(){},setAttribute(k,v){this.attrs[k]=v;},querySelector(){return null;},querySelectorAll(){return[];},set innerHTML(v){this._html=String(v);this.children=[];},get innerHTML(){return this._html||'';}};}
function text(n){if(n.nodeType===3)return String(n.text||'');let o=n._html||'';for(const c of(n.children||[]))o+=text(c);return o;}
function buttons(n,out=[]){if(n.tagName==='BUTTON')out.push(text(n).trim());for(const c of(n.children||[]))buttons(c,out);return out;}
const document={createElement:t=>node(t),createTextNode:s=>({nodeType:3,text:String(s),children:[]}),head:{appendChild(){}},getElementById:()=>null,querySelector:()=>null};
let toasts=[], confirms=0, reply='新内容';
const sandbox={console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,document,
 el(tag,attrs={},...children){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='class')e.className=v;else if(k==='style')Object.assign(e.style,v);else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!=null)e.setAttribute(k,v);}for(const c of children.flat()){if(c!=null&&c!==false)e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c);}return e;},esc:s=>String(s??''),autosave(){},showToast:m=>toasts.push(String(m)),confirm:()=>{confirms++;return true;},state:null,Work1:{steps:[{id:'a'}],mvo:{a:()=>({checks:[]})}},Work2:{steps:[{id:'b'}],mvo:{b:()=>({checks:[]})},computeMatrix:()=>[],setTier1(){}},Work3:{steps:[{id:'c'}],mvo:{c:()=>({checks:[]})},computeMatrix:()=>[],effectiveCuts:()=>({xCut:7,yCut:7}),isInSector:()=>false,entrySuggestion:()=>({text:''}),scenarioName:()=>''},Work4:{steps:[{id:'d'}],mvo:{d:()=>({checks:[]})}},Work5:{},App:{goWork(){}},Runner:{start(){return {done:0,aborted:false,controller:{signal:{}}};},renderUI(){},checkpoint(){return Promise.resolve();},finish(){}},API:{async call(){return reply;},async callJson(){return {strengths:['S'],weaknesses:['W'],opportunities:['O'],threats:['T'],customerValue:'V',customerCost:'C',convenience:'便利',communication:'沟通',product:{core:'P',actions:'· P1',nums:'1'}};}},UI:{mountMvo(){},mountMark(){},mountGuard(){return true;},demoNote(){return null;}},AiContext:{buildPrompt:()=>[]},renderMatrix(){}};sandbox.window=sandbox;vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','..','docs','workshop5.js'),'utf8'),sandbox,{filename:'workshop5.js'});
const W5=sandbox.Work5;W5.rerender=()=>{};
sandbox.state={meta:{},work1:{sbu:{name:'品牌'},environment:{},personas:[],values:{},analysis:{},metrics:{dimensions:[]}},work2:{matrix:{},decision:{}},work3:{matrix:{showSector:false},candidates:[],mining:{},proposition:{},identity:{}},work4:{},work5:W5.defaultData()};
sandbox.state.work5.ch1_business='已有章节'; sandbox.state.work5.ch5_outlook='已有展望'; sandbox.state.work5.ch4_mix.product='已有产品'; sandbox.state.work5.ch4_mix.customerValue='已有价值';
const sec=node('section'); document.querySelector=s=>s.includes('data-step="plan"')?sec:null; W5.renderStep('plan');
const bs=buttons(sec);
ok('aiPolish 已有内容变重新生成文案', bs.some(x=>x.includes('重新生成')&&x.includes('业务概况')), bs.filter(x=>x.includes('改写')).join(' / '));
ok('aiSummary4P/convert4C/aiSwot/aiOutlook 生成态文案正确', bs.some(x=>x.includes('重新生成 4P 表'))&&bs.some(x=>x.includes('重新生成 4C'))&&bs.some(x=>x.includes('重新生成 SWOT'))&&bs.some(x=>x.includes('重新生成总结展望')), bs.join(' / '));
async function main(){
const old=sandbox.state.work5.ch5_outlook; reply='覆盖后的展望'; await W5.aiOutlook(null);
ok('重新生成直接覆盖不追加、不 confirm', sandbox.state.work5.ch5_outlook==='覆盖后的展望'&&confirms===0, JSON.stringify({value:sandbox.state.work5.ch5_outlook,confirms}));
reply=''; toasts=[]; await W5.aiOutlook(null);
ok('空模型结果不静默空转', toasts.length>0 && sandbox.state.work5.ch5_outlook==='覆盖后的展望', JSON.stringify(toasts));
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail===0?0:1);
}
main().catch(e=>{console.error(e);process.exit(1);});
