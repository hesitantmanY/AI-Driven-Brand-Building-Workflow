/* Synthetic DOM: task controls remain available after navigation or a remount. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function node(tag,attrs={}){
  const classes=new Set(String(attrs.class||'').split(/\s+/).filter(Boolean));
  const listeners={};
  const n={tagName:tag.toUpperCase(),attrs:{},children:[],parentNode:null,style:{},dataset:{},disabled:false,hidden:false,
    classList:{contains:x=>classes.has(x),add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
    appendChild(c){this.children.push(c);c.parentNode=this;return c;},
    contains(c){return c===this||this.children.some(x=>x.contains?.(c));},
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;},
    insertAdjacentElement(_,sibling){this.parentNode?.appendChild(sibling);},
    addEventListener(type,fn){(listeners[type]??=[]).push(fn);},
    removeEventListener(type,fn){listeners[type]=(listeners[type]||[]).filter(f=>f!==fn);},
    click(){if(!this.disabled)(listeners.click||[]).forEach(fn=>fn({target:this,preventDefault(){},stopPropagation(){}}));},
    setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);},
    getAttribute(k){return this.attrs[k]??null;},
    querySelector(sel){return this.querySelectorAll(sel)[0]||null;},
    querySelectorAll(sel){const all=[];const walk=x=>{for(const c of x.children){if(sel==='button'&&c.tagName==='BUTTON'||sel.startsWith('.')&&c.classList.contains(sel.slice(1))||sel.startsWith('#')&&c.id===sel.slice(1))all.push(c);walk(c);}};walk(this);return all;},
    getClientRects(){for(let p=this;p;p=p.parentNode){if(p.hidden||p.style.display==='none'||(p.classList.contains('workshop')||p.classList.contains('step'))&&!p.classList.contains('active'))return [];}return this.isConnected?[{}]:[];}
  };
  Object.defineProperty(n,'isConnected',{get(){for(let p=this;p;p=p.parentNode)if(p.tagName==='BODY')return true;return false;}});
  Object.defineProperty(n,'textContent',{get(){return this._text??this.children.map(c=>c.textContent).join('');},set(v){this._text=String(v);this.children.forEach(c=>c.parentNode=null);this.children=[];}});
  Object.defineProperty(n,'innerHTML',{get(){return this._html??this.textContent;},set(v){this._html=String(v);this.textContent=v;}});
  for(const [k,v] of Object.entries(attrs)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(k==='style')Object.assign(n.style,v);else n.setAttribute(k,v);}
  return n;
}
const el=(tag,attrs={},...cs)=>{const n=node(tag,attrs);cs.flat().forEach(c=>{if(c!=null)n.appendChild(typeof c==='object'?c:Object.assign(node('#text'),{textContent:String(c)}));});return n;};
function harness(){
  const body=node('body');
  const s={console,Map,AbortController,DOMException,setInterval,clearInterval,el,showToast(){},state:{meta:{},settings:{api:{apiKey:''}}},
    document:{body,getElementById:id=>body.querySelector('#'+id),querySelectorAll:sel=>body.querySelectorAll(sel)},
    App:{caseLocks:0,syncCaseLock(){this.caseLocks++;if(s.state.meta.isDemo)body.querySelectorAll('button').forEach(b=>{if(b.getAttribute('data-edit'))b.disabled=true;});}}};
  s.window=s;vm.createContext(s);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs/lib/runner.js'),'utf8'),s);
  const workshop=el('div',{class:'workshop active'}),step=el('div',{class:'step active'});
  workshop.appendChild(step);body.appendChild(workshop);
  const button=el('button',{class:'primary'},'AI 起草建议');step.appendChild(button);
  return {s,body,workshop,step,button,control:()=>s.document.getElementById('globalAiTaskControl')};
}
const tests=[];
function test(n,fn){tests.push([n,fn]);}
test('visible original button uses its own controls; remount exposes a global abort',async()=>{
  const {s,button,control}=harness();
  const task=s.Runner.start({id:'single',label:'合成任务',button});
  try{
    assert.ok(!control()||control().hidden);
    button.remove();s.Runner.renderUI();
    assert.ok(control()&&!control().hidden);
    const action=control().querySelector('button');assert.equal(action.textContent,'中止');action.click();
    assert.ok(task.aborted&&task.controller.signal.aborted);assert.equal(action.disabled,true);
  }finally{s.Runner.finish();}
  assert.equal(control(),null);
});
test('inactive workshop and step expose pause then abort without resume',async()=>{
  const {s,workshop,step,control}=harness();let pauses=0,resumes=0;
  const task=s.Runner.start({id:'pipeline',label:'双单元',button:step.querySelector('button'),total:2,pausable:true,onPause:()=>pauses++,onResume:()=>resumes++});
  try{
    workshop.classList.remove('active');s.Runner.renderUI();assert.equal(control()?.hidden,false);
    const action=control().querySelector('button');assert.equal(action.textContent,'暂停');action.click();
    assert.ok(task.paused);assert.equal(action.textContent,'中止');assert.equal(pauses,1);assert.equal(resumes,0);
    const checkpoint=s.Runner.checkpoint();action.click();await assert.rejects(checkpoint,e=>e.name==='AbortError');
    assert.ok(task.aborted);assert.equal(resumes,0);
    workshop.classList.add('active');step.classList.remove('active');s.Runner.renderUI();assert.equal(control().hidden,false);
  }finally{s.Runner.finish();}
});
test('buttonless background tasks have an abort and the fallback hides on return',async()=>{
  const {s,button,step,control}=harness();
  const task=s.Runner.start({id:'auto',label:'自动同步',button:null});
  try{assert.equal(control()?.hidden,false);control().querySelector('button').click();assert.ok(task.aborted);}finally{s.Runner.finish();}
  const next=s.Runner.start({id:'next',label:'新任务',button});
  try{step.hidden=true;s.Runner.renderUI();assert.equal(control()?.hidden,false);step.hidden=false;s.Runner.renderUI();assert.equal(control().hidden,true);assert.equal(next.aborted,false);}finally{s.Runner.finish();}
});
test('a DOM remount automatically exposes controls and locks newly rendered AI entries',async()=>{
  const {s,button,step,control}=harness();let observer;
  s.MutationObserver=class{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}};
  const task=s.Runner.start({id:'remount',label:'重绘任务',button});
  try{
    assert.ok(observer);button.remove();
    const replacement=el('button',{class:'primary'},'AI 起草新内容');step.appendChild(replacement);
    observer.fn([{addedNodes:[replacement]}]);
    assert.equal(control()?.hidden,false);assert.equal(replacement.disabled,true);
    control().querySelector('button').click();assert.ok(task.aborted);
  }finally{s.Runner.finish();}
  assert.equal(observer.disconnected,true);
});
test('ending a task preserves the missing API key constraint and reapplies case lock',async()=>{
  const {s,body}=harness();
  const api=el('button',{'data-mode':'api'},'API'),manual=el('button',{'data-mode':'manual'},'手动');
  body.appendChild(el('div',{id:'modeSwitch'},api,manual));
  const edit=el('button',{'data-edit':'true'},'AI 编辑');body.appendChild(edit);
  s.Runner.start({id:'mode',label:'任务',button:null});s.state.meta.isDemo=true;s.Runner.finish();
  assert.equal(api.disabled,true);assert.equal(manual.disabled,true);assert.equal(edit.disabled,true);assert.ok(s.App.caseLocks>0);
  s.state.meta.isDemo=false;s.Runner.renderUI();assert.equal(api.disabled,true);assert.equal(manual.disabled,false);
  s.state.settings.api.apiKey='synthetic';s.Runner.renderUI();assert.equal(api.disabled,false);
});
(async()=>{let fail=0;for(const [name,fn] of tests){try{await fn();console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+' — '+e.message);}}if(fail)process.exitCode=1;else console.log('RUNNER NAVIGATION PASS');})().catch(e=>{console.error(e);process.exitCode=1;});
