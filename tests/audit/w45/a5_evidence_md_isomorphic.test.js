/* B: 证据块 MD 投影与实时视图同构。 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
let pass=0,fail=0;
function ok(n,c,d){if(c){pass++;console.log('PASS '+n);}else{fail++;console.log('FAIL '+n+(d?' — '+d:''));}}
function node(tag){return {tagName:String(tag).toUpperCase(),nodeType:1,children:[],attrs:{},style:{},className:'',appendChild(c){this.children.push(c);return c;},addEventListener(){},setAttribute(k,v){this.attrs[k]=v;},querySelector(){return null;},querySelectorAll(){return[];},set innerHTML(v){this._html=String(v);this.children=[];},get innerHTML(){return this._html||'';}};}
function text(n){if(n.nodeType===3)return String(n.text||'');let o=n._html||'';for(const c of(n.children||[]))o+=text(c);return o;}
const document={createElement:t=>node(t),createTextNode:s=>({nodeType:3,text:String(s),children:[]}),head:{appendChild(){}},getElementById:()=>null,querySelector:()=>null};
const sandbox={console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,document,
 el(tag,attrs={},...children){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='class')e.className=v;else if(k==='style')Object.assign(e.style,v);else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!=null)e.setAttribute(k,v);}for(const c of children.flat()){if(c!=null&&c!==false)e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c);}return e;},
 esc:s=>String(s??''),autosave(){},showToast(){},confirm:()=>true,state:null,Work1:{},Work2:{},Work3:{},Work4:{},Work5:{},App:{},Runner:{},API:{},UI:{mountMvo(){},mountMark(){},mountGuard(){return true;},demoNote(){return null;}},AiContext:{buildPrompt:()=>[]},renderMatrix(){}};sandbox.window=sandbox;vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','..','docs','workshop5.js'),'utf8'),sandbox,{filename:'workshop5.js'});
const W5=sandbox.Work5;
let adv=[{media:'低',budgetShare:20,message:'低预算',kpi:'KPI低'},{media:'高',budgetShare:50,message:'高预算',kpi:'KPI高'}];
sandbox.state={meta:{},work1:{metrics:{dimensions:[]}},work2:{},work3:{mining:{topics:[]}},work4:{promotion:{advertising:adv}},work5:W5.defaultData()};
const host=node('div'); W5.budgetBarBlock(host); const view=text(host);
const md=W5.mediaMd();
ok('mediaMd 与 budgetBarBlock 同序（高预算在前）', view.indexOf('高') < view.indexOf('低') && md.indexOf('高') < md.indexOf('低'), md);
ok('mediaMd 合计与视图一致（70，不写死 100）', md.includes('合计 70') && !md.includes('合计 100'), md);
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail===0?0:1);
