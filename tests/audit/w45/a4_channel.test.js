/* A4 红测试：Work4 渠道 side、迁移、树图提示/转义、销售占比图与不平提示。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail == null ? '' : ' — ' + detail)); }
}
const sandbox = {
  console, JSON, Math, Object, Array, String, Number, Boolean, Date,
  setTimeout:()=>0, clearTimeout(){},
  document:{body:{dataset:{}},querySelector:()=>null,createElement:()=>({style:{},appendChild(){},addEventListener(){},setAttribute(){}})},
  el(){ return {appendChild(){return this;},addEventListener(){return this;},querySelector(){return null;}}; },
  esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  uid:p=>p+'_id', autosave(){}, showToast(){}, confirm:()=>true,
  state:null, Work1:{}, Work2:{}, Work3:{}, Work4:{}, UI:{}, App:{}, Runner:{}, API:{}
};
sandbox.window = sandbox;
sandbox.JsonExtract = require(path.join(__dirname, '..', '..', '..', 'docs', 'lib', 'json_extract.js'));
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'workshop4.js'), 'utf8'), sandbox, {filename:'workshop4.js'});
const W4 = sandbox.Work4;

function host(){
  return {
    html:'', children:[],
    insertAdjacentHTML(_, s){ this.html += String(s); },
    appendChild(n){ this.children.push(n); return n; }
  };
}
function serialized(h){ return h.html + JSON.stringify(h.children); }

console.log('==== A4 / C：渠道 side、树图与销售占比 ====');
{
  const old = {place:{keyPartners:['Amazon 店','KA 商超','未分类伙伴'],structure:[
    {name:'线下',children:[{name:'门店',share:40}]},
    {name:'线上',children:[{name:'官网',share:60}]}
  ]}};
  W4.migrateKeyPartners(old);
  const once = JSON.stringify(old);
  W4.migrateKeyPartners(old);
  ok('migrateKeyPartners 幂等', JSON.stringify(old) === once, once);
  ok('旧 string[] 兼容并保留未分类', old.place.keyPartners.length === 3 && old.place.keyPartners[2].name === '未分类伙伴' && old.place.keyPartners[2].side === '');
  ok('反序结构归位 [线上,线下]', old.place.structure[0].name === '线上' && old.place.structure[1].name === '线下', JSON.stringify(old.place.structure));

  const missing = {place:{keyPartners:[],structure:[{name:'线下',children:[{name:'门店',share:100}]}]}};
  W4.migrateKeyPartners(missing);
  ok('缺组结构补齐且保留已有组', missing.place.structure.length === 2 && missing.place.structure[0].name === '线上' && missing.place.structure[1].children[0].name === '门店', JSON.stringify(missing.place.structure));
}

{
  const structure = [
    {name:'线上',children:[{name:'官网',share:60}]},
    {name:'线下',children:[{name:'门店',share:40}]}
  ];
  const partners = [
    {name:'线上伙伴',side:'线上'},
    {name:'线下伙伴',side:'线下'},
    {name:'未标注伙伴',side:''}
  ];
  const h = host();
  W4.renderChannelTree(h, structure, partners);
  const out = serialized(h);
  ok('树图只挂已标 side 的伙伴', out.includes('线上伙伴') && out.includes('线下伙伴'));
  ok('未标 side 不进树但图下提示行列出', out.includes('未标注') && out.includes('未标注伙伴'), out);

  const xssHost = host();
  W4.renderChannelTree(xssHost, structure, [{name:'<img src=x onerror=alert(1)>',side:'线上'}]);
  ok('伙伴名渲染转义，不能 XSS', !xssHost.html.includes('<img src=x') && xssHost.html.includes('&lt;img'), xssHost.html);

  const nanHost = host();
  W4.renderChannelTree(nanHost, [{name:'线上',children:[{name:'坏占比',share:'oops'}]}], []);
  W4.renderTreemap(nanHost, [{name:'线上',children:[{name:'坏占比',share:'oops'}]}]);
  ok('字符串坏占比不产生 NaN', !serialized(nanHost).includes('NaN'), serialized(nanHost));
}

{
  const h = host();
  const structure = [
    {name:'线上',children:[{name:'官网',share:30},{name:'平台',share:70}]},
    {name:'线下',children:[{name:'门店',share:40},{name:'经销',share:60}]}
  ];
  W4.renderTreemap(h, structure);
  const widths = [...h.html.matchAll(/<rect ([^>]*y="0"[^>]*fill="none"[^>]*)\/>/g)].map(m=>{ const a=m[1]; return {x:Number((a.match(/x="([^"]+)"/)||[])[1]), w:Number((a.match(/width="([^"]+)"/)||[])[1])}; });
  ok('treemap 按占比出宽度且总宽一致', widths.length === 2 && Math.abs(widths[0].w - 320) < 0.01 && Math.abs(widths[1].w - 320) < 0.01 && Math.abs(widths.reduce((s,x)=>s+x.w,0)-640)<0.01, JSON.stringify(widths));

  const bad = W4.structureMismatches([{name:'线上',children:[{name:'官网',share:95}]},{name:'线下',children:[{name:'门店',share:100}]}]);
  ok('structureMismatches 报出不平组', bad.length === 1 && bad[0].name === '线上' && bad[0].total === 95, JSON.stringify(bad));
  const budget = sandbox.state = {work4:W4.defaultData()};
  budget.work4.promotion.advertising = [{media:'独立预算',budgetShare:57}];
  ok('媒介预算占比不参与销售占比判断', W4.structureMismatches(budget.work4.place.structure).length === 0 && budget.work4.promotion.advertising[0].budgetShare === 57);
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
