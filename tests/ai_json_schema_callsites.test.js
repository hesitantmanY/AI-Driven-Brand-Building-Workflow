/* AI03 回归：生产调用点必须真的把 schema 交给 CallJsonStrict。
   背景：管道（opts.schema → CallJsonStrict.run）一直是通的，但没有任何生产
   调用点定义过 schema，于是 call_json_strict.js 的「无 schema 直接过」短路
   使校验/纠偏重试从未执行。本测试钉住调用点侧：接线不算数，带上才算数。

   Run: node tests/ai_json_schema_callsites.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail? ' — ' + detail : '')); }
}

const root = path.join(__dirname, '..');
const FILES = ['workshop1.js','workshop2.js','workshop3.js','workshop5.js'];

// 平衡括号扫描：取出 API.callJson(...) 的完整调用文本
function callTexts(src, callee){
  const out = [];
  let i = src.indexOf(callee);
  while(i >= 0){
    let depth = 0, j = src.indexOf('(', i + callee.length - 1), end = -1;
    for(; j < src.length; j++){
      const ch = src[j];
      if(ch === '(') depth++;
      else if(ch === ')'){ depth--; if(depth === 0){ end = j; break; } }
    }
    out.push(src.slice(i, end + 1));
    i = src.indexOf(callee, end + 1);
  }
  return out;
}

for(const f of FILES){
  const src = fs.readFileSync(path.join(root, 'docs', f), 'utf8');
  const calls = callTexts(src, 'API.callJson(');
  ok(f + ' 有生产 callJson 调用', calls.length > 0, 'count=' + calls.length);
  calls.forEach((t, idx) => {
    ok(f + ' callJson#' + (idx + 1) + ' 带 schema', /\bschema\s*:/.test(t), t.slice(0, 120).replace(/\s+/g, ' '));
  });
}

// 流水线单元：凡 jsonMode:true 的单元必须同字面量带 schema（含手动箱单元——
// 保持「jsonMode ⇒ schema」不变量，避免例外清单腐烂）
for(const f of FILES){
  const src = fs.readFileSync(path.join(root, 'docs', f), 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if(!/jsonMode\s*:\s*true/.test(line)) return;
    const window = lines.slice(i, i + 3).join('\n');
    ok(f + ' jsonMode 单元（行 ' + (i + 1) + '）带 schema', /\bschema\b/.test(window), window.slice(0, 120));
  });
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
