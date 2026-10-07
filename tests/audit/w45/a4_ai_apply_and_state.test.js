/* A4 红测试：AI 整组回填的数据保护、警告出口、生成失败与整体覆盖语义。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail == null ? '' : ' — ' + detail)); }
}

const toasts = [], confirms = [];
const sandbox = {
  console, JSON, Math, Object, Array, String, Number, Boolean, Date,
  setTimeout: () => 0, clearTimeout(){},
  document: {
    body:{dataset:{}},
    querySelector:()=>null,
    createElement:()=>({style:{}, appendChild(){}, addEventListener(){}, setAttribute(){}})
  },
  el(tag, attrs = {}, ...children){
    return {
      tag, attrs, children: children.flat(),
      textContent: String((attrs && attrs.textContent) || children.flat().filter(x => typeof x === 'string').join('')),
      appendChild(x){ this.children.push(x); return this; },
      addEventListener(type, fn){ this['on' + type] = fn; return this; },
      querySelector(){ return null; }
    };
  },
  uid: p => p + '_id',
  mean: a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0,
  median: a => a.length ? a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)] : 0,
  clamp: (v,lo,hi) => Math.max(lo, Math.min(hi,v)),
  autosave(){},
  showToast(msg){ toasts.push(String(msg)); },
  confirm(msg){ confirms.push(String(msg)); return true; },
  state:null,
  Work1:{}, Work2:{}, Work3:{}, Work4:{}, UI:{}, App:{}, Runner:{}, API:{}
};
sandbox.window = sandbox;
sandbox.JsonExtract = require(path.join(__dirname, '..', '..', '..', 'docs', 'lib', 'json_extract.js'));
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'docs', 'workshop4.js'), 'utf8'), sandbox, {filename:'workshop4.js'});
const W4 = sandbox.Work4;

function freshState(){
  return {
    meta:{isDemo:false, demoCase:null},
    work1:{sbu:{name:'品牌', summary:'描述'}},
    work2:{},
    work3:{proposition:{}, identity:{}},
    work4:W4.defaultData()
  };
}
function collect(node, out = []){
  if(node == null) return out;
  if(typeof node === 'string'){ out.push(node); return out; }
  if(typeof node.textContent === 'string') out.push(node.textContent);
  for(const c of (node.children || [])) collect(c, out);
  return out;
}

console.log('==== A4 / B：AI 整组回填与生成态 ====');
sandbox.state = freshState();

// AI01：空数组/空表不得清空；每个受影响字段都应保留并产生 warning。
{
  const p = sandbox.state.work4.product;
  p.coreDifferentiators = ['原差异']; p.skus = [{name:'原 SKU'}];
  const r = W4.applyStepAll('product', '```json\n{"coreDifferentiators":[],"skus":[]}\n```');
  ok('空 tags/空 SKU 表保留原值', p.coreDifferentiators[0] === '原差异' && p.skus[0].name === '原 SKU', JSON.stringify(p));
  ok('空 tags/空 SKU 表均给 warning', r.warnings.length >= 2 && r.warnings.some(x=>x.includes('核心差异化')) && r.warnings.some(x=>x.includes('SKU')), JSON.stringify(r));

  const promo = sandbox.state.work4.promotion;
  promo.advertising = [{media:'原电视', budgetShare:100}]; promo.pr = [{event:'原 PR'}]; promo.salesPromotion = [{tactic:'原促销'}];
  const rp = W4.applyStepAll('promotion', '```json\n{"advertising":[],"pr":[],"salesPromotion":[]}\n```');
  ok('空广告/PR/促销表保留原值', promo.advertising[0].media === '原电视' && promo.pr[0].event === '原 PR' && promo.salesPromotion[0].tactic === '原促销');
  ok('空广告/PR/促销表 warning 不丢', ['广告','公关','销售促进'].every(k => rp.warnings.some(x=>x.includes(k))), JSON.stringify(rp));

  const place = sandbox.state.work4.place;
  place.keyPartners = [{name:'原伙伴',side:'线上'}];
  place.structure = [{name:'线上',children:[{name:'官网',share:100}]}];
  const rl = W4.applyStepAll('place', '```json\n{"keyPartners":[],"structure":[]}\n```');
  ok('空伙伴/空渠道结构保留原值', place.keyPartners[0].name === '原伙伴' && place.structure[0].children[0].name === '官网');
  ok('空伙伴/空渠道结构 warning 不丢', rl.warnings.some(x=>x.includes('关键伙伴')) && rl.warnings.some(x=>x.includes('渠道结构')), JSON.stringify(rl));
}

// AI05：归一化 warning 必须沿返回值进入 toast；enum/空 crm 保留原值且不虚计。
{
  sandbox.state = freshState();
  const p = sandbox.state.work4.promotion;
  p.advertising = [{media:'旧媒介',budgetShare:100}];
  const normalized = W4.applyStepAll('promotion', '```json\n{"advertising":[{"media":"A","budgetShare":"30%"},{"media":"B","budgetShare":"30%"}]}\n```');
  ok('share 归一化 warning 可见', normalized.warnings.some(x=>x.includes('归一')), JSON.stringify(normalized));
  ok('share 百分号解析且无 NaN', p.advertising.every(a=>Number.isFinite(a.budgetShare)) && p.advertising.reduce((s,a)=>s+a.budgetShare,0) === 100, JSON.stringify(p.advertising));

  const price = sandbox.state.work4.price;
  price.strategy = 'value';
  const re = W4.applyStepAll('price', '```json\n{"strategy":"成本加成"}\n```');
  ok('enum 失配保留原值', price.strategy === 'value');
  ok('enum 失配 warning 明确', re.warnings.some(x=>x.includes('定价策略') && x.includes('保留原值')), JSON.stringify(re));

  const promo = sandbox.state.work4.promotion;
  promo.crm = {tool:'旧工具',membership:'旧会员',repurchase:'旧复购',notes:'旧备注'};
  const rc = W4.applyStepAll('promotion', '```json\n{"crm":{}}\n```');
  ok('空 crm 不虚计 n', rc.ok === true && rc.n === 0, JSON.stringify(rc));
  ok('空 crm 保留原值且 warning', promo.crm.tool === '旧工具' && rc.warnings.some(x=>x.includes('CRM')), JSON.stringify(rc));
}

// “未含 key 不动”只保护缺失 key；显式空文本是包含 key 的整体覆盖。
{
  sandbox.state = freshState();
  const p = sandbox.state.work4.promotion;
  p.theme = '旧主题'; p.contentStrategy = '旧策略';
  const r = W4.applyStepAll('promotion', '```json\n{"theme":"","contentStrategy":"新策略"}\n```');
  ok('缺失 key 不动', p.taboos === '' && p.crm.tool === '');
  ok('显式空文本覆盖、非空文本覆盖', p.theme === '' && p.contentStrategy === '新策略', JSON.stringify({r,p}));
}

// 双写 + toast warnings + 重新生成不 confirm、不追加；新结果无叙事时也要清掉旧叙事。
{
  sandbox.state = freshState();
  const p = sandbox.state.work4.promotion;
  p.aiResult = '## 旧叙事\n\n旧正文';
  p.adoptedSegments = {'seg-old':{at:1}};
  let apiCalls = 0;
  sandbox.API.aiButton = opts => {
    apiCalls++;
    opts.onResult('## 新叙事\n\n新正文\n\n```json\n{"theme":"新主题","advertising":[{"media":"A","budgetShare":"30%"},{"media":"B","budgetShare":"30%"}]}\n```', null, 'api');
  };
  const btn = {textContent:'重新生成传播方案', disabled:false};
  W4.runAiDraft('promotion', {short:'传播方案', label:'AI 起草传播方案'}, btn);
  ok('双写：字段写表单、叙事只写 aiResult', p.theme === '新主题' && p.aiResult === '## 新叙事\n\n新正文', JSON.stringify(p));
  ok('重新生成直接覆盖且不 confirm', apiCalls === 1 && confirms.length === 0 && !p.aiResult.includes('旧正文'));
  ok('重新生成不追加旧采纳段', !Object.prototype.hasOwnProperty.call(p.adoptedSegments, 'seg-old'), JSON.stringify(p.adoptedSegments));
  ok('warnings 进 toast', toasts.some(x=>x.includes('归一')), JSON.stringify(toasts));

  sandbox.API.aiButton = opts => opts.onResult('```json\n{"theme":"仅字段"}\n```', null, 'api');
  W4.runAiDraft('promotion', {short:'传播方案'}, btn);
  ok('新结果无叙事时清空旧 aiResult', p.aiResult === '' && p.theme === '仅字段', JSON.stringify(p.aiResult));
}

// 生成失败必须显式 toast，且调用异常不能把按钮锁死。
{
  sandbox.state = freshState();
  toasts.length = 0;
  sandbox.API.aiButton = () => { throw new Error('LLM_DOWN'); };
  const btn = {textContent:'AI 起草产品卖点', disabled:false};
  let threw = false;
  try { W4.runAiDraft('product', {short:'产品卖点', label:'AI 起草产品卖点'}, btn); } catch(e){ threw = true; }
  ok('同步生成异常不向调用方裸抛', threw === false);
  ok('生成失败显式 toast', toasts.some(x=>x.includes('AI') && x.includes('失败') && x.includes('LLM_DOWN')), JSON.stringify(toasts));
  ok('生成失败恢复按钮', btn.disabled === false && btn.textContent === 'AI 起草产品卖点', JSON.stringify(btn));
}

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
