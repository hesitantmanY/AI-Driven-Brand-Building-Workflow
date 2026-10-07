/* ============================================================
 SavePanel — 2026-09-01 架构评审候选 4：从 global-brand-building.html 内联脚本抽出。
 依赖均为运行时全局（el / state / saveNow / Archive / App 等），浏览器可用，
 node 测试通过注入对应 stub 直接命中接口。
 ============================================================ */
(function(){
 'use strict';

const SavePanel = {
  open(){
    // BIZ02：案例 = 只读浏览，版本面板一并锁住（旧注释时代用 isDemo 拦保存，
    // 2026-08-26 移除后案例可编辑；现按决策恢复为只读）。
    if(this._busy) return;
    if(state?.meta?.isDemo || state?.meta?.demoCase){ showToast('案例浏览中：不可存档'); return; }
    $('#savePopup').classList.add('open');
    const inp=$('#saveName');
    inp.value='';
    this._stage('');
    setTimeout(()=>inp.focus(), 0);
    document.addEventListener('keydown', this._key);
    document.addEventListener('click', this._outside);
  },
  cancel(){
    if(this._busy) return;
    $('#savePopup').classList.remove('open');
    document.removeEventListener('keydown', this._key);
    document.removeEventListener('click', this._outside);
  },
  _key(e){
    if(e.key==='Escape') SavePanel.cancel();
  },
  _outside(e){
    const pop=$('#savePopup');
    if(pop.contains(e.target) || (e.target.id==='saveBtn')) return;
    SavePanel.cancel();
  },
  _stage(message){
    const pop=$('#savePopup');
    let status=pop.querySelector('.save-stage');
    if(!status){ status=el('p',{class:'hint save-stage',role:'status'}); pop.appendChild(status); }
    status.textContent=message; status.hidden=!message;
  },
  _setBusy(busy, stage=''){
    this._busy=busy;
    const pop=$('#savePopup');
    pop.querySelectorAll('input, button').forEach(control=>{ control.disabled=busy; });
    const button=pop.querySelector('button.primary');
    if(button) button.textContent=busy? stage : '保存';
  },
  async commit(){
    if(this._busy || !$('#savePopup').classList.contains('open')) return;
    if(state?.meta?.isDemo || state?.meta?.demoCase){ showToast('案例浏览中：不可存档'); return; }
    const name=$('#saveName').value.trim();
    this._setBusy(true,'保存中…');
    let stage='保存当前内容';
    this._stage('保存当前工作区…');
    try{
      const persisted=await saveNow();
      if(persisted!==true) throw new Error('当前内容尚未持久化，请重试');
      stage='创建历史版本';
      this._stage('创建历史版本…');
      let overwrite=false, copy=false;
      if(name){
        const snaps=await Archive.list();
        const targetName=Archive.normalizeName(name);
        if(snaps.some(s=>s.type==='named' && s.name===targetName)){
          const action=await Interaction.choose({
            title:'已存在同名版本',
            message:'已存在版本「'+targetName+'」。覆盖会替换它的旧内容；另存会保留原版本并生成可用后缀。',
            actions:[{value:'overwrite',label:'覆盖旧版本',danger:true},{value:'copy',label:'另存为新版本'},{value:null,label:'取消此次操作'}],
            trigger:$('#savePopup').querySelector('button.primary') || $('#saveName')
          });
          if(action!=='overwrite' && action!=='copy'){
            this._setBusy(false); this.cancel();
            $('#saveBtn')?.focus();
            return null;
          }
          overwrite=action==='overwrite'; copy=action==='copy';
        }
      }
      const snap=await Archive.create({name, overwrite});
      if(!Interaction.validSnapshot(snap)) throw new Error('服务端未返回有效版本信息');
      this._setBusy(false); this.cancel();
      $('#saveBtn')?.focus();
      showToast((overwrite? '已覆盖版本：' : copy? '已另存为：' : '已存档：')+snap.name);
      if(typeof History!=='undefined' && $('#historyModal')?.classList.contains('open')) await History.render();
      return snap;
    }catch(e){
      const message=stage+'失败：'+e.message;
      this._stage(message+'。保留版本名，可重新保存。');
      showToast(message);
      return null;
    }finally{
      this._setBusy(false);
      if($('#savePopup').classList.contains('open')) $('#saveName')?.focus();
    }
  }
};

 if(typeof window!=='undefined') window.SavePanel = SavePanel;
 if(typeof module!=='undefined' && module.exports) module.exports = SavePanel;
})();
