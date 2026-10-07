/* Work1 AI 起草按钮语义：未生成保持原文案；AI 生成后变“重新生成”，点击直接覆盖且不 confirm。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function makeNode(tag, attrs={}){
  const n = {
    tag, attrs, children:[], handlers:{}, dataset:{}, style:{}, className:attrs.class||'',
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    appendChild(c){ this.children.push(c); return c; },
    addEventListener(t, fn){ (this.handlers[t] ||= []).push(fn); return this; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    setAttribute(k,v){ this.attrs[k]=v; }, removeAttribute(k){ delete this.attrs[k]; },
    set innerHTML(v){ this._html=v; this.children=[]; }, get innerHTML(){ return this._html||''; },
    set textContent(v){ this._text=v; this.children=[]; },
    get textContent(){ return this._text != null ? this._text : this.children.map(c=>c.textContent||c.text||'').join(''); }
  };
  return n;
}
const el=(tag,attrs={},...children)=>{
  const n=makeNode(tag,attrs||{});
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') n.className=v;
    else if(k.startsWith('on')&&typeof v==='function') n.addEventListener(k.slice(2),v);
    else if(k==='style'&&typeof v==='object') Object.assign(n.style,v);
    else if(v!=null) n.setAttribute(k,v);
  }
  for(const c of children.flat()){ if(c!=null&&c!==false) n.appendChild(typeof c==='object'?c:{tag:'#text',text:String(c),textContent:String(c),children:[]}); }
  return n;
};
const walk=(n,out=[])=>{ if(!n||typeof n!=='object') return out; out.push(n); (n.children||[]).forEach(c=>walk(c,out)); return out; };
const buttons=(root,label)=>walk(root).filter(n=>n.tag==='button'&&n.textContent===label);
let confirmCalls=0;
const sandbox={
  console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,
  el, document:{createElement:makeNode,createTextNode:t=>({tag:'#text',text:String(t),textContent:String(t),children:[]}),body:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[]},
  uid:p=>p+'_id', mean:a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, median:()=>0, sd:()=>0, clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),
  autosave(){}, showToast(){}, renderBarChart(){}, confirm(){ confirmCalls++; return true; },
  UI:{tagsInput:arr=>{const input=makeNode('input');const wrap=makeNode('div');wrap.appendChild(input);wrap.querySelector=()=>input;return {el:wrap,get:()=>arr||[],set(){}}},field:(l,n)=>el('div',{},el('label',{},l),n),mountGuard:()=>true,mountMvo(){},mountMark(){}},
  API:{aiButton:opts=>opts.onResult(opts._testResult||{}),aiCtxBox:()=>({box:makeNode('div')}),aiPipeline(){}},
  Runner:{start:()=>null,finish(){},checkpoint:()=>Promise.resolve(),renderUI(){}},
  App:{}, Work1:{}
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs','workshop1.js'),'utf8'),sandbox,{filename:'workshop1.js'});
const W1=sandbox.Work1;
W1._ctx=()=>()=>[];
W1.rerender=()=>{}; W1.renderStep=()=>{};
sandbox.state={work1:W1.defaultData()};

let plate=makeNode('div',{class:'plate'});
W1.metricsHeadRow({querySelector:()=>plate});
ok('指标按钮未生成时保持原文案', buttons(plate,'一键生成指标体系').length===1 && buttons(plate,'重新生成指标体系').length===0);

plate=makeNode('div',{class:'plate'});
W1.render.recommendations({querySelector:()=>plate});
ok('建议按钮未生成时保持原文案', buttons(plate,'用 AI 起草建议').length===1 && buttons(plate,'重新生成建议').length===0);

confirmCalls=0;
sandbox.API.aiButton=opts=>opts.onResult({dimensions:[{name:'品牌显著性',secondaries:[{name:'知晓度',measure:'可验证口径',selfScore:5}]}]});
W1.draftMetrics(null,{});
ok('指标 AI 生成直接覆盖且不 confirm', confirmCalls===0 && sandbox.state.work1.metrics._aiGenerated===true);

plate=makeNode('div',{class:'plate'});
W1.metricsHeadRow({querySelector:()=>plate});
ok('指标 AI 已生成后按钮变重新生成', buttons(plate,'重新生成指标体系').length===1 && buttons(plate,'一键生成指标体系').length===0);

confirmCalls=0;
plate=makeNode('div',{class:'plate'});
W1.render.recommendations({querySelector:()=>plate});
const recBtn=buttons(plate,'用 AI 起草建议')[0];
recBtn.handlers.click[0]();
ok('建议 AI 生成直接覆盖且不 confirm', confirmCalls===0 && sandbox.state.work1.recommendations._aiGenerated===true);

plate=makeNode('div',{class:'plate'});
W1.render.recommendations({querySelector:()=>plate});
ok('建议 AI 已生成后按钮变重新生成', buttons(plate,'重新生成建议').length===1 && buttons(plate,'用 AI 起草建议').length===0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
