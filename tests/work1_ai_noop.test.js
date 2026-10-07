/* Work1 AI button contract: a null/empty AI result must be reported, never a silent no-op. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => cond ? (pass++, console.log('PASS ' + name))
  : (fail++, console.log('FAIL ' + name + (detail ? ' — ' + detail : '')));

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
const toasts=[];
const sandbox={
  console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,
  el, document:{createElement:makeNode,createTextNode:t=>({tag:'#text',text:String(t),textContent:String(t),children:[]}),body:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[]},
  uid:p=>p+'_id', mean:a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, median:()=>0, sd:()=>0,
  clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)), autosave(){}, showToast:m=>toasts.push(String(m)),
  renderBarChart(){}, renderLikertChart(){}, renderRadarChart(){}, confirm(){return true;},
  UI:{tagsInput:arr=>{const input=makeNode('input');const wrap=makeNode('div');wrap.appendChild(input);wrap.querySelector=()=>input;return {el:wrap,get:()=>arr||[],set(){}}},field:(l,n)=>el('div',{},el('label',{},l),n),mountGuard:()=>true,mountMvo(){},mountMark(){}},
  API:{aiButton:opts=>opts.onResult(null),aiCtxBox:()=>({box:makeNode('div')}),aiPipeline(){}},
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
sandbox.state.work1.survey.responses=[{personaId:'p',answers:[]}];
sandbox.state.work1.analysis.openThemes=[];

let plate=makeNode('div',{class:'plate'});
W1.render.analysis({querySelector:()=>plate});
const insight=buttons(plate,'用 AI 综合洞察')[0];
ok('analysis exposes AI insight button', !!insight);
if(insight){ toasts.length=0; insight.handlers.click[0](); ok('analysis null result reports failure', toasts.length>0, toasts.join('|')); }

plate=makeNode('div',{class:'plate'});
W1.render.values({querySelector:()=>plate});
const values=buttons(plate,'一键生成价值框架')[0];
ok('values exposes AI draft button', !!values);
if(values){ toasts.length=0; values.handlers.click[0](); ok('values null result reports failure', toasts.length>0, toasts.join('|')); }

plate=makeNode('div',{class:'plate'});
W1.render.recommendations({querySelector:()=>plate});
const rec=buttons(plate,'用 AI 起草建议')[0];
ok('recommendations exposes AI draft button', !!rec);
if(rec){ toasts.length=0; rec.handlers.click[0](); ok('recommendations null result reports failure', toasts.length>0, toasts.join('|')); }

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
