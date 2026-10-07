/* ============================================================
 Store — 2026-09-01 架构评审候选 4：从 global-brand-building.html 内联脚本抽出。
 依赖均为运行时全局（el / state / saveNow / Archive / App 等），浏览器可用，
 node 测试通过注入对应 stub 直接命中接口。
 ============================================================ */
(function(){
 'use strict';

const Store = {
  projectId: 'default',
  _chain: Promise.resolve(),

  save(stateObj){
    if(!stateObj) return Promise.resolve();
    // 2026-09-03: 案例 = 只读浏览（决策翻转 2026-08-26 可编辑）。
    // 保存闸门在 html saveNow 统一拦截（isDemo 时不写盘），此处不重复。
    // Serialize saves — rapid edits must not race the server.
    this._chain = this._chain.then(()=>this._doSave(stateObj)).catch(()=>{});
    return this._chain;
  },

  async _doSave(stateObj){
    const stamp=new Date().toISOString();
    try{
      const res = await fetch(apiUrl('/api/state'), {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({project_id:this.projectId, state:{...stateObj,meta:{...stateObj.meta,savedAt:stamp}}})
      });
      if(res.ok){
        stateObj.meta.savedAt=stamp;
        // BIZ03：基准跟随每次落盘（含迁移直写路径），saveNow 的写前对账不误报。
        if(typeof lastServerStamp!=='undefined') lastServerStamp=stamp;
        const ss=$('#saveStatus'); if(ss) ss.textContent='已保存 · '+new Date().toLocaleTimeString();
        return true;
      }
      showToast('保存失败: HTTP '+res.status);
      const ss=$('#saveStatus');if(ss)ss.textContent='未保存 · 保存失败';
      return false;
    }catch(e){ showToast('保存失败: '+e.message);const ss=$('#saveStatus');if(ss)ss.textContent='未保存 · 保存失败';return false; }
  },

  async load(){
    try{
      const res = await fetch(apiUrl('/api/state')+'?project_id='+encodeURIComponent(this.projectId));
      if(!res.ok) return null;  // 404 = no saved state yet
      return await res.json();
    }catch{ return null; }
  },

  // One-time migration: legacy localStorage data (and its plaintext key) → server.
  async migrateFromLocalStorage(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      const legacyKey = parsed?.settings?.api?.apiKey || '';
      if(legacyKey){
        try{
          const cfg = await (await fetch(apiUrl('/api/config'))).json();
          if(!cfg.apiKeyExists){
            const api = parsed.settings.api;
            await fetch(apiUrl('/api/config'), {method:'PUT', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({
                provider:api.provider||cfg.provider, baseUrl:api.baseUrl||cfg.baseUrl,
                model:api.model||cfg.model, temperature:api.temperature??cfg.temperature,
                backendUrl:api.backendUrl||cfg.backendUrl, apiKey:legacyKey
              })});
          }
        }catch{}
      }
      const merged = mergeWithDefaults(parsed,{persistMigrations:false});
      // Never persist a plaintext key inside the state file — masked flag only.
      merged.settings.api.apiKey = legacyKey ? '********' : '';
      const saved=await fetch(apiUrl('/api/state'), {method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({project_id:this.projectId, state:merged})});
      if(!saved.ok)throw new Error('迁移保存失败: HTTP '+saved.status);
      localStorage.removeItem(STORAGE_KEY);
      return merged;
    }catch(e){ console.error('migration failed', e); return null; }
  }
};

 if(typeof window!=='undefined') window.Store = Store;
 if(typeof module!=='undefined' && module.exports) module.exports = Store;
})();
