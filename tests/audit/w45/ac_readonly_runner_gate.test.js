/* AC-W45-D: the shared AI/test runner must refuse to start in case mode. */
'use strict';
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const state = { meta:{isDemo:true, demoCase:'douya-mama'} };
global.window = { state };
global.state = state;
global.showToast = () => {};
const Runner = require(path.join(root, 'docs', 'lib', 'runner.js'));

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
const task = Runner.start({id:'case-task', label:'case task', button:null});
ok('案例模式 Runner.start 返回 null', task === null, 'task=' + JSON.stringify(task));
ok('案例模式不创建运行中任务', Runner.current === null, 'current=' + JSON.stringify(Runner.current));
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
