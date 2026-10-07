/* Node test: MarkdownExchange 导出/导入纯逻辑（2026-09-01 候选 4 抽出）。

   Run: node tests/markdown_exchange.test.js
*/
'use strict';
const path = require('path');
const M = require(path.join(__dirname, '..', 'docs', 'lib', 'markdown_exchange.js'));

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const state = {
  meta: { loadedFrom: '我的 档案' },
  settings: { api: { apiKey: 'secret' } },
  work1: { sbu: { name: '豆芽' } },
  work2: {}, work3: {}, work4: {}, work5: {}
};

const { markdown, filename } = M.buildExportMarkdown({
  state,
  workExports: { work1: '## W1', work2: '', work3: '', work4: '', work5: '' }
});

ok('filename derives from loadedFrom', filename === '我的-档案-brand-workshop.md', filename);
ok('markdown starts with title', markdown.startsWith('# 我的 档案'), markdown.slice(0, 30));
ok('markdown includes work export', markdown.includes('## W1'));
ok('markdown embeds data comment', markdown.includes('<!-- data:'));

const rt = M.parseEmbeddedMarkdown(markdown);
ok('round-trip parses', rt.ok === true);
ok('round-trip state preserved', rt.state && rt.state.work1.sbu.name === '豆芽');
ok('round-trip apiKey masked', rt.state.settings.api.apiKey === '');

const noBlock = M.parseEmbeddedMarkdown('# hello\nplain text');
ok('no data block → ok:false', noBlock.ok === false && noBlock.reason === 'no embedded data block');

const badJson = M.parseEmbeddedMarkdown('<!-- data:{"a":1,} -->');
ok('broken data block → parse failed', badJson.ok === false && badJson.reason === 'data block parse failed');

// demoCase naming
const demo = M.buildExportMarkdown({ state: { ...state, meta: { demoCase: 'douya-mama' } }, workExports: {} });
ok('demoCase filename + title', demo.filename === 'case-douya-mama-brand-workshop.md' && demo.markdown.startsWith('# case:douya-mama'));

// default naming
const def = M.buildExportMarkdown({ state: { ...state, meta: {} }, workExports: {} });
ok('default filename', def.filename === 'brand-workshop.md' && def.markdown.startsWith('# brand-workshop'));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
