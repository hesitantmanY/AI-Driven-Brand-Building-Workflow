/* A4 红测试：表单是 summaryText/exportMd/Work5 4P 拼接的唯一真相源；导出层级正确。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail == null ? '' : ' — ' + detail)); }
}

function baseSandbox(){
  const s = {
    console, JSON, Math, Object, Array, String, Number, Boolean, Date,
    setTimeout:()=>0, clearTimeout(){},
    document:{body:{dataset:{}},querySelector:()=>null,createElement:()=>({style:{},appendChild(){},addEventListener(){},setAttribute(){}})},
    el(){ return {appendChild(){return this;},addEventListener(){return this;},querySelector(){return null;}}; },
    uid:p=>p+'_id', mean:a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, median:a=>a.length?a.slice().sort((x,y)=>x-y)[0]:0,
    clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)), autosave(){}, showToast(){}, confirm:()=>true,
    state:null, Work1:{}, Work2:{}, Work3:{}, Work4:{}, Work5:{}, UI:{}, App:{}, Runner:{}, API:{}
  };
  s.window = s;
  s.JsonExtract = require(path.join(__dirname, '..', '..', '..', 'docs', 'lib', 'json_extract.js'));
  vm.createContext(s);
  return s;
}
const sandbox = baseSandbox();
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'workshop4.js'), 'utf8'), sandbox, {filename:'workshop4.js'});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'workshop5.js'), 'utf8'), sandbox, {filename:'workshop5.js'});
const W4 = sandbox.Work4, W5 = sandbox.Work5;

const st = {
  meta:{loadedFrom:'表单档案'},
  work1:{sbu:{name:'SBU'}}, work2:{}, work3:{proposition:{},identity:{}},
  work4:W4.defaultData()
};
sandbox.state = st;
const w = st.work4;
Object.assign(w.route, {scope:'global',oemType:'OBM',entryMode:'jv',light:['single-point'],politicalPower:'FORM_ROUTE'});
w.product.name='FORM_NAME'; w.product.description='FORM_DESC'; w.product.coreDifferentiators=['FORM_DIFF'];
Object.assign(w.product, {
  physicalFeatures:'FORM_PHYSICAL', serviceOffering:'FORM_SERVICE', technologyMoat:'FORM_MOAT',
  certifications:'FORM_CERT', localization:'FORM_LOCAL', serviceLocalization:'FORM_SERVICE_LOCAL',
  people:'FORM_PEOPLE', process:'FORM_PROCESS', physicalEvidence:'FORM_EVIDENCE', aiResult:'AI_SECRET_PRODUCT'
});
w.price.strategy='value'; w.price.strategyNote='FORM_STRATEGY_NOTE';
w.price.tiers=[{name:'FORM_TIER',targetSegment:'FORM_SEG',price:99,unit:'CNY',hero:true,notes:'FORM_TIER_NOTE'}];
w.price.channelPricing=[{channel:'FORM_CHANNEL',priceAdjustment:'FORM_ADJUST',rationale:'FORM_RATIONALE'}];
w.price.promotions=[{occasion:'FORM_OCCASION',discount:'FORM_DISCOUNT',period:'FORM_PERIOD'}];
Object.assign(w.price, {competitorPrices:'FORM_COMPETITOR',ppp:'FORM_PPP',pricingNumbers:'FORM_NUMBER',fxSensitivity:'FORM_FX',aiResult:'AI_SECRET_PRICE'});
w.place.onlineSelf=['FORM_ONLINE_SELF']; w.place.onlineThird=['FORM_ONLINE_THIRD']; w.place.onlineNotes='FORM_ONLINE_NOTES';
w.place.offlineDirect=['FORM_DIRECT']; w.place.offlineDistrib=['FORM_DISTRIB']; w.place.offlineRetail=['FORM_RETAIL']; w.place.offlineNotes='FORM_OFFLINE_NOTES';
w.place.keyPartners=[{name:'FORM_PARTNER',side:'线上'}]; w.place.channelIncentives='FORM_INCENTIVE'; w.place.localChannelRelations='FORM_RELATIONS';
w.place.structure=[{name:'线上',children:[{name:'FORM_CHILD',share:100}]}]; w.place.aiResult='AI_SECRET_PLACE';
w.promotion.theme='FORM_THEME'; w.promotion.advertising=[{media:'FORM_MEDIA',budgetShare:100,message:'FORM_MESSAGE',kpi:'FORM_KPI'}];
w.promotion.pr=[{event:'FORM_EVENT',timing:'FORM_TIMING',expectedReach:'FORM_REACH'}];
w.promotion.salesPromotion=[{tactic:'FORM_TACTIC',mechanic:'FORM_MECHANIC',period:'FORM_PROMO_PERIOD'}];
w.promotion.crm={tool:'FORM_CRM_TOOL',membership:'',repurchase:'FORM_REPURCHASE',notes:'FORM_CRM_NOTES'};
Object.assign(w.promotion, {contentStrategy:'FORM_CONTENT',context:'FORM_CONTEXT',taboos:'FORM_TABOOS',kolTiers:'FORM_KOL',language:'FORM_LANGUAGE',aiResult:'AI_SECRET_PROMOTION'});

console.log('==== A4 / A+D：表单真相源与导出结构 ====');
const combined = ['route','product','price','place','promotion'].map(k=>W4.summaryText(k)).join('\n') + '\n' + W4.exportMd();
const expected = [
  'FORM_ROUTE','FORM_NAME','FORM_DESC','FORM_DIFF','FORM_PHYSICAL','FORM_SERVICE','FORM_MOAT','FORM_CERT','FORM_LOCAL','FORM_SERVICE_LOCAL','FORM_PEOPLE','FORM_PROCESS','FORM_EVIDENCE',
  'FORM_STRATEGY_NOTE','FORM_TIER','FORM_SEG','FORM_TIER_NOTE','FORM_CHANNEL','FORM_ADJUST','FORM_RATIONALE','FORM_OCCASION','FORM_DISCOUNT','FORM_PERIOD','FORM_COMPETITOR','FORM_PPP','FORM_NUMBER','FORM_FX',
  'FORM_ONLINE_SELF','FORM_ONLINE_THIRD','FORM_ONLINE_NOTES','FORM_DIRECT','FORM_DISTRIB','FORM_RETAIL','FORM_OFFLINE_NOTES','FORM_PARTNER','FORM_INCENTIVE','FORM_RELATIONS','FORM_CHILD',
  'FORM_THEME','FORM_MEDIA','FORM_MESSAGE','FORM_KPI','FORM_EVENT','FORM_TIMING','FORM_REACH','FORM_TACTIC','FORM_MECHANIC','FORM_PROMO_PERIOD','FORM_CRM_TOOL','FORM_REPURCHASE','FORM_CRM_NOTES','FORM_CONTENT','FORM_CONTEXT','FORM_TABOOS','FORM_KOL','FORM_LANGUAGE'
];
ok('summary/export/W5 输入覆盖全部表单字段', expected.every(x=>combined.includes(x)), expected.filter(x=>!combined.includes(x)).join(','));
ok('aiResult 叙事绝不进入 summary/export', !combined.includes('AI_SECRET_'));
const w5Product = W5.structureP('product');
const w5Promotion = W5.structureP('promotion');
ok('Work5 4P 拼接读表单而非叙事', w5Product.includes('FORM_CERT') && w5Promotion.includes('FORM_CRM_TOOL') && !w5Product.includes('AI_SECRET_PRODUCT') && !w5Promotion.includes('AI_SECRET_PROMOTION'), w5Product + '\n' + w5Promotion);

w.product.description='FORM_DESC_CHANGED';
const changed = W4.summaryText('product') + W5.structureP('product');
ok('用户改表单立即反映 summary/Work5', changed.includes('FORM_DESC_CHANGED') && !changed.includes('FORM_DESC\n'), changed);

const md = W4.exportMd();
ok('exportMd 无文档级 H1', !/(^|\n)#\s/.test(md), md.slice(0,80));
ok('exportMd 层级为 ## IV → ###', md.includes('## IV. 营销组合') && (md.match(/^### /gm)||[]).length === 5 && !/^#### /m.test(md), md);

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
