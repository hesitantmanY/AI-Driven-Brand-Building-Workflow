/* AC-W45-D: entering a case must block destructive top-bar reset. */
'use strict';
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const App = require(path.join(root, 'docs', 'lib', 'app.js'));
let saveCalls = 0, archiveCalls = 0, renderCalls = 0;
global.confirm = () => true;
global.showToast = () => {};
global.$ = () => ({ classList: { add(){}, remove(){} }, textContent:'', hidden:false });
global.saveNow = async () => { saveCalls++; return true; };
global.Archive = { create: async () => { archiveCalls++; return {}; } };
global.defaultState = () => ({ meta:{isDemo:false}, settings:{api:{keep:true}}, work1:{marker:'fresh'} });
App.renderAll = () => { renderCalls++; };
App.updateSummary = () => {};
App.updateArchiveLabel = () => {};
global.state = {
  meta:{isDemo:true, demoCase:'douya-mama', demoSnapshot:{meta:{demoCase:null}}},
  settings:{api:{keep:true}},
  work1:{marker:'case-data'}
};

(async () => {
  let pass = 0, fail = 0;
  function ok(name, cond, detail){
    if(cond){ pass++; console.log('PASS ' + name); }
    else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
  }
  await App.reset();
  ok('案例模式点重置不丢失案例状态', global.state.meta && global.state.meta.demoCase === 'douya-mama' && global.state.work1.marker === 'case-data',
    JSON.stringify(global.state));
  ok('案例模式点重置不触发存档写入', saveCalls === 0 && archiveCalls === 0,
    'saveCalls=' + saveCalls + ' archiveCalls=' + archiveCalls);
  ok('案例模式点重置不触发整页重绘', renderCalls === 0, 'renderCalls=' + renderCalls);
  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
