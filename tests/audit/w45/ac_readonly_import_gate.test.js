/* AC-W45-D: entering a case must block top-bar Markdown import writes. */
'use strict';
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const App = require(path.join(root, 'docs', 'lib', 'app.js'));
let inputs = 0, clicks = 0;
global.el = (tag) => {
  if(tag === 'input'){ inputs++; return { addEventListener(){}, click(){ clicks++; }, files:[] }; }
  return { addEventListener(){}, click(){}, appendChild(){}, setAttribute(){}, style:{} };
};
global.state = { meta:{isDemo:true, demoCase:'douya-mama'}, settings:{api:{}}, work1:{marker:'case-data'} };
App.importMd();
let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
ok('案例模式点导入 .md 不打开文件选择器', inputs === 0 && clicks === 0,
  'inputs=' + inputs + ' clicks=' + clicks);
ok('案例模式导入入口不改写工作区', global.state.meta.demoCase === 'douya-mama' && global.state.work1.marker === 'case-data');
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
