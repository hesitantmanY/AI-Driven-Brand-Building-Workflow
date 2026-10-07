/* ============================================================
 MarkdownExchange — 导出/导入 .md 的纯逻辑（2026-09-01 候选 4 抽出）。

 与 DOM 无关：buildExportMarkdown 返回 {markdown, filename}，
 parseEmbeddedMarkdown 从导出的 .md 还原嵌入 state。App 只负责 Blob/文件框。

 Public API（window.MarkdownExchange）：
   buildExportMarkdown({state, workExports}) → {markdown, filename}
   parseEmbeddedMarkdown(text) → {ok:true, state} | {ok:false, reason}
 ============================================================ */
(function(){
  'use strict';

  const DEFAULT_NAME = 'brand-workshop';

  function buildExportMarkdown({state, workExports}){
    const m = (state && state.meta) || {};
    const raw = (m.demoCase ? ('case:'+m.demoCase) : (m.loadedFrom || '')).trim() || DEFAULT_NAME;
    const safe = raw.replace(/[\\\/:*?"<>|\s]+/g,'-').replace(/^[.\-]+|[.\-]+$/g,'').slice(0,80) || DEFAULT_NAME;
    const filename = (raw === DEFAULT_NAME) ? 'brand-workshop.md' : (safe + '-brand-workshop.md');
    const title = raw;
    const parts = [
      `# ${title}`,
      `导出时间：${new Date().toLocaleString()}`,
      '',
      workExports.work1 || '',
      workExports.work2 || '',
      workExports.work3 || '',
      workExports.work4 || '',
      workExports.work5 || ''
    ];
    // Embed the full state as an HTML comment so the .md round-trips.
    const payload = {
      ...state,
      settings: { ...state.settings, api: { ...state.settings.api, apiKey: '' } }
    };
    parts.push('<!-- data:' + JSON.stringify(payload) + ' -->');
    return { markdown: parts.join('\n\n'), filename };
  }

  function parseEmbeddedMarkdown(text){
    if(!text) return { ok:false, reason:'empty file' };
    const m = String(text).match(/<!--\s*data:(\{[\s\S]*?\})\s*-->/);
    if(!m) return { ok:false, reason:'no embedded data block' };
    try{
      return { ok:true, state: JSON.parse(m[1]) };
    }catch(e){
      return { ok:false, reason:'data block parse failed' };
    }
  }

  const MarkdownExchange = { buildExportMarkdown, parseEmbeddedMarkdown, DEFAULT_NAME };
  if(typeof window!=='undefined') window.MarkdownExchange = MarkdownExchange;
  if(typeof module!=='undefined' && module.exports) module.exports = MarkdownExchange;
})();
