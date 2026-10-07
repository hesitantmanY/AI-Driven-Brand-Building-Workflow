/* ============================================================
 Settings — 2026-09-01 架构评审候选 4：从 global-brand-building.html 内联脚本抽出。
 多厂商配置（2026-09-03 决策锁）：
 - 服务端存多套命名配置（=厂商名），Key 各存 .env 的 LLM_API_KEY_<厂商> 行；
 - 本弹窗「保存」= 写入当前厂商并设为激活（没有独立"切换"，保存目标即激活）；
 - 「测试连接」打激活配置；表单与激活配置不一致且未保存时先问；
 - 各家 Key：留空=不动；有内容且该家已有 Key → 覆盖确认；「清除」按钮可删。
 依赖均为运行时全局（el / state / saveNow / Archive / App 等），浏览器可用。
 ============================================================ */
(function(){
 'use strict';

// 弹窗里展示用的厂商中文名（与 html <option> 初值一致）
var BASE_LABELS = {
  deepseek: 'DeepSeek',
  doubao: '火山方舟（豆包）',
  moonshot: 'Kimi（Moonshot）',
  minimax: 'MiniMax',
  qwen: '通义千问',
  zhipu: '智谱 GLM',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  custom: '其他（OpenAI 兼容）'
};

var Settings = {
  hasKey: function(){ return !!(state && state.settings && state.settings.api && state.settings.api.apiKey); },

  setMode: function(mode){
    if(state?.meta?.isDemo || state?.meta?.demoCase){showToast('案例浏览中，不可切换 AI 模式');return;}
    if(Runner.current){ showToast('请先中止当前 AI 任务'); return; }
    if(mode === 'api' && !this.hasKey()){
      showToast('请先点设置配置 API Key');
      this.renderModeSwitch();
      return;
    }
    state.settings.manualMode = (mode === 'manual');
    autosave();
    this.renderModeSwitch();
  },

  renderModeSwitch: function(){
    var sw = document.getElementById('modeSwitch');
    if(!sw) return;
    var manual = !!state.settings.manualMode || !this.hasKey();
    var forceManual = !this.hasKey();
    for(var i = 0; i < sw.querySelectorAll('button').length; i++){
      var b = sw.querySelectorAll('button')[i];
      var m = b.dataset.mode;
      b.classList.toggle('active', (m === 'manual') === manual);
      b.setAttribute('aria-pressed',String((m === 'manual') === manual));
      b.disabled = (m === 'api' && forceManual);
      b.title = (m === 'api' && forceManual) ? '请先点设置配置 API Key' : '';
    }
  },

  // ---- 内部状态 ----
  _keyBtn: function(){ return $('#setClearKey'); },
  _banner: function(){ return $('#legacyKeyBanner'); },

  _markOptions: function(){
    var sel = $('#setProvider');
    var opts = sel ? sel.options : [];
    for(var i = 0; i < opts.length; i++){
      var o = opts[i];
      var base = BASE_LABELS[o.value] || o.textContent.replace(/ ✓$/, '');
      var has = !!(this._providers && this._providers[o.value] && this._providers[o.value].apiKeyExists);
      o.textContent = base + (has ? ' ✓' : '');
    }
  },

  _currentHasKey: function(){
    var p = $('#setProvider').value;
    return !!(this._providers && this._providers[p] && this._providers[p].apiKeyExists);
  },

  _syncKeyUI: function(){
    var has = this._currentHasKey();
    var btn = this._keyBtn();
    if(btn) btn.style.display = has ? '' : 'none';
    var inp = $('#setApiKey');
    inp.placeholder = has ? '已配置 · 留空保持不变' : 'sk-...';
  },

  open: async function(){
    var cfg = Object.assign({}, DEFAULT_SETTINGS, {apiKeyExists: !!(state && state.settings && state.settings.api && state.settings.api.apiKey)});
    try{ cfg = await (await fetch(apiUrl('/api/config'))).json(); }catch(e){}
    this._providers = {};
    if(Array.isArray(cfg.providers)){
      cfg.providers.forEach(function(p){ this._providers[p.name] = p; }, this);
    }
    // 快照 = 激活配置（测试连接前的对账基准）
    this._saved = {provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model};
    $('#setProvider').value = cfg.provider;
    this._markOptions();
    $('#setBaseUrl').value = cfg.baseUrl || '';
    $('#setModel').value = cfg.model || '';
    $('#setApiKey').value = '';
    this._syncKeyUI();
    $('#setTemperature').value = cfg.temperature;
    $('#setTempVal').textContent = Number(cfg.temperature).toFixed(1);
    $('#setBackendUrl').value = cfg.backendUrl;
    $('#setTestResult').textContent = cfg.apiKeyExists ? ' 已配置 · 当前激活：' + (cfg.active || cfg.provider) : '';
    $('#setTestResult').style.color = 'var(--color-accent)';
    var banner = this._banner();
    if(banner) banner.style.display = cfg.legacyKeyPending ? '' : 'none'; // 文案在 HTML 里
    $('#settingsModal').classList.add('open');
  },

  close: function(){ $('#settingsModal').classList.remove('open'); },

  onApiKeyInput: function(){
    var r = $('#setTestResult');
    var k = $('#setApiKey').value.trim();
    if(!k){ r.textContent = ''; return; }
    r.textContent = ' 已输入新 Key（保存后生效，点「测试连接」验证）';
    r.style.color = 'var(--color-accent)';
  },

  onProviderChange: function(){
    // 载入该厂商已存的 base/model/温度；没存过 → providers.js 注册表预填
    var p = $('#setProvider').value;
    var stored = this._providers && this._providers[p];
    var baseUrl = '', model = '', temperature = 1.0;
    if(stored){
      baseUrl = stored.baseUrl || '';
      model = stored.model || '';
      if(stored.temperature != null) temperature = stored.temperature;
    } else if(typeof Providers !== 'undefined'){
      var rec = Providers.getProviderConfig(p);
      if(rec){ baseUrl = rec.baseUrlHint || ''; model = rec.defaultModel || ''; }
    }
    if(!model && typeof Providers === 'undefined'){
      var m = {deepseek: 'deepseek-v4-flash', openai: 'gpt-4o-mini', gemini: 'gemini-2.0-flash'}[p];
      model = m || '';
    }
    $('#setBaseUrl').value = baseUrl;
    $('#setModel').value = model;
    $('#setTemperature').value = temperature;
    $('#setTempVal').textContent = Number(temperature).toFixed(1);
    $('#setApiKey').value = '';
    this._syncKeyUI();
  },

  // 持久化当前厂商（=激活）。Key 规则：留空不动；有 Key 且该家已有 → 覆盖确认。
  _persist: async function(){
    var provider = $('#setProvider').value;
    var key = $('#setApiKey').value.trim();
    if(key && this._currentHasKey()){
      var go = confirm('将覆盖 ' + provider + ' 现有的 Key（旧 Key 立即失效，费用归属切换）。\n确定 → 覆盖；取消 → 保留旧 Key 不保存本次输入。');
      if(!go){ showToast('已取消：旧 Key 保留'); return null; }
    }
    var body = {
      provider: provider,
      baseUrl: $('#setBaseUrl').value.trim(),
      model: $('#setModel').value.trim(),
      temperature: parseFloat($('#setTemperature').value),
      backendUrl: $('#setBackendUrl').value.trim() || DEFAULT_SETTINGS.backendUrl
    };
    if(key) body.apiKey = key;
    try{
      var res = await fetch(apiUrl('/api/config'), {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
      });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      var merged = await res.json();
      state.settings.api = Object.assign({}, merged, {apiKey: merged.apiKeyExists ? '********' : ''});
      this._providers = {};
      if(Array.isArray(merged.providers)){
        merged.providers.forEach(function(x){ this._providers[x.name] = x; }, this);
      }
      this._saved = {provider: merged.provider, baseUrl: merged.baseUrl, model: merged.model};
      this._markOptions();
      this._syncKeyUI();
      $('#setApiKey').value = '';
      var banner = this._banner();
      if(banner && !merged.legacyKeyPending) banner.style.display = 'none';
      return merged;
    }catch(e){
      showToast('设定保存失败: ' + e.message);
      return null;
    }
  },

  save: async function(){
    var merged = await this._persist();
    if(!merged) return;
    this.close();
    showToast('已保存并激活：' + merged.provider);
    this.renderModeSwitch();
    this.checkBackend();
  },

  clearKey: async function(){
    var p = $('#setProvider').value;
    if(!confirm('清除 ' + p + ' 的 Key？清除后该厂商显示未配置，AI 自动模式将不可用（可随时重新填入）。')) return;
    try{
      var res = await fetch(apiUrl('/api/config/clear-key'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: p})
      });
      if(!res.ok) throw new Error('HTTP ' + res.status);
      var merged = await res.json();
      this._providers = {};
      if(Array.isArray(merged.providers)){
        merged.providers.forEach(function(x){ this._providers[x.name] = x; }, this);
      }
      if(p === merged.active){
        state.settings.api = Object.assign({}, merged, {apiKey: merged.apiKeyExists ? '********' : ''});
      }
      this._markOptions();
      this._syncKeyUI();
      showToast('已清除 ' + p + ' 的 Key');
      this.renderModeSwitch();
    }catch(e){ showToast('清除失败: ' + e.message); }
  },

  discardLegacy: async function(){
    try{
      var res = await fetch(apiUrl('/api/config/discard-legacy'), {method: 'POST'});
      if(!res.ok) throw new Error('HTTP ' + res.status);
      var banner = this._banner();
      if(banner) banner.style.display = 'none';
      showToast('已丢弃旧 Key');
    }catch(e){ showToast('操作失败: ' + e.message); }
  },

  test: async function(){
    var r = $('#setTestResult');
    r.textContent = '测试中…';
    r.style.color = 'var(--color-ink-2)';
    // 防误配：表单与激活配置不一致时先问（Key 输入框有内容也算未保存）
    var form = {
      provider: $('#setProvider').value,
      baseUrl: $('#setBaseUrl').value.trim(),
      model: $('#setModel').value.trim()
    };
    var saved = this._saved || form;
    var keyTyped = $('#setApiKey').value.trim();
    var formChanged = form.provider !== saved.provider || form.baseUrl !== saved.baseUrl ||
      form.model !== saved.model || !!keyTyped;
    if(formChanged){
      var goSave = confirm(
        '改动尚未保存：「测试连接」打的是已激活配置（' + saved.provider +
        ' / ' + (saved.model || '?') + '），不是弹窗里显示的（' + form.provider + ' / ' + (form.model || '?') + '）。\n\n' +
        (keyTyped ? '注意：新粘贴的 API Key 也未保存。\n\n' : '') +
        '「确定」→ 先保存再测试\n「取消」→ 仍按已激活配置测试');
      if(goSave){
        var merged = await this._persist();
        if(!merged){ r.textContent = '保存失败，未测试'; r.style.color = 'var(--color-warn)'; return; }
      }
    }
    try{
      var text = await API.call([{role: 'user', content: '回复"OK"两个字符'}]);
      if(String(text).trim().indexOf('OK') >= 0){
        r.textContent = '连接成功（' + form.provider + '）';
        r.style.color = 'var(--color-accent)';
      } else {
        r.textContent = '已连接，回复异常: ' + String(text).slice(0, 30);
        r.style.color = 'var(--color-warn)';
      }
    }catch(e){
      r.textContent = '失败: ' + e.message;
      r.style.color = 'var(--color-warn)';
    }
  },

  testBackend: async function(){
    var r = $('#setBackendResult');
    r.textContent = '测试中…';
    state.settings.api.backendUrl = $('#setBackendUrl').value.trim() || DEFAULT_SETTINGS.backendUrl;
    var ok = await Backend.health();
    if(ok){ r.textContent = ' 本地服务已连接'; r.style.color = 'var(--color-accent)'; }
    else{ r.textContent = ' 未连接（LDA/Excel 将降级）'; r.style.color = 'var(--color-warn)'; }
    App.updateSummary();
  },

  checkBackend: async function(){
    await this.testBackend();
  }
};

 if(typeof window !== 'undefined') window.Settings = Settings;
 if(typeof module !== 'undefined' && module.exports) module.exports = Settings;
})();
