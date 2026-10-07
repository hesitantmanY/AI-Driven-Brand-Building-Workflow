/* AC-W45-E: case exports use the locked case:<brand> title semantics. */
'use strict';
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const M = require(path.join(root, 'docs', 'lib', 'markdown_exchange.js'));
const state = {
  meta:{demoCase:'douya-mama'},
  settings:{api:{apiKey:''}},
  work1:{}, work2:{}, work3:{}, work4:{}, work5:{}
};
const out = M.buildExportMarkdown({state, workExports:{work1:'',work2:'',work3:'',work4:'',work5:''}});
let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
ok('案例导出文件名使用 case:<brand> 语义', out.filename === 'case-douya-mama-brand-workshop.md', out.filename);
ok('案例导出标题精确为 # case:<brand>', out.markdown.split('\n')[0] === '# case:douya-mama', out.markdown.split('\n')[0]);
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
