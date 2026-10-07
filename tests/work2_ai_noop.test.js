/* Work2 AI button contract: null/empty results must be reported and must not be marked complete. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => cond ? (pass++, console.log('PASS ' + name))
  : (fail++, console.log('FAIL ' + name + (detail ? ' — ' + detail : '')));

function node(tag, attrs={}){
  return {tag:String(tag).toUpperCase(), attrs:attrs||{}, children:[], style:{}, dataset:{},
    appendChild(c){ this.children.push(c); return c; }, addEventListener(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; }, setAttribute(k,v){ this.attrs[k]=v; },
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    set innerHTML(v){ this._html=v; this.children=[]; }, get innerHTML(){ return this._html||''; },
    set textContent(v){ this._text=v; }, get textContent(){ return this._text||''; }};
}
const el=(tag,attrs={},...children)=>{
  const n=node(tag,attrs);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') n.className=v;
    else if(k.startsWith('on')&&typeof v==='function') n.addEventListener(k,v);
    else if(k==='style'&&typeof v==='object') Object.assign(n.style,v);
    else if(v!=null) n.setAttribute(k,v);
  }
  children.flat().forEach(c=>{ if(c!=null&&c!==false) n.appendChild(typeof c==='object'?c:{text:String(c),textContent:String(c),children:[]}); });
  return n;
};
const toasts=[];
const sandbox={
  console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,AbortController,
  document:{body:{dataset:{}},querySelector:()=>null,querySelectorAll:()=>[]},
  el, uid:p=>p+'_id', clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)), median:()=>0, mean:()=>0,
  autosave(){}, showToast:m=>toasts.push(String(m)), renderMatrix(){},
  state:null, Work1:{}, Work2:{}, Work3:{}, Work4:{}, Work5:{}, App:{updateSummary(){}},
  Runner:{current:null,start(){return this.current={aborted:false,done:0,controller:new AbortController()};},finish(){this.current=null;},checkpoint:()=>Promise.resolve(),tick(){this.current.done++;},renderUI(){}},
  UI:{field:(l,n)=>el('div',{},l,n),mountGuard:()=>true,mountMvo(){},mountMark(){}},
  AiContext:{buildPrompt:()=>[{role:'user',content:'x'}],mountSettings:()=>({current:()=>({sections:[]})})},
  API:{callJson:async()=>null, aiCtxBox:cfg=>({box:el('button',{},cfg.label||''), btn:{}, handle:{}}), aiPipeline(){}}
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs','lib','interaction.js'),'utf8'),sandbox,{filename:'interaction.js'});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs','workshop2.js'),'utf8'),sandbox,{filename:'workshop2.js'});
const W2=sandbox.Work2;
sandbox.state={work1:{sbu:{name:'SBU',boundary:'b'},recommendations:{short:'',mid:'',long:''}},work2:W2.defaultData()};
sandbox.state.work2.retained=[{id:'m1',name:'M1'},{id:'m2',name:'M2'}];
sandbox.state.work2.scoring={m1:{},m2:{}};
W2.allIndicators().forEach(i=>{ sandbox.state.work2.scoring.m1[i.id]={score:8,evidence:'e'}; sandbox.state.work2.scoring.m2[i.id]={score:5,evidence:'e'}; });

(async()=>{
  toasts.length=0;
  await W2.aiScore({disabled:false,textContent:''}, {}, 'all', {sections:[],fewShot:null});
  await new Promise(r=>setTimeout(r,0));
  ok('AI 评分空结果不宣告完成', !toasts.some(t=>t.includes('评分完成')), toasts.join('|'));
  ok('AI 评分空结果给出失败反馈', toasts.some(t=>t.includes('未返回评分') || t.includes('失败')), toasts.join('|'));

  // 传输/解析异常也不能只写 console 后宣告完成。
  sandbox.API.callJson = async()=>{ throw new Error('transport boom'); };
  toasts.length=0;
  await W2.aiScore({disabled:false,textContent:''}, {}, 'all', {sections:[],fewShot:null});
  await new Promise(r=>setTimeout(r,0));
  ok('AI 评分异常不宣告完成', !toasts.some(t=>t.includes('评分完成')), toasts.join('|'));
  ok('AI 评分异常给出失败反馈', toasts.some(t=>t.includes('未返回评分') || t.includes('失败')), toasts.join('|'));
  sandbox.API.callJson = async()=>null;

  let cfg=null;
  sandbox.API.aiCtxBox=c=>{ cfg=c; return {box:el('button',{},c.label||'')}; };
  const sec={querySelector:()=>el('div',{class:'plate'})};
  W2.render.decision(sec);
  ok('decision exposes AI button', !!cfg);
  toasts.length=0;
  cfg.onResult(null);
  ok('decision 空结果给出失败反馈', toasts.length>0, toasts.join('|'));

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e=>{ console.error(e); process.exit(1); });
