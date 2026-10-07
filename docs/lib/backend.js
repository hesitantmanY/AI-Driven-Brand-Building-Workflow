/* ============================================================
 Backend — 本地 Python 服务的 HTTP 适配器（2026-09-01 候选 4 抽出）。

 浏览器依赖（运行时解析）：state / DEFAULT_SETTINGS / backendOnline / fetch。
 测试用假 fetch 跨同一接缝。

 Public API（window.Backend）：
   base() / health() / lda(documents, params, opts) / parseExcel(file)
 ============================================================ */
(function(){
  'use strict';

  const Backend = {
    // state may be null during early init (health check runs before state load).
    base(){
      const st = (typeof window!=='undefined' && window.state) || (typeof state!=='undefined' ? state : null);
      if(st && st.settings && st.settings.api && st.settings.api.backendUrl){
        return st.settings.api.backendUrl;
      }
      if(typeof DEFAULT_SETTINGS!=='undefined' && DEFAULT_SETTINGS.backendUrl) return DEFAULT_SETTINGS.backendUrl;
      return 'http://localhost:8765';
    },
    async health(){
      try{
        const r=await fetch(this.base()+'/api/health',{method:'GET'});
        if(!r.ok) return false;
        const d=await r.json();
        if(typeof backendOnline!=='undefined') backendOnline = d.status==='ok';
        return d.status==='ok';
      }catch{
        if(typeof backendOnline!=='undefined') backendOnline = false;
        return false;
      }
    },
    async lda(documents, params={},opts={}){
      const r=await fetch(this.base()+'/api/lda',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body: JSON.stringify({documents, k:5, passes:15, iterations:100, no_below:2, no_above:0.5, ...params}),
        signal:opts.signal
      });
      if(!r.ok){ const t=await r.text(); throw new Error(t); }
      return r.json();
    },
    async parseExcel(file){
      const fd=new FormData(); fd.append('file', file);
      const r=await fetch(this.base()+'/api/parse-excel',{method:'POST',body:fd});
      if(!r.ok){ const t=await r.text(); throw new Error(t); }
      return r.json();
    }
  };

  if(typeof window!=='undefined') window.Backend = Backend;
  if(typeof module!=='undefined' && module.exports) module.exports = Backend;
})();
