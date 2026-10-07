/* Node test: Runner 任务期间对按钮的独占（DOM 事件层）。
   最小假 DOM：父节点捕获 → 目标节点（按注册顺序）→ 冒泡，
   复刻 stopPropagation/stopImmediatePropagation 语义。

   背景缺陷：业务启动监听器（addEventListener）与 Runner 的暂停接管
   在同一按钮上双重触发——暂停后再点，先撞启动器（清断点/续跑）再切状态，
   表现为「已暂停 → 再点 → 又变回生成中」的假切换。

   Run: node tests/runner_button.test.js
*/
'use strict';
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

function classList(initial){
  const set = new Set((initial||'').split(/\s+/).filter(Boolean));
  return {
    add(){ [...arguments].forEach(c=>set.add(c)); },
    remove(){ [...arguments].forEach(c=>set.delete(c)); },
    toggle(c, on){ on===undefined ? (set.has(c)?set.delete(c):set.add(c)) : (on?set.add(c):set.delete(c)); },
    contains(c){ return set.has(c); }
  };
}

function fakeNode(tag, attrs={}){
  const n = {
    tag, parentNode:null, children:[], style:{},
    classList:classList(attrs.class),
    _ls:[],
    appendChild(c){ c.parentNode=n; n.children.push(c); return c; },
    addEventListener(type, fn, opts){ n._ls.push({type, fn, cap:opts===true||(!!opts&&opts.capture)}); },
    removeEventListener(type, fn){ n._ls = n._ls.filter(l=>!(l.type===type&&l.fn===fn)); },
    contains(o){ return o===n || n.children.some(c=>c.contains && c.contains(o)); },
    insertAdjacentElement(){},
    remove(){},
    setAttribute(){},
    set innerHTML(v){ n._html=v; n.children=[]; },
    get innerHTML(){ return n._html||''; },
    set textContent(v){ n._text=v; n.children=[]; },
    get textContent(){ return n._text||''; }
  };
  for(const [k,v] of Object.entries(attrs||{})){
    if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2), v);
  }
  return n;
}

global.el = (tag, attrs={}, ...children)=>{
  const n = fakeNode(tag, attrs);
  children.flat().forEach(c=>n.appendChild(typeof c==='string' ? (()=>{const t=fakeNode('#text');t._text=c;return t;})() : c));
  return n;
};
global.showToast = ()=>{};

// 事件派发：捕获（自顶向下）→ 目标（注册顺序）→ 冒泡
function click(host, target){
  const path=[];
  for(let n=target;n;n=n.parentNode) path.unshift(n);
  const targetIdx=path.indexOf(target);
  const ev={target, preventDefault(){}, stopPropagation(){ev._sp=true;}, stopImmediatePropagation(){ev._sp=ev._si=true;}};
  for(let i=0;i<targetIdx;i++){
    if(ev._sp) break;
    for(const l of path[i]._ls.filter(l=>l.cap&&l.type==='click')){ l.fn(ev); if(ev._si) break; }
  }
  if(!ev._sp){
    for(const l of target._ls.filter(l=>l.type==='click')){ l.fn(ev); if(ev._si) break; }
  }
  if(!ev._sp){
    for(let i=targetIdx+1;i<path.length;i++){
      for(const l of path[i]._ls.filter(l=>!l.cap&&l.type==='click')){ l.fn(ev); if(ev._si) break; }
    }
  }
}

const Runner = require(path.join(__dirname, '..', 'docs', 'lib', 'runner.js'));

(async ()=>{
  // --- 场景：primary 大按钮跑双单元流水线，业务启动监听器在按钮上 ---
  const host = fakeNode('div');
  const button = fakeNode('button', {class:'primary'});
  button.textContent='AI 起草人格与 Slogan';
  host.appendChild(button);
  let starts = 0;
  button.addEventListener('click', ()=>{ starts++; });  // 模拟业务侧启动器

  const task = Runner.start({id:'pipe', label:'AI 起草人格与 Slogan', button, total:2, pausable:true});
  ok('task started', !!task);
  const titleEl = button.children[0] && button.children[0].children[0];
  ok('内嵌结构保留（标题子节点）', titleEl && /生成中/.test(titleEl.textContent), titleEl&&titleEl.textContent);

  // 运行中点击：启动器被吞，任务暂停
  click(host, button);
  ok('运行中点击不触发业务启动器', starts===0, 'starts='+starts);
  ok('点击=暂停', task.paused===true && /已暂停 · 0\/2（点击中止）/.test(titleEl.textContent), titleEl.textContent);

  // 暂停态主体点击：中止同一任务，不触发业务启动器。
  const cp=Runner.checkpoint();
  let aborted=false;cp.catch(e=>{aborted=e.name==='AbortError';});
  click(host,button);
  ok('暂停态点击不触发业务启动器',starts===0,'starts='+starts);
  ok('再点主体中止原任务',task.aborted===true && task.controller.signal.aborted);
  await new Promise(r=>setTimeout(r,0));
  ok('挂起checkpoint收到AbortError',aborted===true);

  // finish 拆除守卫：按钮还原，启动器恢复可点
  Runner.finish();
  ok('finish 后按钮还原', /AI 起草人格与 Slogan/.test(button.textContent), button.textContent);
  ok('finish 清掉 paused/running 类', !button.classList.contains('paused') && !button.classList.contains('running'));
  click(host, button);
  ok('finish 后启动器恢复触发', starts===1, 'starts='+starts);

  // --- 非暂停任务：运行中点击被吞（不给暂停语义，也不双触发）---
  const host2=fakeNode('div'), b2=fakeNode('button',{class:'primary'});
  host2.appendChild(b2);
  let starts2=0; b2.addEventListener('click',()=>{starts2++;});
  const t2=Runner.start({id:'one',label:'单次生成',button:b2,pausable:false});
  click(host2,b2);
  ok('单调用主体点击只中止，不重新启动', starts2===0 && t2.paused===false && t2.aborted===true);
  Runner.finish();

  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail===0?0:1);
})().catch(e=>{ console.error('TEST CRASH', e); process.exit(1); });
