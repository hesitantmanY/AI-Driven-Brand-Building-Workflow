/* D: 导出 H1/标题层级/表格合法性。 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
let pass=0,fail=0;
function ok(n,c,d){if(c){pass++;console.log('PASS '+n);}else{fail++;console.log('FAIL '+n+(d?' — '+d:''));}}
const document={createElement:()=>({appendChild(){},setAttribute(){},style:{}}),head:{appendChild(){}},getElementById:()=>null,querySelector:()=>null};
const sandbox={console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,document,el(){return {appendChild(){return this;}};},esc:s=>String(s??''),autosave(){},showToast(){},confirm:()=>true,state:null,Work1:{},Work2:{},Work3:{},Work4:{},Work5:{},App:{},Runner:{},API:{},UI:{mountMvo(){},mountMark(){},mountGuard(){return true;},demoNote(){return null;}},AiContext:{buildPrompt:()=>[]},renderMatrix(){}};sandbox.window=sandbox;vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','..','docs','workshop5.js'),'utf8'),sandbox,{filename:'workshop5.js'});
const W5=sandbox.Work5;
sandbox.Work2={allIndicators:()=>[],effectiveWeights:()=>({})};
sandbox.Work3={computeMatrix:()=>[],effectiveCuts:()=>({xCut:7,yCut:7}),isInSector:()=>false,entrySuggestion:()=>({text:''}),scenarioName:()=>''};
sandbox.state={meta:{loadedFrom:'测试档案'},settings:{api:{apiKey:''}},work1:{sbu:{name:'测试品牌'}},work2:{decision:{}},work3:{matrix:{showSector:false},candidates:[],mining:{}},work4:{},work5:W5.defaultData()};
sandbox.state.work5.ch2_environment.strengths=['研发|强'];
const md=W5.exportMd();
ok('Work5.exportMd 不输出文档级 H1', !/^#\s+/m.test(md), md.slice(0,80));
const headings=[...md.matchAll(/^(#{1,6})\s+(.+)$/gm)].map(m=>({level:m[1].length,title:m[2]}));
const p42=headings.find(h=>/^4\.2\s/.test(h.title)), p421=headings.find(h=>/^4\.2\.1\s/.test(h.title)), p422=headings.find(h=>/^4\.2\.2\s/.test(h.title));
ok('4.2.x 是 4.2 的下一层（### → ####）', !!p42&&!!p421&&!!p422&&p42.level===3&&p421.level===4&&p422.level===4, JSON.stringify({p42,p421,p422}));
function tableBlocks(src){return String(src).split(/\n\s*\n/).filter(b=>/^\|.*\|\s*$/m.test(b));}
function legalTable(b){const rows=b.split(/\r?\n/).filter(Boolean).map(r=>r.trim()).filter(r=>r.startsWith('|')&&r.endsWith('|'));if(rows.length<2)return false;const sep=rows[1].replace(/\|/g,'').replace(/[\s:-]/g,'');if(sep)return false;const n=(rows[0].match(/(?<!\\)\|/g)||[]).length-1;return rows.every(r=>((r.match(/(?<!\\)\|/g)||[]).length-1)===n);}
ok('SWOT/4P/排名表均为合法 markdown 表格', tableBlocks(md).length>=3 && tableBlocks(md).every(legalTable), tableBlocks(md).map(b=>b.split('\n')[0]).join(' / '));
const ex=require(path.join(__dirname,'..','..','..','docs','lib','markdown_exchange.js'));
const full=ex.buildExportMarkdown({state:sandbox.state,workExports:{work4:'\n## IV. 营销组合',work5:md}}).markdown;
ok('整份导出恰好一个 H1', (full.match(/^#\s+/gm)||[]).length===1, full.slice(0,120));
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail===0?0:1);
