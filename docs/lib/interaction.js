/* Shared interaction policy. Transient UI state never enters the workshop schema. */
(function(){
  'use strict';
  const pending = new Map();
  const busy = new Set();
  let serial=0, epoch=0, undoHost=null, noticeHost=null;
  const current=()=>typeof state!=='undefined' ? state : (typeof window!=='undefined' ? window.state : null);
  const locked=()=>!!(current()?.meta?.isDemo || current()?.meta?.demoCase);
  const now=()=>Date.now();
  const contentStamp=()=>JSON.stringify([current()?.work1,current()?.work2,current()?.work3,current()?.work4,current()?.work5]);
  const restoreFocus=target=>{ if(target && target.isConnected!==false && typeof target.focus==='function') target.focus(); };
  // Keep unique transient slots, including currently deleted rows. Subsequent
  // deletions must remember neighbours that still have their own undo entry.
  function syncSlots(collection,items){
    const available=collection.slots.filter(slot=>!slot.removed), used=new Set();
    const live=items.map(item=>{
      let slot=available.find(slot=>!used.has(slot)&&slot.item===item);
      if(slot)used.add(slot);
      else slot={item,removed:false};
      return slot;
    });
    live.forEach((slot,index)=>{
      if(collection.slots.includes(slot))return;
      const after=live.slice(index+1).find(next=>collection.slots.includes(next));
      const before=live.slice(0,index).reverse().find(previous=>collection.slots.includes(previous));
      const at=after?collection.slots.indexOf(after):before?collection.slots.indexOf(before)+1:collection.slots.length;
      collection.slots.splice(at,0,slot);
    });
    return live;
  }

  const Interaction={
    validSnapshot(meta){
      return !!(meta && typeof meta==='object' && typeof meta.id==='string' && meta.id.trim() && typeof meta.name==='string' && meta.name.trim());
    },
    choose({title,message,actions,trigger}={}){
      const previous=trigger || document.activeElement;
      return new Promise(resolve=>{
        const id='interaction-dialog-'+(++serial);
        const backdrop=el('div',{class:'modal-backdrop open interaction-dialog'});
        const panel=el('div',{class:'modal',role:'dialog','aria-modal':'true','aria-labelledby':id+'-title','aria-describedby':id+'-message'});
        let finished=false;
        const finish=value=>{
          if(finished) return;
          finished=true;
          document.removeEventListener('keydown',key,true);
          document.removeEventListener('focusin',focus,true);
          suspended.forEach(([node,wasInert])=>{ node.inert=wasInert; });
          backdrop.remove();
          restoreFocus(previous);
          resolve(value);
        };
        panel.appendChild(el('button',{type:'button',class:'modal-close','aria-label':'关闭'+title,title:'关闭'+title,onclick:()=>finish(null)},'×'));
        panel.appendChild(el('h2',{id:id+'-title'},title));
        panel.appendChild(el('p',{id:id+'-message',class:'interaction-message'},message));
        const row=el('div',{class:'actions'});
        const buttons=(actions||[]).map(action=>el('button',{
          type:'button',class:'small '+(action.danger?'danger':'ghost'),
          onclick:()=>finish(action.value)
        },action.label));
        buttons.forEach(button=>row.appendChild(button));
        panel.appendChild(row); backdrop.appendChild(panel);
        // Existing history/settings dialogs may be open underneath this decision.
        const suspended=Array.from(document.body.children).filter(n=>n.tagName!=='SCRIPT').map(n=>[n,!!n.inert]);
        suspended.forEach(([node])=>{ node.inert=true; });
        document.body.appendChild(backdrop);
        const defaultButton=buttons[(actions||[]).findIndex(a=>a.value==null)] || buttons[0];
        const focusable=()=>Array.from(panel.querySelectorAll('button,input,select,textarea,[tabindex]')).filter(n=>!n.disabled && n.tabIndex>=0);
        function focus(e){ if(!panel.contains(e.target)) restoreFocus(defaultButton); }
        function key(e){
          if(e.key==='Escape'){ e.preventDefault(); e.stopImmediatePropagation(); finish(null); }
          if(e.key==='Tab'){
            const nodes=focusable(), first=nodes[0],last=nodes[nodes.length-1];
            if(e.shiftKey && document.activeElement===first){ e.preventDefault(); restoreFocus(last); }
            else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); restoreFocus(first); }
          }
        }
        document.addEventListener('keydown',key,true);
        document.addEventListener('focusin',focus,true);
        backdrop.addEventListener('click',e=>{ if(e.target===backdrop) finish(null); });
        restoreFocus(defaultButton);
      });
    },
    async confirm({title,message,confirmLabel='删除',trigger}={}){
      return (await this.choose({title,message,trigger,actions:[{value:null,label:'取消'},{value:true,label:confirmLabel,danger:true}]}))===true;
    },
    objectName(type,rawName,index=0,items=[],nameOf){
      const value=typeof rawName==='function' ? rawName() : rawName;
      const name=String(value||'').trim();
      const list=typeof items==='function'?items():items;
      const get=nameOf || (item=>typeof item==='string'?item:item?.name||item?.label||item?.text||'');
      if(!name) return '未命名'+type+'，第 '+(index+1)+' 项';
      return (list||[]).filter(item=>String(get(item)||'').trim()===name).length>1 ? name+'，第 '+(index+1)+' 项' : name;
    },
    deleteLabel(type,name,index,items,nameOf){ return '删除'+type+'：'+this.objectName(type,name,index,items,nameOf); },
    deleteButton(attrs,type,name,index,items,nameOf){
      const label=()=>this.deleteLabel(type,name,index,items,nameOf);
      const update=e=>{ const node=e.currentTarget; const text=label(); node.setAttribute('aria-label',text); node.setAttribute('title',text); node.setAttribute('data-tooltip',text); };
      const oldClick=attrs.onclick, oldFocus=attrs.onfocus, oldEnter=attrs.onpointerenter;
      return {...attrs, type:'button',class:(attrs.class||'ghost small')+' danger delete-control',
        'aria-label':label(),title:label(),'data-tooltip':label(),
        onfocus:e=>{update(e);if(oldFocus)oldFocus(e);},
        onpointerenter:e=>{update(e);if(oldEnter)oldEnter(e);},
        onclick:e=>{update(e);if(oldClick)return oldClick(e);}
      };
    },
    async removeItem({list,index,type,name,impact='',onChange=()=>{},trigger}={}){
      if(locked()) return false;
      const get=typeof list==='function'?list:()=>list;
      const items=get(); if(!items || index<0 || index>=items.length) return false;
      const workspace=current(), generation=epoch, item=items[index];
      const label=this.objectName(type,name,index,items);
      const cause=typeof impact==='function'?impact(item):impact;
      const origin=trigger || (typeof document!=='undefined'?document.activeElement:null);
      const scope=origin?.closest?.('.step') || null;
      const controls=scope?Array.from(scope.querySelectorAll('button,input,textarea,select,[tabindex]')):[];
      const focusIndex=controls.indexOf(origin);
      if(cause && !await this.confirm({title:'删除'+type+'？',message:'将删除'+type+'「'+label+'」。'+cause+' 此操作不可撤销。',confirmLabel:'删除'+type,trigger:origin})) return false;
      if(generation!==epoch || workspace!==current() || locked()) return false;
      const live=get(), at=live===items && live[index]===item?index:live.indexOf(item);
      if(at<0) return false;
      let collection=Array.from(pending.values()).map(record=>record.collection).find(group=>
        group && group.workspace===workspace && group.generation===generation && group.get()===live);
      if(!collection)collection={get,workspace,generation,slots:live.map(item=>({item,removed:false}))};
      const slots=syncSlots(collection,live), slot=slots[at];
      const originalAt=collection.slots.indexOf(slot);
      const before=collection.slots.slice(0,originalAt).reverse(),after=collection.slots.slice(originalAt+1);
      slot.removed=true;
      live.splice(at,1);
      onChange();
      // After remount, move to a nearby surviving control in the same step.
      if(scope && scope.isConnected!==false){
        const next=Array.from(scope.querySelectorAll('button,input,textarea,select,[tabindex]')).filter(n=>!n.disabled);
        const target=next[Math.min(Math.max(0,focusIndex),next.length-1)] || scope.querySelector('h2,h3');
        if(target?.matches?.('h2,h3'))target.setAttribute('tabindex','-1');
        restoreFocus(target);
      }
      if(cause){ if(typeof showToast==='function')showToast('已删除'+type+'：'+label); }
      else this.offerUndo({type,name:label,workspace,generation,collection,restore:()=>{
        const target=get();
        if(!Array.isArray(target)) return;
        const liveSlots=syncSlots(collection,target);
        let pos=-1;
        for(const anchor of after){ const n=liveSlots.indexOf(anchor); if(n>=0){pos=n;break;} }
        if(pos<0){ for(const anchor of before){const n=liveSlots.indexOf(anchor);if(n>=0){pos=n+1;break;}} }
        target.splice(pos<0?Math.min(at,target.length):pos,0,item);
        slot.removed=false;
        onChange();
      }});
      return true;
    },
    offerUndo({type,name,restore,workspace=current(),generation=epoch,collection=null}){
      const id=++serial;
      const record={id,type,name,restore,workspace,generation,collection,remaining:10000,started:now(),hover:false,focus:false,timer:null,node:null};
      pending.set(id,record);
      if(typeof document!=='undefined' && document.body){
        if(!undoHost || undoHost.isConnected===false){ undoHost=el('aside',{id:'undoNotices',class:'undo-notices','aria-label':'删除撤销'});document.body.appendChild(undoHost); }
        const label=el('span',{role:'status'},'已删除'+type+'：'+name+' · ');
        const countdown=el('span',{class:'undo-countdown','aria-hidden':'true'},'10 秒');
        const button=el('button',{type:'button',class:'ghost small',onclick:()=>this.undo(id),'aria-label':'撤销删除'+type+'：'+name},'撤销');
        const node=el('div',{class:'undo-notice','data-undo-id':id},label,button,countdown);
        record.node=node; record.countdown=countdown;
        node.addEventListener('pointerenter',()=>{record.hover=true;this._pauseUndo(record);});
        node.addEventListener('pointerleave',()=>{record.hover=false;this._resumeUndo(record);});
        node.addEventListener('focusin',()=>{record.focus=true;this._pauseUndo(record);});
        node.addEventListener('focusout',e=>{if(!node.contains(e.relatedTarget)){record.focus=false;this._resumeUndo(record);}});
        undoHost.appendChild(node);
      }
      this._resumeUndo(record);
      return id;
    },
    _pauseUndo(record){
      if(record.timer){clearInterval(record.timer);record.timer=null;record.remaining=Math.max(0,record.remaining-(now()-record.started));}
    },
    _resumeUndo(record){
      if(record.hover||record.focus||record.timer||!pending.has(record.id))return;
      if(record.remaining<=0){this._dropUndo(record.id);return;}
      record.started=now();
      record.timer=setInterval(()=>{
        const remaining=record.remaining-(now()-record.started);
        if(record.countdown)record.countdown.textContent=Math.max(0,Math.ceil(remaining/1000))+' 秒';
        if(remaining<=0)this._dropUndo(record.id);
      },100);
      if(record.timer?.unref)record.timer.unref();
    },
    _dropUndo(id){
      const record=pending.get(id);if(!record)return;
      if(record.timer)clearInterval(record.timer);
      record.node?.remove();pending.delete(id);
    },
    undo(id){
      const record=pending.get(id);if(!record)return false;
      if(record.generation!==epoch || record.workspace!==current() || locked()){this._dropUndo(id);return false;}
      this._pauseUndo(record);
      if(record.remaining<=0){this._dropUndo(id);return false;}
      this._dropUndo(id);record.restore();
      if(typeof showToast==='function')showToast('已撤销删除'+record.type+'：'+record.name);
      return true;
    },
    invalidateUndo(){
      epoch++;Array.from(pending.keys()).forEach(id=>this._dropUndo(id));
      // 产品调用均位于整体工作区替换边界，旧 AI 任务也不能继续写入。
      if(typeof Runner!=='undefined' && Runner.current && Runner.abort)Runner.abort();
    },
    notice({key,message,actionLabel='重试',onAction}){
      if(typeof document==='undefined'||!document.body)return;
      if(!noticeHost || noticeHost.isConnected===false){
        noticeHost=el('aside',{id:'interactionNotices',class:'interaction-notices','aria-live':'polite'});
        const main=document.querySelector('main');
        if(main)main.prepend(noticeHost);else document.body.appendChild(noticeHost);
      }
      this.clearNotice(key);
      const row=el('div',{class:'interaction-notice','data-notice-key':key},el('span',{role:'status'},message));
      if(onAction){
        const button=el('button',{type:'button',class:'ghost small',onclick:async()=>{
          if(button.disabled)return;button.disabled=true;
          try{await onAction();}finally{if(button.isConnected)button.disabled=false;}
        }},actionLabel);
        row.appendChild(button);
      }
      noticeHost.appendChild(row);
    },
    clearNotice(key){
      if(noticeHost)Array.from(noticeHost.children).filter(n=>n.dataset.noticeKey===key).forEach(n=>n.remove());
    },
    async runProtected({key,archiveName,apply,retry,refresh,onFailure,onComplete}){
      if(busy.has(key)||locked())return false;
      busy.add(key);
      const origin=current(),generation=epoch;
      let stage='保存当前内容',applied=false,updatedWorkspace=origin,updatedGeneration=generation;
      this.clearNotice(key);
      try{
        // Re-save and re-archive if inputs changed while either request ran.
        let stamp;
        do{
          stage='保存当前内容';stamp=contentStamp();
          this.notice({key,message:'正在保存当前内容…'});
          if(await saveNow()!==true)throw new Error('保存未成功，请检查连接后重试');
          if(origin!==current()||generation!==epoch)throw new Error('当前工作区已改变，请重试');
          if(stamp!==contentStamp())continue;
          stage='创建覆盖前版本';
          this.notice({key,message:'正在创建覆盖前版本…'});
          const meta=await Archive.create(archiveName?{name:archiveName}:{});
          if(!this.validSnapshot(meta))throw new Error('未收到有效版本信息');
          if(origin!==current()||generation!==epoch)throw new Error('当前工作区已改变，请重试');
        }while(stamp!==contentStamp());
        const changed=await apply();
        if(changed===false){this.clearNotice(key);return false;}
        applied=true;
        updatedWorkspace=current();updatedGeneration=epoch;
        if(typeof autosave==='function')autosave();
        if(refresh)refresh();
        stage='保存更新后的内容';
        this.notice({key,message:'正在保存更新后的内容…'});
        const saved=await saveNow();
        if(saved!==true || (typeof dirty!=='undefined' && dirty))throw new Error('保存未成功，请重试保存');
        this.clearNotice(key);
        if(onComplete)onComplete();
        return true;
      }catch(error){
        const reason=error?.message||String(error);
        const message=applied?'内容已更新但未保存。'+reason:'未完成：当前内容未被覆盖。'+stage+'失败：'+reason+'。';
        if(applied && typeof markDirty==='function')markDirty();
        if(onFailure)onFailure({applied,stage,reason,message});
        this.notice({key,message,actionLabel:applied?'重试保存':'重试',onAction:applied?async()=>{
          if(current()!==updatedWorkspace || epoch!==updatedGeneration){this.clearNotice(key);return;}
          try{
            if(await saveNow()!==true || (typeof dirty!=='undefined' && dirty))throw new Error('保存未成功');
            this.clearNotice(key);if(onComplete)onComplete();
          }catch(e){this.notice({key,message:'内容已更新但未保存。'+(e?.message||e),actionLabel:'重试保存',onAction:()=>this.retrySave(key,onComplete)});}
        }:retry});
        if(typeof showToast==='function')showToast(message,7000);
        return false;
      }finally{busy.delete(key);}
    },
    async retrySave(key,onComplete){
      try{
        if(await saveNow()!==true || (typeof dirty!=='undefined' && dirty))throw new Error('保存未成功');
        this.clearNotice(key);if(onComplete)onComplete();return true;
      }catch(e){
        this.notice({key,message:'内容已更新但未保存。'+(e?.message||e),actionLabel:'重试保存',onAction:()=>this.retrySave(key,onComplete)});return false;
      }
    },
    installTargetTips(){
      if(typeof document==='undefined'||this._tipsInstalled)return;
      this._tipsInstalled=true;
      const tip=el('div',{id:'interactionTargetTip',class:'interaction-target-tip',role:'tooltip',hidden:true});
      document.body.appendChild(tip);
      const show=target=>{
        const button=target?.closest?.('[data-tooltip]');
        if(!button || button.disabled){tip.hidden=true;return;}
        tip.textContent=button.getAttribute('data-tooltip');tip.hidden=false;
        const rect=button.getBoundingClientRect(),width=document.documentElement.clientWidth;
        tip.style.maxWidth=Math.max(120,width-24)+'px';
        tip.style.left=Math.max(12,Math.min(rect.left,width-tip.offsetWidth-12))+'px';
        tip.style.top=(rect.bottom+tip.offsetHeight+12<window.innerHeight?rect.bottom+6:Math.max(8,rect.top-tip.offsetHeight-6))+'px';
      };
      document.addEventListener('focusin',e=>show(e.target));
      document.addEventListener('focusout',()=>{tip.hidden=true;});
      document.addEventListener('pointerover',e=>show(e.target));
      document.addEventListener('pointerout',()=>{tip.hidden=true;});
      document.addEventListener('scroll',()=>{tip.hidden=true;},true);
      document.addEventListener('keydown',e=>{if(e.key==='Escape')tip.hidden=true;});
    }
  };
  if(typeof window!=='undefined')window.Interaction=Interaction;
  if(typeof module!=='undefined'&&module.exports)module.exports=Interaction;
})();
