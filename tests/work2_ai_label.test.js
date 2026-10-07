/* Work2 评估体系按钮：手动候选数据不得触发“重新推导”，AI 生成后才切换。 */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0,fail=0;
const ok=(n,c,d)=>{if(c){pass++;console.log('PASS '+n)}else{fail++;console.log('FAIL '+n+(d?' — '+d:''))}};
function node(tag){return {tag:String(tag).toUpperCase(),children:[],attrs:{},style:{},className:'',appendChild(c){this.children.push(c);return c},addEventListener(){},querySelector(){return null},querySelectorAll(){return []},setAttribute(k,v){this.attrs[k]=v},innerHTML:'',textContent:''}}
function collect(n){return (n.children||[]).map(c=>typeof c==='string'?c:(c.text||collect(c))).join('')}
const document={createElement:node,createTextNode:s=>({text:String(s),children:[]}),querySelector:()=>null,querySelectorAll:()=>[]};
const sandbox={console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,document,
 el(tag,attrs={},...children){const n=node(tag);for(const [k,v] of Object.entries(attrs||{})){if(k==='class')n.className=v;else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k,v);else if(k==='style'&&typeof v==='object')Object.assign(n.style,v);else if(v!=null)n.setAttribute(k,v)}for(const c of children.flat()){if(c!=null)n.appendChild(typeof c==='object'?c:{text:String(c),children:[]})}return n},
 esc:s=>String(s??''),uid:p=>p+'_id',mean:a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,median:()=>0,sd:()=>0,clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),autosave(){},showToast(){},confirm:()=>true,renderMatrix(){},
 state:null,Work1:{sbu:{name:'SBU'},environment:{},personas:[],competitors:[]},Work2:{},Work3:{},Work4:{},Work5:{},App:{},Runner:{},API:{},UI:{field:(l,n)=>sandbox.el('div',{},l,n)},AiContext:{mountSettings:()=>({current:()=>({sections:[]})})}};
sandbox.window=sandbox; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs','lib','interaction.js'),'utf8'),sandbox,{filename:'interaction.js'});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs','workshop2.js'),'utf8'),sandbox,{filename:'workshop2.js'});
const W2=sandbox.Work2;
W2.renderDelphi=()=>{};
sandbox.API.aiCtxBox=cfg=>({box:(()=>{const b=sandbox.el('div');b.appendChild(sandbox.el('button',{},cfg.label||''));return b})()});
sandbox.state={work1:sandbox.Work1,work2:W2.defaultData()};
sandbox.state.work2.candidates=[{id:'c',name:'手动市场',reason:'手填理由',source:'user'}];
function render(){const sec=sandbox.el('section');const plate=sandbox.el('div',{class:'plate'});sec.querySelector=()=>plate;W2.render.framework(sec);return collect(plate)}
let txt=render();
ok('手动候选后仍为 AI 从 work1 推导评估体系',txt.includes('AI 从 work1 推导评估体系')&&!txt.includes('重新推导评估体系'),txt.slice(0,300));
sandbox.state.work2._frameworkGenerated=true; txt=render();
ok('AI 已生成后变重新推导评估体系',txt.includes('重新推导评估体系'),txt.slice(0,300));
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
