/* Node test: Archive 档案存取深模块（2026-09-01 架构评审候选 5）。

   快照的 list/create/rename/remove/restore 唯一入口，调用方不碰 URL 与
   project_id。测试用假 fetch 跨同一接缝，另锁死 HTML 不再残留内联
   /api/snapshots fetch。

   Run: node tests/archive.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');

const Archive = require(path.join(__dirname, '..', 'docs', 'lib', 'archive.js'));

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

let calls = [];
function mockFetch(handler){
  global.fetch = async (url, opts = {}) => {
    calls.push({
      url: String(url),
      method: opts.method || 'GET',
      body: opts.body ? JSON.parse(opts.body) : null
    });
    return handler(url, opts);
  };
}
function res(body, status = 200){
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

async function main(){
  // list
  mockFetch(() => res([{id:'time_1', name:'2026-09-01 00:00:00', type:'time'}]));
  calls = [];
  const snaps = await Archive.list();
  ok('list returns snapshot array', Array.isArray(snaps) && snaps.length === 1);
  ok('list GETs default project', calls[0].url === 'http://localhost:8765/api/snapshots?project_id=default');
  ok('list uses GET', calls[0].method === 'GET');

  // create
  mockFetch(() => res({id:'named_v1', name:'v1', type:'named'}));
  calls = [];
  const snap = await Archive.create({name:'v1', overwrite:true});
  ok('create returns snapshot meta', snap.name === 'v1');
  ok('create POSTs project_id/name/overwrite',
    calls[0].method === 'POST' && calls[0].body.project_id === 'default' &&
    calls[0].body.name === 'v1' && calls[0].body.overwrite === true);

  // create with no name → null
  mockFetch(() => res({id:'time_1', name:'t', type:'time'}));
  calls = [];
  await Archive.create();
  ok('create without name sends null', calls[0].body.name === null && calls[0].body.overwrite === false);

  // rename
  mockFetch(() => res({id:'named_v1', name:'新名', type:'named'}));
  calls = [];
  await Archive.rename('named 1', '新名', {overwrite:true});
  ok('rename URL-encodes id', calls[0].url.includes('/api/snapshots/named%201/rename?project_id=default'));
  ok('rename POSTs name/overwrite', calls[0].method === 'POST' && calls[0].body.name === '新名' && calls[0].body.overwrite === true);

  mockFetch(() => res({id:'named_终版(2)', name:'终版(2)', type:'named'}));
  calls = [];
  const copied = await Archive.rename('named_source', '终版', {copy:true});
  ok('rename copy explicitly sends copy and no overwrite', calls[0].body.copy === true && calls[0].body.overwrite === false);
  ok('rename copy returns the actual server suffix', copied.id === 'named_终版(2)' && copied.name === '终版(2)');

  // remove
  mockFetch(() => res({ok:true}));
  calls = [];
  const removed = await Archive.remove('time_1');
  ok('remove returns true', removed === true);
  ok('remove DELETEs snapshot', calls[0].method === 'DELETE' && calls[0].url === 'http://localhost:8765/api/snapshots/time_1?project_id=default');

  // restore
  mockFetch(() => res({ok:true, state:{work1:{sbu:{name:'X'}}}}));
  const st = await Archive.restore('named_v1');
  ok('restore returns state (not envelope)', st && st.work1 && st.work1.sbu.name === 'X');

  mockFetch(() => res({ok:true, state:{work1:{sbu:{name:'Y'}}}, snapshot:{id:'time_2',name:'2026-10-06 12:00:00 (2)',type:'time'}}));
  const restored = await Archive.restore('time_2', {withMeta:true});
  ok('restore with metadata returns actual source name and state', restored.snapshot.name.endsWith('(2)') && restored.state.work1.sbu.name === 'Y');

  for(const [label, body, request] of [
    ['create', {}, () => Archive.create({name:'v'})],
    ['rename', {id:'named_v',name:''}, () => Archive.rename('named_v', 'v')],
    ['remove', {}, () => Archive.remove('named_v')],
    ['restore metadata', {ok:true,state:{work1:{}},snapshot:{}}, () => Archive.restore('named_v',{withMeta:true})],
    ['restore state', {ok:true,state:null}, () => Archive.restore('named_v')],
    ['list', {}, () => Archive.list()]
  ]){
    mockFetch(() => res(body));
    let rejected = false;
    try{ await request(); }catch(_){ rejected = true; }
    ok(label + ' rejects invalid successful response', rejected);
  }
  ok('normalized collision name matches backend sanitizing and cap', Archive.normalizeName('  a/b\n  ') === 'a_b' && Array.from(Archive.normalizeName('😀'.repeat(70))).length === 60);

  // error mapping surfaces server detail
  mockFetch(() => res({detail:'Snapshot not found'}, 404));
  let err = null;
  try{ await Archive.remove('missing'); }catch(e){ err = e.message; }
  ok('error surfaces server detail', err === 'Snapshot not found');

  mockFetch(() => res({detail:[{msg:'版本名不能为空'}]}, 422));
  err = null;
  try{ await Archive.rename('named_v', ''); }catch(e){ err = e.message; }
  ok('validation error surfaces readable server reason', err === '版本名不能为空');

  // baseUrl is read live from the current top-level state binding; the browser
  // declares `let state` in the shell, so it is not available as window.state.
  global.window = {};
  global.state = { settings: { api: { backendUrl: 'http://localhost:9999/' } } };
  mockFetch(() => res([]));
  calls = [];
  await Archive.list();
  ok('baseUrl read from top-level state', calls[0].url.startsWith('http://localhost:9999/'));

  // DEFAULT_SETTINGS is the shell's fallback when state has no API URL.
  global.state = { settings: { api: {} } };
  global.DEFAULT_SETTINGS = { backendUrl: 'http://localhost:8888/' };
  calls = [];
  await Archive.list();
  ok('baseUrl falls back to DEFAULT_SETTINGS', calls[0].url.startsWith('http://localhost:8888/'));

  global.state.meta = {demoCase:'synthetic-case'};
  calls = [];
  let locked = false;
  try{ await Archive.rename('named_v', 'new', {copy:true}); }catch(_){ locked = true; }
  ok('demoCase alone locks direct archive copy before fetch', locked && calls.length === 0);

  delete global.state;
  delete global.DEFAULT_SETTINGS;
  delete global.window;

  // shell no longer has inline snapshot fetches
  const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'global-brand-building.html'), 'utf8');
  ok('HTML loads lib/archive.js', /<script src="lib\/archive\.js\?v=\d+"><\/script>/.test(htmlSrc));
  ok('no inline /api/snapshots fetches remain', !/fetch\(apiUrl\('\/api\/snapshots/.test(htmlSrc));
}

main().then(() => {
  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}).catch(e => {
  console.error('TEST CRASH: ' + e.stack);
  process.exit(1);
});
