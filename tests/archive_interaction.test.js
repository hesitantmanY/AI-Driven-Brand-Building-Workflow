/* Synthetic DOM interaction regressions for archive acceptance A01–A05/A15.
   Run: node tests/archive_interaction.test.js. No service or real data is used. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const normalizeName=require('../docs/lib/archive.js').normalizeName;
const root=path.join(__dirname,'..');
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){ for(let i=0;i<5;i++) await tick(); }
function deferred(){ let resolve,reject; const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}); return {promise,resolve,reject}; }

class Node {
  constructor(tag,attrs={}){
    this.tagName=tag.toUpperCase(); this.attrs={}; this.children=[]; this.listeners={};
    this.dataset={}; this.style={}; this.value=''; this.hidden=false; this.disabled=false; this._text='';
    const classes=new Set();
    this.classList={add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)};
    Object.defineProperty(this,'className',{get:()=>[...classes].join(' '),set:value=>{classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name=>classes.add(name));}});
    for(const [key,value] of Object.entries(attrs)){
      if(key.startsWith('on')) this.addEventListener(key.slice(2),value);
      else this.setAttribute(key,value);
    }
  }
  setAttribute(key,value){
    this.attrs[key]=String(value);
    if(key==='class') this.className=value;
    if(key==='value') this.value=String(value);
    if(key==='id') this.id=String(value);
    if(key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);
  }
  removeAttribute(key){delete this.attrs[key];}
  appendChild(child){
    if(child==null || child===false) return;
    const node=typeof child==='object'? child : new Node('#text');
    if(typeof child!=='object') node._text=String(child);
    node.parentNode=this; node.document=this.document; this.children.push(node); return node;
  }
  replaceWith(node){const index=this.parentNode.children.indexOf(this); node.parentNode=this.parentNode; node.document=this.document; this.parentNode.children[index]=node;}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this._text=String(value); this.children=[];}
  get innerHTML(){return this.textContent;}
  set innerHTML(value){this._text=String(value); this.children=[];}
  addEventListener(type,fn){(this.listeners[type] ||= []).push(fn);}
  removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(value=>value!==fn);}
  focus(){if(!this.disabled) this.document.activeElement=this;}
  select(){this.selected=true;}
  scrollIntoView(){}
  contains(node){return node===this || this.children.some(child=>child.contains(node));}
  matches(selector){
    const attr=/\[([^=\]]+)(?:="([^"]*)")?\]/.exec(selector);
    if(attr && !(attr[1] in this.attrs)) return false;
    if(attr?.[2]!=null && this.attrs[attr[1]]!==attr[2]) return false;
    const bare=selector.replace(/\[[^\]]+\]/g,'');
    const id=/#([\w-]+)/.exec(bare); if(id && this.id!==id[1]) return false;
    const tag=/^[\w-]+/.exec(bare); if(tag && this.tagName!==tag[0].toUpperCase()) return false;
    return [...bare.matchAll(/\.([\w-]+)/g)].every(match=>this.classList.contains(match[1]));
  }
  querySelectorAll(selector){
    const found=[];
    const parts=selector.split(',').map(value=>value.trim());
    const walk=node=>node.children.forEach(child=>{if(parts.some(part=>child.matches(part))) found.push(child); walk(child);});
    walk(this); return found;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0] || null;}
  async emit(type,extras={}){
    if(this.disabled && type==='click') return;
    const event={type,target:this,currentTarget:this,preventDefault(){this.prevented=true;},...extras};
    await Promise.all((this.listeners[type]||[]).map(fn=>fn(event)));
    await settle();
  }
}

function fixture(){
  const document={activeElement:null,listeners:{},addEventListener(type,fn){(this.listeners[type] ||= []).push(fn);},removeEventListener(type,fn){this.listeners[type]=(this.listeners[type]||[]).filter(value=>value!==fn);}};
  document.body=new Node('body'); document.body.document=document;
  const el=(tag,attrs={},...children)=>{const node=new Node(tag,attrs); node.document=document; children.flat().forEach(child=>node.appendChild(child)); return node;};
  const add=(id,tag='div',attrs={},parent=document.body)=>{const node=el(tag,{id,...attrs}); parent.appendChild(node); return node;};
  const historyModal=add('historyModal'); add('snapSearch','input',{},historyModal); add('snapList','div',{},historyModal);
  const savePopup=add('savePopup'); add('saveName','input',{},savePopup);
  const save=el('button',{class:'small primary'},'保存'); savePopup.appendChild(save);
  savePopup.appendChild(el('button',{class:'small'},'取消'));
  ['saveBtn','demoBanner','demoBtn','saveStatus','archiveLabel','archiveLabelText','archiveRenameBtn'].forEach(id=>add(id,id.endsWith('Btn')?'button':'div'));
  document.querySelector=selector=>document.body.querySelector(selector);
  document.querySelectorAll=selector=>{
    const split=selector.indexOf(' ');
    if(split>=0 && selector.startsWith('#')) return document.querySelector(selector.slice(0,split))?.querySelectorAll(selector.slice(split+1)) || [];
    return document.body.querySelectorAll(selector);
  };
  const $=selector=>document.querySelector(selector);
  const f={document,$,toasts:[],confirms:[],choices:[],confirmValue:false,choiceValue:null,invalidations:0,calls:[],saveResult:true};
  f.versions=new Map();
  f.add=(name,marker=name)=>{const meta={id:'named_'+name,name,type:'named',created_at:1}; f.versions.set(meta.id,{meta,state:{meta:{},settings:{api:{}},work1:{marker},work2:{},work3:{},work4:{},work5:{}}}); return meta;};
  const source=f.add('源版本','historical source');
  const context={console,Map,setTimeout,clearTimeout,document,$,el,dirty:true,lastServerStamp:99,
    state:{meta:{loadedFrom:source.name,loadedFromId:source.id},settings:{api:{backendUrl:'http://local-test'}},work1:{marker:'live changes'},work2:{},work3:{},work4:{},work5:{}},
    showToast:message=>f.toasts.push(message),markDirty:()=>{context.dirty=true;},
    mergeWithDefaults:clone,
    App:{renderAll(){f.rendered=true;},updateSummary(){},updateArchiveLabel(){const meta=context.state.meta; $('#archiveLabel').hidden=!meta.loadedFrom; $('#archiveLabelText').textContent=meta.loadedFrom||'';}},
    Interaction:{validSnapshot:meta=>!!(meta && typeof meta==='object' && typeof meta.id==='string' && meta.id.trim() && typeof meta.name==='string' && meta.name.trim()),
      confirm:async options=>{f.confirms.push(options); return f.confirmGate? f.confirmGate.promise : f.confirmValue;},
      choose:async options=>{f.choices.push(options); return f.choiceValue;},invalidateUndo:()=>f.invalidations++,
      notice:options=>{f.notice=options;},clearNotice:()=>{f.notice=null;}},
    saveNow:async()=>{f.calls.push({method:'save'}); if(f.saveError) throw f.saveError; if(f.saveGate) return f.saveGate.promise; if(f.saveResult) context.dirty=false; return f.saveResult;}
  };
  context.Archive={normalizeName,list:async()=>{if(f.listError) throw f.listError; return [...f.versions.values()].map(value=>clone(value.meta));},
    restore:async(id,opts)=>{f.calls.push({method:'restore',id,opts}); if(f.restoreError) throw f.restoreError; if(f.restoreGate) return f.restoreGate.promise; const value=f.versions.get(id); return {state:clone(value.state),snapshot:clone(f.restoreMeta||value.meta)};},
    remove:async id=>{f.calls.push({method:'remove',id}); if(f.removeError) throw f.removeError; return f.versions.delete(id);},
    create:async opts=>{f.calls.push({method:'create',opts}); if(f.createError) throw f.createError; if(f.createMeta) return f.createMeta; const name=normalizeName(opts.name)||'时间版本'; let actual=name,i=0; while(!opts.overwrite && f.versions.has('named_'+actual)) actual=name+'('+(++i)+')'; return clone(f.add(actual,'live changes'));},
    rename:async(id,name,opts)=>{f.calls.push({method:'rename',id,name,opts}); if(f.renameError) throw f.renameError; if(f.renameMeta) return f.renameMeta;
      const source=f.versions.get(id); const base=normalizeName(name); let actual=base,i=0; while(!opts.overwrite && f.versions.has('named_'+actual) && (opts.copy || id!=='named_'+actual)) actual=base+'('+(++i)+')';
      const meta={id:'named_'+actual,name:actual,type:'named',created_at:2}; f.versions.set(meta.id,{meta,state:clone(source.state)}); if(!opts.copy && meta.id!==id) f.versions.delete(id); return clone(meta);}
  };
  context.window=context; vm.createContext(context);
  for(const file of ['history.js','savepanel.js']) vm.runInContext(fs.readFileSync(path.join(root,'docs/lib',file),'utf8'),context,{filename:file});
  save.addEventListener('click',()=>context.SavePanel.commit());
  f.context=context; f.History=context.History; f.SavePanel=context.SavePanel; f.source=source;
  f.row=id=>$('#snapList').querySelectorAll('.expert-row').find(row=>row.dataset.id===(id||source.id));
  f.action=(name,id)=>f.row(id).querySelector('button[data-act="'+name+'"]');
  f.rename=async value=>{await f.History.rename(source.id); const inp=f.row().querySelector('.snap-rename'); inp.value=value; await inp.emit('input'); return inp;};
  return f;
}

let passed=0;
async function check(name,fn){await fn(); passed++; console.log('PASS '+name);}
async function main(){
  for(const dirty of [true,false]){
    await check('A01 '+(dirty?'dirty':'saved')+' load cancel confirms exact name and sends no restore',async()=>{
      const f=fixture(); f.context.dirty=dirty; const original=clone(f.context.state); await f.History.open();
      await f.action('load').emit('click');
      assert.equal(f.confirms.length,1); assert.match(f.confirms[0].message,/加载「源版本」/); assert.equal(f.confirms[0].message.startsWith('当前有未保存改动。'),dirty);
      assert.equal(f.confirms[0].confirmLabel,'加载并覆盖'); assert.deepEqual(clone(f.context.state),original);
      assert.equal(f.calls.filter(call=>call.method==='restore').length,0); assert.equal(f.invalidations,0);
      assert.equal(f.document.activeElement,f.action('load'));
    });
    await check('A02 '+(dirty?'dirty':'saved')+' load failure keeps state, undo and retry button',async()=>{
      const f=fixture(); f.context.dirty=dirty; f.confirmValue=true; f.restoreError=new Error('offline'); const original=clone(f.context.state); await f.History.open();
      await f.action('load').emit('click');
      assert.deepEqual(clone(f.context.state),original); assert.equal(f.context.dirty,dirty); assert.equal(f.invalidations,0); assert.equal(f.action('load').disabled,false); assert.equal(f.action('load').textContent,'加载');
      assert(f.toasts.some(text=>text.includes('加载失败：offline'))); assert(!f.toasts.some(text=>text.startsWith('已加载')));
    });
  }
  await check('A01 restore has one request, no backup and takes server actual metadata',async()=>{
    const f=fixture(); f.confirmValue=true; f.restoreGate=deferred(); await f.History.open(); const load=f.action('load');
    const pending=f.History.load(f.source.id,load); await settle(); await f.History.load(f.source.id,load);
    assert.equal(f.calls.filter(call=>call.method==='restore').length,1); assert.equal(load.disabled,true); assert.equal(load.textContent,'加载中…');
    f.restoreGate.resolve({state:clone(f.versions.get(f.source.id).state),snapshot:{id:'named_实际版本',name:'实际版本',type:'named'}}); await pending;
    assert.equal(f.context.state.work1.marker,'historical source'); assert.equal(f.context.state.settings.api.backendUrl,'http://local-test'); assert.equal(f.context.state.meta.loadedFrom,'实际版本');
    assert.equal(f.context.state.meta.loadedFromId,'named_实际版本'); assert.equal(f.context.dirty,false); assert.equal(f.invalidations,1); assert.equal(f.toasts.at(-1),'已加载版本：实际版本');
    assert.equal(f.calls.filter(call=>call.method==='create').length,0);
    assert.equal(f.calls.filter(call=>call.method==='save').length,1);
  });
  await check('history load persists migrations in one awaited path and reports post-load save failure',async()=>{
    const f=fixture();f.confirmValue=true;f.saveResult=false;
    await f.History.open();await f.action('load').emit('click');
    assert.equal(f.context.state.work1.marker,'historical source');assert.equal(f.context.dirty,true);
    assert.match(f.toasts.at(-1),/内容已更新但未保存/);assert.equal(f.notice.actionLabel,'重试保存');
    assert.equal(f.calls.filter(call=>call.method==='create').length,0);
  });
  await check('A02 invalid restore metadata keeps live state and undo',async()=>{
    const f=fixture(); f.confirmValue=true; f.restoreMeta={}; const original=clone(f.context.state); await f.History.open(); await f.action('load').emit('click');
    assert.deepEqual(clone(f.context.state),original); assert.equal(f.invalidations,0); assert(!f.toasts.some(text=>text.startsWith('已加载')));
  });
  await check('A02 invalid restore workshop content keeps live state and undo',async()=>{
    const f=fixture(); f.confirmValue=true; const original=clone(f.context.state);
    f.context.Archive.restore=async()=>({state:{meta:{},settings:{}},snapshot:f.source});
    await f.History.open(); await f.action('load').emit('click');
    assert.deepEqual(clone(f.context.state),original); assert.equal(f.invalidations,0); assert(!f.toasts.some(text=>text.startsWith('已加载')));
  });
  await check('A03 top rename opens visible editor; blur/filter preserve draft; Escape cancels',async()=>{
    const f=fixture(); f.$('#snapSearch').value='does not match'; const input=await f.rename('新草稿');
    assert(f.$('#historyModal').classList.contains('open')); assert.equal(f.calls.filter(call=>call.method==='rename').length,0);
    assert(f.action('rename-save')); assert(f.action('rename-cancel')); assert.match(f.row().textContent,/Enter 保存 · Esc 取消/);
    await input.emit('blur'); assert.equal(f.row().querySelector('.snap-rename').value,'新草稿');
    f.$('#snapSearch').value='none'; await f.History.render(); assert.equal(f.row(),undefined);
    f.$('#snapSearch').value=''; await f.History.render(); const restored=f.row().querySelector('.snap-rename'); assert.equal(restored.value,'新草稿');
    await restored.emit('keydown',{key:'Escape'}); assert.equal(f.row().querySelector('.snap-rename'),null); assert.equal(f.calls.filter(call=>call.method==='rename').length,0);
  });
  await check('A03 Enter commits actual name and source pointer; empty stays editable',async()=>{
    const f=fixture(); let input=await f.rename('   '); await input.emit('keydown',{key:'Enter'});
    assert.match(f.row().textContent,/名称不能为空/); assert.equal(f.calls.filter(call=>call.method==='rename').length,0);
    input=f.row().querySelector('.snap-rename'); input.value='新名'; await input.emit('keydown',{key:'Enter'});
    assert.equal(f.context.state.meta.loadedFrom,'新名'); assert.equal(f.context.state.meta.loadedFromId,'named_新名'); assert.equal(f.toasts.at(-1),'已重命名为：新名');
  });
  for(const choice of ['overwrite','copy',null]){
    await check('A04 rename conflict '+choice+' preserves the right historical content',async()=>{
      const f=fixture(); f.context.dirty=false; f.add('终版','target content'); f.add('终版(1)','earlier suffix'); f.choiceValue=choice;
      const input=await f.rename('终版'); await input.emit('keydown',{key:'Enter'});
      assert.equal(f.choices.length,1); assert.deepEqual(clone(f.choices[0].actions.map(action=>action.value)),['overwrite','copy',null]);
      if(choice===null){assert.equal(f.calls.filter(call=>call.method==='rename').length,0); assert.equal(f.versions.size,3); assert.equal(f.context.state.meta.loadedFromId,f.source.id); assert.equal(f.row().querySelector('.snap-rename'),null);}
      if(choice==='overwrite'){assert.equal(f.versions.has(f.source.id),false); assert.equal(f.versions.get('named_终版').state.work1.marker,'historical source'); assert.equal(f.context.state.meta.loadedFromId,'named_终版'); assert.equal(f.toasts.at(-1),'已覆盖版本：终版');}
      if(choice==='copy'){assert.equal(f.versions.get(f.source.id).state.work1.marker,'historical source'); assert.equal(f.versions.get('named_终版').state.work1.marker,'target content'); assert.equal(f.versions.get('named_终版(2)').state.work1.marker,'historical source'); assert.equal(f.context.state.meta.loadedFromId,f.source.id); assert.equal(f.context.dirty,false); assert.equal(f.toasts.at(-1),'已另存为：终版(2)'); assert(f.row().querySelector('.snap-name').textContent==='源版本');}
    });
    await check('A04 save conflict '+choice+' has explicit cancel and uses actual server name',async()=>{
      const f=fixture(); f.add('终版','target content'); f.add('终版(1)','earlier suffix'); f.choiceValue=choice; f.SavePanel.open(); f.$('#saveName').value='终版';
      const result=await f.SavePanel.commit(); assert.equal(f.calls.filter(call=>call.method==='save').length,1); assert.equal(f.choices.length,1);
      if(choice===null){assert.equal(result,null); assert.equal(f.calls.filter(call=>call.method==='create').length,0); assert.equal(f.versions.size,3); assert(!f.toasts.some(text=>text.startsWith('已')));}
      if(choice==='overwrite'){assert.equal(f.versions.get('named_终版').state.work1.marker,'live changes'); assert.equal(f.toasts.at(-1),'已覆盖版本：终版');}
      if(choice==='copy'){assert.equal(f.versions.get('named_终版').state.work1.marker,'target content'); assert.equal(f.toasts.at(-1),'已另存为：终版(2)');}
      assert.equal(f.context.state.meta.loadedFromId,f.source.id);
    });
  }
  for(const failure of ['list','rename','invalid']){
    await check('A05 rename '+failure+' failure preserves draft and emits no success',async()=>{
      const f=fixture(); const input=await f.rename('草稿');
      if(failure==='list') f.listError=new Error('list offline'); if(failure==='rename') f.renameError=new Error('write denied'); if(failure==='invalid') f.renameMeta={};
      await input.emit('keydown',{key:'Enter'}); assert.equal(f.row().querySelector('.snap-rename').value,'草稿'); assert.equal(f.row().querySelector('.snap-rename').disabled,false); assert.equal(f.context.state.meta.loadedFromId,f.source.id);
      assert(!f.toasts.some(text=>text.startsWith('已'))); if(failure==='list') assert.equal(f.calls.filter(call=>call.method==='rename').length,0);
    });
  }
  for(const failure of ['saveFalse','saveThrow','create','invalid','list']){
    await check('A05 save '+failure+' failure keeps version input and permits retry',async()=>{
      const f=fixture(); if(failure==='saveFalse') f.saveResult=false; if(failure==='saveThrow') f.saveError=new Error('save denied'); if(failure==='create') f.createError=new Error('snapshot denied'); if(failure==='invalid') f.createMeta={}; if(failure==='list') f.listError=new Error('list offline');
      f.SavePanel.open(); f.$('#saveName').value='草稿'; await f.SavePanel.commit();
      assert.equal(f.$('#saveName').value,'草稿'); assert(f.$('#savePopup').classList.contains('open')); assert.equal(f.$('#saveName').disabled,false); assert.equal(f.SavePanel._busy,false); assert(!f.toasts.some(text=>text.startsWith('已')));
      if(failure.startsWith('save')){assert.equal(f.calls.filter(call=>call.method==='create').length,0); assert.equal(f.context.dirty,true); assert.match(f.$('#savePopup').textContent,/保存当前内容失败/);} else assert.match(f.$('#savePopup').textContent,/创建历史版本失败/);
    });
  }
  await check('save waits for persistence and prevents duplicate submission',async()=>{
    const f=fixture(); f.saveGate=deferred(); f.SavePanel.open(); f.$('#saveName').value=''; const pending=f.SavePanel.commit(); await settle(); await f.SavePanel.commit(); f.SavePanel.cancel();
    assert.equal(f.calls.filter(call=>call.method==='save').length,1); assert.equal(f.calls.filter(call=>call.method==='create').length,0); assert.equal(f.$('#saveName').disabled,true); assert(f.$('#savePopup').classList.contains('open'));
    f.saveGate.resolve(true); await pending; assert.equal(f.calls.filter(call=>call.method==='create').length,1); assert.equal(f.calls.find(call=>call.method==='create').opts.name,''); assert.equal(f.toasts.at(-1),'已存档：时间版本');
  });
  await check('A15 delete confirms exact irreversible snapshot scope; cancel preserves workspace',async()=>{
    const f=fixture(); const original=clone(f.context.state); await f.History.open(); await f.action('delete').emit('click');
    assert.match(f.confirms[0].message,/历史版本「源版本」/); assert.match(f.confirms[0].message,/不可恢复/); assert.match(f.confirms[0].message,/不删除当前工作区内容/); assert.deepEqual(clone(f.context.state),original); assert.equal(f.calls.filter(call=>call.method==='remove').length,0);
    f.confirmValue=true; await f.action('delete').emit('click'); assert.equal(f.context.state.meta.loadedFromId,null); assert.equal(f.context.state.meta.loadedFrom,null); assert.equal(f.context.state.work1.marker,'live changes'); assert.equal(f.$('#archiveLabel').hidden,true); assert.equal(f.invalidations,0);
  });
  await check('A15 failed snapshot delete leaves current source label intact',async()=>{
    const f=fixture(); f.confirmValue=true; f.removeError=new Error('delete denied'); await f.History.open(); await f.action('delete').emit('click');
    assert.equal(f.context.state.meta.loadedFromId,f.source.id); assert.equal(f.versions.has(f.source.id),true); assert(!f.toasts.some(text=>text.startsWith('已删除')));
  });
  await check('case-mode archive mutations stop before confirmation or requests',async()=>{
    const f=fixture(); f.context.state.meta.demoCase='sample'; await f.History.open(); await f.History.load(f.source.id); await f.History.rename(f.source.id); await f.History.del(f.source.id); f.SavePanel.open();
    assert.equal(f.calls.length,0); assert.equal(f.confirms.length,0); assert.equal(f.$('#savePopup').classList.contains('open'),false);
  });
  console.log('\n'+passed+' archive interaction checks passed');
}
module.exports={fixture,settle};
if(require.main===module) main().catch(error=>{console.error(error.stack); process.exitCode=1;});
