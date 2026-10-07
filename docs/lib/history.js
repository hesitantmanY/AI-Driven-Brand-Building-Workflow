/* ============================================================
 History — 档案列表、显式加载确认和保留草稿的行内重命名。
 依赖运行时全局 el / state / Archive / Interaction / App。
 ============================================================ */
(function(){
 'use strict';

const History = {
  async open(){
    $('#historyModal').classList.add('open');
    await this.render();
  },
  close(){ $('#historyModal').classList.remove('open'); },
  _row(id){
    return Array.from(document.querySelectorAll('#snapList .expert-row')).find(r=>r.dataset.id===id);
  },
  _draftMap(){ return this._drafts || (this._drafts=new Map()); },
  _rememberDrafts(){
    const drafts=this._draftMap();
    document.querySelectorAll('#snapList .expert-row').forEach(row=>{
      const inp=row.querySelector('.snap-rename');
      if(inp && drafts.has(row.dataset.id)) drafts.get(row.dataset.id).value=inp.value;
    });
  },
  _locked(){
    if(state?.meta?.isDemo || state?.meta?.demoCase){ showToast('案例浏览中：不可修改档案版本'); return true; }
    return false;
  },
  _setOperation(operation){
    this._operation=operation;
    document.querySelectorAll('#snapList .expert-row').forEach(row=>{
      row.querySelectorAll('button, .snap-rename').forEach(control=>{ control.disabled=!!operation; });
      const load=row.querySelector('button[data-act="load"]');
      const del=row.querySelector('button[data-act="delete"]');
      const save=row.querySelector('button[data-act="rename-save"]');
      if(load) load.textContent=operation?.id===row.dataset.id && operation.kind==='load' && operation.phase==='request'? '加载中…' : '加载';
      if(del) del.textContent=operation?.id===row.dataset.id && operation.kind==='delete' && operation.phase==='request'? '删除中…' : '删除';
      if(save) save.textContent=operation?.id===row.dataset.id && operation.kind==='rename'? '保存中…' : '保存';
    });
  },
  _focus(id, action, fallback){
    const control=this._row(id)?.querySelector(action==='.snap-rename'? action : 'button[data-act="'+action+'"]');
    (control || fallback)?.focus?.();
  },
  async _snapshot(id){
    let snap=(this._snapshots || []).find(s=>s.id===id);
    if(!snap){
      const snaps=await Archive.list();
      this._snapshots=snaps;
      snap=snaps.find(s=>s.id===id);
    }
    if(!Interaction.validSnapshot(snap)) throw new Error('找不到有效的历史版本，请刷新列表');
    return snap;
  },
  _editor(s, draft){
    const inp=el('input',{type:'text',class:'snap-rename',value:draft.value,'aria-label':'重命名历史版本：'+s.name});
    inp.addEventListener('input',()=>{ draft.value=inp.value; });
    inp.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); draft.value=inp.value; this._commitRename(s.id, inp.value); }
      else if(e.key==='Escape'){ e.preventDefault(); this._cancelRename(s.id); }
    });
    // 失焦不提交；草稿由 input 事件和每次 render 前的采集共同保留。
    return el('div',{class:'snap-rename-editor'},
      inp,
      el('div',{class:'snap-rename-actions',style:'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px'},
        el('button',{type:'button',class:'small primary','data-act':'rename-save',onclick:()=>{ draft.value=inp.value; this._commitRename(s.id, inp.value); }},'保存'),
        el('button',{type:'button',class:'small','data-act':'rename-cancel',onclick:()=>this._cancelRename(s.id)},'取消')
      ),
      el('div',{class:'hint'},'Enter 保存 · Esc 取消'),
      draft.error? el('div',{class:'hint',role:'alert'},draft.error) : null
    );
  },
  async render(){
    this._rememberDrafts();
    const seq=(this._seq||0)+1; this._seq=seq;
    let snaps;
    try{
      snaps=await Archive.list();
      if(!Array.isArray(snaps)) throw new Error('服务端未返回有效版本列表');
    }catch(e){
      if(seq===this._seq) showToast('历史版本列表加载失败：'+e.message);
      return false;
    }
    if(seq!==this._seq) return false;
    this._rememberDrafts();
    this._snapshots=snaps;
    const q=($('#snapSearch').value||'').trim().toLowerCase();
    const visible=q? snaps.filter(s=>(s.name||'').toLowerCase().includes(q)) : snaps;
    const list=$('#snapList'); list.innerHTML='';
    if(!visible.length){
      list.appendChild(el('p',{class:'muted',tabindex:'-1'},q? '没有匹配的版本。' : '还没有历史版本。'));
      return true;
    }
    visible.forEach(s=>{
      const draft=this._draftMap().get(s.id);
      const time=new Date(s.created_at*1000).toLocaleString();
      const name=draft? this._editor(s,draft) : el('div',{class:'snap-name',style:'font-family:var(--font-mono);font-size:13px'},s.name);
      list.appendChild(el('div',{class:'expert-row','data-id':s.id},
        el('div',{style:'flex:1;min-width:0'},name,
          el('div',{class:'hint'},s.type==='time'? '时间名版本 · 保留最近 10 个' : time+' · 永久保留')
        ),
        el('button',{type:'button',class:'small','data-act':'load','data-name':s.name,'aria-label':'加载历史版本：'+s.name,onclick:e=>this.load(s.id,e.currentTarget)},'加载'),
        el('button',{type:'button',class:'small','data-act':'rename','aria-label':'重命名历史版本：'+s.name,onclick:e=>this.rename(s.id,e.currentTarget)},'重命名'),
        el('button',{type:'button',class:'small danger','data-act':'delete',title:'删除历史版本：'+s.name,'aria-label':'删除历史版本：'+s.name,onclick:e=>this.del(s.id,e.currentTarget)},'删除')
      ));
    });
    this._setOperation(this._operation);
    return true;
  },
  async rename(id, trigger=document.activeElement){
    if(this._operation || this._locked()) return;
    if(!$('#historyModal').classList.contains('open') || !this._row(id)){
      $('#snapSearch').value='';
      await this.open();
    }
    const row=this._row(id);
    if(!row){ showToast('找不到此历史版本，请刷新列表'); return; }
    if(!this._draftMap().has(id)){
      const snap=await this._snapshot(id);
      this._draftMap().set(id,{value:snap.name,error:'',trigger});
      const nameEl=row.querySelector('.snap-name');
      if(nameEl) nameEl.replaceWith(this._editor(snap,this._draftMap().get(id)));
      else await this.render();
    }
    const inp=this._row(id)?.querySelector('.snap-rename');
    inp?.focus(); inp?.select(); inp?.scrollIntoView?.({block:'nearest'});
  },
  async _cancelRename(id){
    if(this._operation) return;
    const trigger=this._draftMap().get(id)?.trigger;
    this._draftMap().delete(id);
    await this.render();
    this._focus(id,'rename',trigger);
  },
  async _commitRename(id, value, rerender=true){
    if(this._operation || this._locked()) return null;
    const drafts=this._draftMap();
    const draft=drafts.get(id) || {value:String(value||''),error:'',trigger:document.activeElement};
    drafts.set(id,draft); draft.value=String(value||'');
    const v=draft.value.trim();
    if(!v){
      draft.error='名称不能为空'; showToast(draft.error);
      if(rerender) await this.render();
      this._focus(id,'.snap-rename',draft.trigger);
      return null;
    }
    this._setOperation({kind:'rename',id});
    let meta=null, ended=false, copy=false;
    try{
      const snaps=await Archive.list();
      const targetName=Archive.normalizeName(v);
      const conflict=snaps.some(s=>s.type==='named' && s.id!==id && s.name===targetName);
      let overwrite=false;
      if(conflict){
        const action=await Interaction.choose({
          title:'已存在同名版本',
          message:'已存在版本「'+targetName+'」。覆盖会替换它的旧内容；另存会保留原版本并生成可用后缀。',
          actions:[{value:'overwrite',label:'覆盖旧版本',danger:true},{value:'copy',label:'另存为新版本'},{value:null,label:'取消此次操作'}],
          trigger:this._row(id)?.querySelector('button[data-act="rename-save"]') || draft.trigger
        });
        if(action!=='overwrite' && action!=='copy'){ drafts.delete(id); ended=true; return null; }
        overwrite=action==='overwrite'; copy=action==='copy';
      }
      meta=await Archive.rename(id,v,{overwrite,copy});
      if(!Interaction.validSnapshot(meta)) throw new Error('服务端未返回有效版本信息');
      if(!copy && state?.meta?.loadedFromId===id){
        state.meta.loadedFromId=meta.id;
        state.meta.loadedFrom=meta.name;
        if(typeof markDirty==='function') markDirty();
      }
      if(typeof App!=='undefined' && App.updateArchiveLabel) App.updateArchiveLabel();
      drafts.delete(id); ended=true;
      showToast((copy? '已另存为：' : overwrite? '已覆盖版本：' : '已重命名为：')+meta.name);
      return meta;
    }catch(e){
      draft.error='重命名失败：'+e.message;
      showToast(draft.error);
      return null;
    }finally{
      this._setOperation(null);
      if(rerender) await this.render();
      this._focus(ended? (copy? id : meta?.id || id) : id,ended? 'rename' : '.snap-rename',draft.trigger);
    }
  },
  async del(id, trigger=document.activeElement){
    if(this._operation || this._locked()) return false;
    this._setOperation({kind:'delete',id,phase:'confirm'});
    let removed=false;
    try{
      const snap=await this._snapshot(id);
      const confirmed=await Interaction.confirm({
        title:'删除历史版本？',
        message:'将删除历史版本「'+snap.name+'」。此操作不可恢复；只删除这一份历史快照，不删除当前工作区内容。',
        confirmLabel:'删除历史版本',trigger
      });
      if(!confirmed) return false;
      this._setOperation({kind:'delete',id,phase:'request'});
      if(await Archive.remove(id)!==true) throw new Error('服务端未确认版本已删除');
      removed=true;
      this._draftMap().delete(id);
      if(state?.meta?.loadedFromId===id){
        state.meta.loadedFrom=null; state.meta.loadedFromId=null;
        if(typeof markDirty==='function') markDirty();
        if(typeof App!=='undefined' && App.updateArchiveLabel) App.updateArchiveLabel();
      }
      showToast('已删除历史版本：'+snap.name);
      await this.render();
      return true;
    }catch(e){ showToast('删除失败：'+e.message); return false; }
    finally{
      this._setOperation(null);
      if(removed){
        const next=$('#snapList').querySelector('button[data-act="load"]') || $('#snapList').querySelector('p') || $('#snapSearch');
        next?.focus();
      }else this._focus(id,'delete',trigger);
    }
  },
  async load(id, trigger=document.activeElement){
    if(this._operation || this._locked()) return false;
    this._setOperation({kind:'load',id,phase:'confirm'});
    let replaced=false, actualName='';
    try{
      const snap=await this._snapshot(id);
      const warning=typeof dirty!=='undefined' && dirty? '当前有未保存改动。' : '';
      const confirmed=await Interaction.confirm({
        title:'加载并覆盖当前工作区？',
        message:warning+'加载「'+snap.name+'」将直接覆盖当前工作区，系统不会自动创建恢复备份。若要保留当前成果，请先取消并另存为版本。',
        confirmLabel:'加载并覆盖',trigger
      });
      if(!confirmed) return false;
      this._setOperation({kind:'load',id,phase:'request'});
      const restored=await Archive.restore(id,{withMeta:true});
      if(!Interaction.validSnapshot(restored?.snapshot)) throw new Error('服务端未返回有效版本信息');
      const data=restored.state;
      if(!data || typeof data!=='object' || Array.isArray(data) ||
         ![1,2,3,4,5].some(n=>data['work'+n] && typeof data['work'+n]==='object' && !Array.isArray(data['work'+n]))){
        throw new Error('服务端未返回有效工作区内容');
      }
      const next=mergeWithDefaults(data,{persistMigrations:false});
      next.settings=next.settings || {}; next.meta=next.meta || {};
      next.settings.api=state.settings.api;
      next.meta.isDemo=false; next.meta.demoCase=null; next.meta.demoSnapshot=null;
      next.meta.loadedFrom=restored.snapshot.name; next.meta.loadedFromId=restored.snapshot.id;
      actualName=restored.snapshot.name;
      state=next; replaced=true;
      if(typeof lastServerStamp!=='undefined') lastServerStamp=null;
      dirty=false;
      Interaction.invalidateUndo();
      this._draftMap().clear();
      $('#demoBanner').classList.remove('show');
      $('#demoBtn').textContent='载入案例 ▼';
      document.body.classList.remove('is-demo');
      this.close();
      App.renderAll(); App.updateSummary(); App.updateArchiveLabel();
      // Restore already replaced the server workspace. Persist merged defaults,
      // migrations and the actual source metadata through one awaited path.
      let saved=false;
      try{saved=await saveNow();}catch(_){/* 已覆盖后失败，不能再归为加载前失败。 */}
      if(saved!==true){
        dirty=true;
        if($('#saveStatus'))$('#saveStatus').textContent='未保存 · 保存失败';
        const message='已加载版本：'+actualName+'；内容已更新但未保存。';
        Interaction.notice({key:'history-load',message,actionLabel:'重试保存',onAction:()=>{
          if(state!==next){Interaction.clearNotice('history-load');return false;}
          return Interaction.retrySave('history-load');
        }});
        showToast(message);
      }else{
        Interaction.clearNotice('history-load');
        if($('#saveStatus')) $('#saveStatus').textContent='已保存';
        showToast('已加载版本：'+actualName);
      }
      return true;
    }catch(e){
      showToast(replaced? '已加载版本：'+actualName+'；页面更新失败：'+e.message : '加载失败：'+e.message);
      return replaced;
    }finally{
      this._setOperation(null);
      if(!replaced) this._focus(id,'load',trigger);
    }
  }
};

 if(typeof window!=='undefined') window.History = History;
 if(typeof module!=='undefined' && module.exports) module.exports = History;
})();
