/* Node test: Runner 全局单任务锁状态机（2026-09-01 候选 4 抽出）。
   用 button:null 测纯状态机，不触碰 DOM。

   Run: node tests/runner.test.js
*/
'use strict';
const path = require('path');
const Runner = require(path.join(__dirname, '..', 'docs', 'lib', 'runner.js'));

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

// start 返回任务句柄
const t1 = Runner.start({id:'a', label:'任务A', pausable:false});
ok('start returns task', !!t1 && t1.id === 'a' && t1.status === 'running');
ok('signal() returns AbortSignal', Runner.signal() && typeof Runner.signal().aborted === 'boolean');

// 单任务锁：并发 start 被拒
const t2 = Runner.start({id:'b', label:'任务B'});
ok('concurrent start rejected (single-task lock)', t2 === null);

// tick / setTotal
Runner.tick(2);
ok('tick advances done', Runner.current.done === 2);
Runner.setTotal(5);
ok('setTotal updates total', Runner.current.total === 5);

// checkpoint 不暂停时立即通过
(async () => {
  await Runner.checkpoint();
  ok('checkpoint passes when running', true);

  // abort 语义
  Runner.abort();
  ok('abort sets aborted + signal', Runner.current.aborted === true && Runner.signal().aborted === true);
  let threw = false;
  try{ await Runner.checkpoint(); }catch(e){ threw = e && e.name === 'AbortError'; }
  ok('checkpoint throws AbortError after abort', threw);

  // finish 清空
  Runner.finish();
  ok('finish clears current', Runner.current === null);
  ok('signal() undefined after finish', Runner.signal() === undefined);

  // 三态机：生成中主体暂停，已暂停主体中止，没有继续出口。
  let pausedCalls=0,resumedCalls=0;
  const t3=Runner.start({id:'c',label:'任务C',pausable:true,onPause:()=>pausedCalls++,onResume:()=>resumedCalls++});
  Runner.togglePause();
  ok('主体首次点击暂停',t3.paused===true && t3.status==='paused');
  const cp=Runner.checkpoint();
  setTimeout(()=>Runner.togglePause(),5);
  let aborted=false;
  try{await cp;}catch(e){aborted=e.name==='AbortError';}
  ok('暂停后主体点击中止，挂起checkpoint抛AbortError',aborted && t3.aborted && Runner.signal().aborted);
  ok('暂停触发一次，从未触发继续',pausedCalls===1 && resumedCalls===0);
  Runner.togglePause();
  ok('中止后连点不恢复任务',t3.aborted===true && resumedCalls===0);
  Runner.finish();

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
