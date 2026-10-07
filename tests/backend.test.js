/* Node test: Backend HTTP 适配器（2026-09-01 候选 4 抽出）。
   用假 fetch 跨同一接缝。

   Run: node tests/backend.test.js
*/
'use strict';
const path = require('path');
const Backend = require(path.join(__dirname, '..', 'docs', 'lib', 'backend.js'));

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const calls = [];
function mockFetch(handler){
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body, signal:opts.signal });
    return handler(url, opts);
  };
}
function res(body, status = 200, text){
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (text != null ? text : JSON.stringify(body))
  };
}

// base() 从 window.state 读
global.window = { state: { settings: { api: { backendUrl: 'http://localhost:9999' } } } };
global.DEFAULT_SETTINGS = { backendUrl: 'http://localhost:8765' };
global.backendOnline = false;

(async () => {
  // health
  mockFetch(() => res({status:'ok'}));
  calls.length = 0;
  const healthy = await Backend.health();
  ok('health returns true on ok', healthy === true);
  ok('health GETs /api/health from window.state base', calls[0].url === 'http://localhost:9999/api/health');
  ok('health sets backendOnline', global.backendOnline === true);

  // health failure
  mockFetch(() => res({}, 500));
  const down = await Backend.health();
  ok('health returns false on error', down === false);

  // lda
  mockFetch(() => res({topics: []}));
  calls.length = 0;
  const ldaController=new AbortController();
  const lda = await Backend.lda(['doc1'], {k: 3},{signal:ldaController.signal});
  ok('lda returns parsed body', Array.isArray(lda.topics));
  const ldaCall = calls[0];
  ok('lda POSTs /api/lda with JSON body', ldaCall.url === 'http://localhost:9999/api/lda' && ldaCall.method === 'POST');
  const ldaBody = JSON.parse(ldaCall.body);
  ok('lda body has documents + params', ldaBody.documents[0] === 'doc1' && ldaBody.k === 3 && ldaBody.passes === 15);
  ok('lda passes the task abort signal to fetch',ldaCall.signal===ldaController.signal);

  // lda error → throws with server text
  mockFetch(() => res({detail:'bad'}, 400, 'boom'));
  let err = null;
  try{ await Backend.lda([]); }catch(e){ err = e.message; }
  ok('lda error surfaces server text', err === 'boom');

  // parseExcel
  global.FormData = class { append(){} };
  mockFetch(() => res({rows: []}));
  calls.length = 0;
  const excel = await Backend.parseExcel({name:'x.xlsx'});
  ok('parseExcel POSTs /api/parse-excel', calls[0].url === 'http://localhost:9999/api/parse-excel' && calls[0].method === 'POST');
  ok('parseExcel returns rows', Array.isArray(excel.rows));

  delete global.window;
  delete global.DEFAULT_SETTINGS;
  delete global.FormData;
  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
