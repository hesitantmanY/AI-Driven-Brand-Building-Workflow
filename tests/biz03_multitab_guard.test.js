/* Node test: BIZ03 双标签页 autosave 静默覆盖 —— 写前对账基准（lastServerStamp）播种。
   回归点：基准若在 init/恢复时不播种，页签的「首次」保存会跳过写前对账
   （guard 要求 serverStamp && lastServerStamp && 不等），另一页签的版本恢复
   会被该页签第一次 autosave 静默覆盖——正是 BIZ03 原始复现。
   Run: node tests/biz03_multitab_guard.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + String(detail).slice(0,200) : '')); }
}

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'global-brand-building.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'docs', 'lib', 'app.js'), 'utf8');
const historyJs = fs.readFileSync(path.join(__dirname, '..', 'docs', 'lib', 'history.js'), 'utf8');
const storeJs = fs.readFileSync(path.join(__dirname, '..', 'docs', 'lib', 'store.js'), 'utf8');

// ─────────────────────────── 源层契约：三处播种 ───────────────────────────
ok('init 播种 lastServerStamp（载入时服务器 savedAt）',
   /dirty = false;\s*\n[\s\S]{0,400}lastServerStamp = \(state\.meta && state\.meta\.savedAt\) \|\| null;/.test(appJs));
ok('历史恢复播种 lastServerStamp（恢复落盘的 savedAt），不再置 null',
   /lastServerStamp=\(next\.meta && next\.meta\.savedAt\)\|\|null;/.test(historyJs)
   && !/lastServerStamp=null;/.test(historyJs));
ok('Store._doSave 落盘后回写 lastServerStamp',
   /stateObj\.meta\.savedAt=stamp;\s*\n\s*\/\/[^\n]*\n\s*if\(typeof lastServerStamp!=='undefined'\) lastServerStamp=stamp;/.test(storeJs));

// ─────────────────────────── 行为层：真实 saveNow + 真实 Store ───────────────────────────
const saveNowSrc = (html.match(/async function saveNow\(\)\{[\s\S]+?\n\}/) || [])[0];
ok('saveNow 函数体在源里', !!saveNowSrc);

function makeTab(serverState){
  const f = { prompts: 0, puts: 0 };
  const ctx = {
    console,
    dirty: true, changeRevision: 0, lastServerStamp: null,
    state: { meta: { savedAt: 'T_LOAD' }, work1: {} },
    confirm: () => { f.prompts++; return f.answer !== false; },
    $: () => null,
    showToast(){},
    App: { renderAll(){}, updateSummary(){} },
    Interaction: { invalidateUndo(){} },
    apiUrl: p => 'http://test' + p,
    fetch: async (url, opts) => {
      if(String(url).includes('/api/state') && (!opts || !opts.method || opts.method === 'GET')){
        return { ok: true, json: async () => JSON.parse(JSON.stringify(serverState)) };
      }
      if(opts && opts.method === 'PUT'){
        f.puts++;
        Object.assign(serverState, JSON.parse(opts.body).state);
        return { ok: true };
      }
      throw new Error('unexpected fetch ' + url);
    },
  };
  ctx.window = ctx; ctx.Store = undefined;
  vm.createContext(ctx);
  vm.runInContext(storeJs, ctx, { filename: 'store.js' });
  vm.runInContext(saveNowSrc + '\n;this.__saveNow = saveNow;', ctx, { filename: 'saveNow' });
  f.ctx = ctx;
  f.run = () => ctx.__saveNow();
  return f;
}

(async () => {
  // 复现 BIZ03：A 恢复旧版本 → 服务器 T_RESTORE；B 页签载入过（基准已播种 T_LOAD）。
  // B 的下一次保存必须弹确认，而不是静默覆盖。
  const server = { meta: { savedAt: 'T_RESTORE' }, work1: { marker: 'restored' } };
  const tab = makeTab(server);
  tab.ctx.lastServerStamp = 'T_LOAD';           // 等价 init 播种
  tab.ctx.state = { meta: { savedAt: 'T_LOAD' }, work1: { marker: 'stale B memory' } };
  tab.answer = false;                            // 用户选「取消 → 载入服务器内容」
  const wrote = await tab.run();
  ok('另一页签已更新时首次保存弹确认', tab.prompts === 1 && wrote === false);
  ok('取消后不写盘、载入服务器最新内容', tab.puts === 0 && tab.ctx.state.work1.marker === 'restored');

  // 无冲突：基准与服务器一致 → 不弹窗、正常落盘、基准推进到新 stamp。
  const server2 = { meta: { savedAt: 'T_LOAD' }, work1: {} };
  const tab2 = makeTab(server2);
  tab2.ctx.lastServerStamp = 'T_LOAD';
  tab2.ctx.state = { meta: { savedAt: 'T_LOAD' }, work1: { v: 2 } };
  const wrote2 = await tab2.run();
  ok('基准一致时静默保存', tab2.prompts === 0 && wrote2 === true && tab2.puts === 1);
  ok('保存后基准推进（真实 Store._doSave 回写）',
     tab2.ctx.lastServerStamp === server2.meta.savedAt && server2.meta.savedAt !== 'T_LOAD');

  // 迁移直写路径（Store.save 不经 saveNow）也回写基准，后续 saveNow 不误报。
  const server3 = { meta: { savedAt: null }, work1: {} };
  const tab3 = makeTab(server3);
  tab3.ctx.lastServerStamp = 'T_OLD';
  await tab3.ctx.Store.save({ meta: { savedAt: null }, work1: {} });
  ok('Store.save 直写后基准同步', tab3.ctx.lastServerStamp === server3.meta.savedAt && tab3.puts === 1);

  console.log(fail ? `FAILURES: ${fail}` : `all ${pass} checks passed`);
  process.exit(fail ? 1 : 0);
})();
