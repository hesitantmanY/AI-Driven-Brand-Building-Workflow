/* ============================================================
 Archive — 档案存取深模块（2026-09-01 架构评审候选 5）。

 快照的 list / create / rename / remove / restore 唯一入口。
 调用方不碰 URL、project_id 与响应形状；失败 throw Error(服务端 detail)。
 浏览器与 node 测试跨同一接缝（真实 fetch / 测试假 fetch）。

 baseUrl 惰性读取当前 state.settings.api.backendUrl，与壳内 apiUrl
 同源；浏览器顶层 let state 不挂 window.state，Node 测试/DEFAULT_SETTINGS
 也按同一回退顺序兼容。
 ============================================================ */
(function(){
  'use strict';

  function currentState(){
    try{
      if(typeof state !== 'undefined' && state) return state;
    }catch(_){}
    return (typeof window !== 'undefined' && window.state) || null;
  }

  function defaultBaseUrl(){
    try{
      if(typeof DEFAULT_SETTINGS !== 'undefined' && DEFAULT_SETTINGS && DEFAULT_SETTINGS.backendUrl){
        return DEFAULT_SETTINGS.backendUrl;
      }
    }catch(_){}
    return 'http://localhost:8765';
  }

  function baseUrl(){
    const st = currentState();
    const url = st && st.settings && st.settings.api && st.settings.api.backendUrl;
    return String(url || defaultBaseUrl()).replace(/\/+$/, '');
  }

  async function _req(method, path, body){
    const res = await fetch(baseUrl() + path, {
      method,
      headers: body != null ? {'Content-Type':'application/json'} : undefined,
      body: body != null ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    if(!res.ok){
      const detail=Array.isArray(data?.detail)? data.detail.map(item=>item.msg).filter(Boolean).join('；') : data?.detail;
      throw new Error(detail || ('HTTP ' + res.status));
    }
    return data;
  }

  function snapshotMeta(data){
    if(!data || typeof data!=='object' || Array.isArray(data) ||
       typeof data.id!=='string' || !data.id.trim() ||
       typeof data.name!=='string' || !data.name.trim()){
      throw new Error('服务端未返回有效版本信息');
    }
    return data;
  }

  // 只用于同名检测；最终名称始终采用服务端返回值。
  function normalizeName(name){
    const clean=String(name || '').replace(/[\x00-\x1f\x7f]/g, '').trim();
    return Array.from(clean).slice(0,60).join('').replace(/[<>:"/\\|?*]/g, '_').trim();
  }

  const Archive = {
    normalizeName,
    // GET /api/snapshots?project_id=default → [{id,name,type,created_at}]
    async list(){
      const data=await _req('GET', '/api/snapshots?project_id=default');
      if(!Array.isArray(data)) throw new Error('服务端未返回有效版本列表');
      return data.map(snapshotMeta);
    },
    // POST /api/snapshots {project_id, name, overwrite} → snapshot meta
    async create({name, overwrite=false} = {}){
      return snapshotMeta(await _req('POST', '/api/snapshots', {
        project_id: 'default',
        name: name || null,
        overwrite: !!overwrite
      }));
    },
    // POST /api/snapshots/{id}/rename?project_id=default → snapshot meta
    async rename(id, name, {overwrite=false, copy=false} = {}){
      return snapshotMeta(await _req('POST', '/api/snapshots/' + encodeURIComponent(id) + '/rename?project_id=default', {
        name: String(name || ''),
        overwrite: !!overwrite,
        copy: !!copy
      }));
    },
    // DELETE /api/snapshots/{id}?project_id=default → true
    async remove(id){
      const data=await _req('DELETE', '/api/snapshots/' + encodeURIComponent(id) + '?project_id=default');
      if(!data || data.ok!==true) throw new Error('服务端未确认版本已删除');
      return true;
    },
    // POST /api/snapshots/{id}/restore?project_id=default → restored state
    async restore(id, {withMeta=false} = {}){
      const data = await _req('POST', '/api/snapshots/' + encodeURIComponent(id) + '/restore?project_id=default');
      if(!data || data.ok!==true || !data.state || typeof data.state!=='object' || Array.isArray(data.state)){
        throw new Error('服务端未返回有效工作区内容');
      }
      if(withMeta){
        snapshotMeta(data.snapshot);
        return {state:data.state, snapshot:data.snapshot};
      }
      return data.state;
    }
  };

  // BIZ02：案例浏览（只读）时禁止一切档案版本写操作——读列表仍可用。
  function _locked(){
    const st = currentState();
    return !!(st && st.meta && (st.meta.isDemo || st.meta.demoCase));
  }
  ['create','rename','remove','restore'].forEach(k=>{
    const fn=Archive[k];
    Archive[k]=async function(...args){
      if(_locked()) throw new Error('案例浏览中：不可修改档案版本');
      return fn.apply(this, args);
    };
  });

  if(typeof window !== 'undefined') window.Archive = Archive;
  if(typeof module !== 'undefined' && module.exports) module.exports = Archive;
})();
