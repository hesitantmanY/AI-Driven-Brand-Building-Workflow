/* Node test: Work4 步级 AI 起草、字段整组回填、summaryText 字段优先（2026-09-01 ADR 0008）
   覆盖：STEP_FIELD_SPEC / buildStepPrompt / extractStepJsonObject / applyStepAll /
   stepHasContent / runAiDraft 双写 / renderSegments 只读 / summaryText 字段优先，
   以及既有的 JSON 健壮解析链（parseStructured / Markdown 表格 / 截断抢救）。
   Run: node tests/work4_paragraphs.test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'docs');
let toasts = [];
let confirmCalls = [];
const sandbox = {
  console, setTimeout, clearTimeout, Date, JSON, Math, Object, Array, String, Number, Boolean,
  document: {
    body: { dataset: {} },
    querySelector: () => null,
    createElement: () => ({ style:{}, appendChild(){}, addEventListener(){}, setAttribute(){} })
  },
  el: function(tag, attrs, ...children){
    return { tag, attrs: attrs||{}, children, appendChild(){ return this; }, addEventListener(){ return this; }, querySelector(){ return null; } };
  },
  uid: (p='id') => p + '_' + Math.random().toString(36).slice(2, 9),
  mean: a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0,
  median: a => { if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; },
  clamp: (v,lo,hi) => Math.max(lo, Math.min(hi, v)),
  autosave: () => {},
  showToast: (msg) => { toasts.push(msg); },
  confirm: (msg) => { confirmCalls.push(msg); return true; },
  backendOnline: false,
  state: null,
  Work1: {}, Work2: {}, Work3: {}, Work4: {}, UI: {}, App: {}, Runner: {}, API: {}
};
// JsonExtract for parseStructured tests
const JsonExtractModule = require(path.join(root, 'lib', 'json_extract.js'));
sandbox.window = sandbox;
sandbox.JsonExtract = JsonExtractModule;
// Workshop4
const w4Src = fs.readFileSync(path.join(root, 'workshop4.js'), 'utf8');
vm.createContext(sandbox);
vm.runInContext(w4Src, sandbox, {filename:'workshop4.js'});

let pass = 0, fail = 0;
function ok(name, cond){
  if(cond){ pass++; console.log('  ✓ '+name); }
  else{ fail++; console.log('  ✗ '+name); }
}

function freshState(){
  const W4 = sandbox.Work4;
  return {
    work1: { sbu: { name:'某出海品牌', category:'消费电子', summary:'智能厨房小家电出海' } },
    work2: { selectedTiers: { tier1: { name:'东南亚' } } },
    work3: { proposition: { chosenValueText:'让烹饪更轻松', positioningStatement:'为亚洲厨房设计', mbti:'ENFP', chosenSlogan:'轻松下厨' },
             identity: { mbti:'ENFP', chosenSlogan:'轻松下厨' },
             candidates: [{ name:'智能控温', selected:true }] },
    work4: W4.defaultData(),
    work5: {}
  };
}

(async function main(){
  console.log('==== Work4 步级 AI 起草（2026-09-01 ADR 0008） ====');

  const W4 = sandbox.Work4;

  // ---- 1. 段落切分 ----
  console.log('\n[1] 段落切分（segResult）');
  {
    const empty = W4.segResult('');
    ok('空文本返回空数组', Array.isArray(empty) && empty.length === 0);
    const noHead = W4.segResult('这是一段没有标题的文字。\n另一行。');
    ok('无标题整段作为 seg-0', noHead.length === 1 && noHead[0].segId === 'seg-1' && noHead[0].heading === '开场');
    const multi = W4.segResult('开场白内容\n\n## 第一段标题\n\n第一段正文\n更多内容\n\n## 第二段标题\n\n第二段正文');
    ok('多段：3 段（开场+2 标题）', multi.length === 3);
    ok('多段：segId 重新编号为 seg-1/2/3', multi[0].segId === 'seg-1' && multi[1].segId === 'seg-2' && multi[2].segId === 'seg-3');
    ok('多段：标题正确解析', multi[1].heading === '第一段标题' && multi[2].heading === '第二段标题');
    ok('多段：seg-2 正文无首尾空白', multi[1].body === '第一段正文\n更多内容');
    const sub = W4.segResult('## 主段\n\n主段内容\n\n### 子段A\n\n子段A内容\n\n### 子段B\n\n子段B内容');
    ok('含 ### 子段：1 主段 + 2 子段', sub.length === 3);
    ok('含 ### 子段：level 区分', sub[0].level === 2 && sub[1].level === 3 && sub[2].level === 3);
  }

  // ---- 2. summaryText 字段优先（ADR 0008） ----
  console.log('\n[2] summaryText 字段优先（表单是唯一真相源）');
  {
    const st = freshState();
    sandbox.state = st;
    st.work4.product.name = 'X';
    st.work4.product.description = 'desc';
    st.work4.product.coreDifferentiators = ['安全', '便捷'];
    st.work4.product.aiResult = '## A\n\nA 内容（叙事，即使已采纳也不参与导出）';
    st.work4.product.adoptedSegments = { 'seg-1':{at:1} };
    const txt = W4.summaryText('product');
    ok('有字段时输出字段（不输出叙事段落）', txt.includes('产品名：X') && !txt.includes('A 内容'));
    ok('字段摘要含差异化', txt.includes('核心差异化：安全、便捷'));
    // price 跨文化 3 字段进摘要（ADR 0008 补全）
    st.work4.price.strategy = 'value';
    st.work4.price.ppp = '购买力中等';
    st.work4.price.fxSensitivity = '建议美元结算';
    const pt = W4.summaryText('price');
    ok('price 摘要含 PPP 校准', pt.includes('PPP 校准：购买力中等'));
    ok('price 摘要含汇率敏感度', pt.includes('汇率敏感度：建议美元结算'));
    // promotion CRM 字段
    st.work4.promotion.theme = '让烹饪更轻松';
    st.work4.promotion.crm.membership = '积分制';
    const pt2 = W4.summaryText('promotion');
    ok('promotion 摘要含主题', pt2.includes('传播主题：让烹饪更轻松'));
    ok('promotion 摘要含 CRM', pt2.includes('CRM：') && pt2.includes('积分制'));
  }

  // ---- 3. adoptAll（自动采纳用） ----
  console.log('\n[3] 全部采纳（adoptAll）');
  {
    const st = freshState();
    sandbox.state = st;
    st.work4.price.aiResult = '## A\n\nA\n\n## B\n\nB\n\n## C\n\nC';
    ok('adoptAll: 初始无采纳', Object.keys(st.work4.price.adoptedSegments).length === 0);
    W4.adoptAll('price');
    ok('adoptAll: 3 段全采纳', Object.keys(st.work4.price.adoptedSegments).length === 3);
    W4.adoptAll('price');
    ok('adoptAll: 幂等（重复不增）', Object.keys(st.work4.price.adoptedSegments).length === 3);
  }

  // ---- 4. 步规格 STEP_FIELD_SPEC（条件裁剪） ----
  console.log('\n[4] STEP_FIELD_SPEC 字段规格');
  {
    const st = freshState();
    sandbox.state = st;
    // 默认 global + physical
    ok('4 P 都有规格', ['product','price','place','promotion'].every(k => Array.isArray(W4.STEP_FIELD_SPEC[k])));
    ok('place = PLACE_FIELD_AI + structure（11 条）', W4.STEP_FIELD_SPEC.place.length === 11 && W4.STEP_FIELD_SPEC.place[10].key === 'structure');
    ok('place 渲染与起草共用 PLACE_FIELD_AI', W4.PLACE_FIELD_AI.length === 10);
    // global + physical：product 含认证/本地化 3 条，不含 7P
    const prod = W4.stepSpecs('product');
    ok('product(global,physical)：8 条（5 基础 + 3 跨文化）', prod.length === 8);
    ok('product：含 市场准入认证', prod.some(s => s.key === 'certifications'));
    ok('product：不含 People 人员', !prod.some(s => s.key === 'people'));
    // domestic：跨文化字段被裁剪
    st.work4.route.scope = 'domestic';
    const prodDom = W4.stepSpecs('product');
    const promoDom = W4.stepSpecs('promotion');
    const priceDom = W4.stepSpecs('price');
    ok('product(domestic)：5 条（无跨文化）', prodDom.length === 5 && !prodDom.some(s => s.key === 'certifications'));
    ok('promotion(domestic)：无 跨文化 4 字段', !promoDom.some(s => ['context','taboos','kolTiers','language'].includes(s.key)));
    ok('price(domestic)：无 PPP/数字/汇率', !priceDom.some(s => ['ppp','pricingNumbers','fxSensitivity'].includes(s.key)));
    // service 业务：7P 扩展出现
    st.work4.route.scope = 'global';
    st.work4.product.businessType = 'service';
    const prodSvc = W4.stepSpecs('product');
    ok('product(service)：含 People/Process/PE', ['people','process','physicalEvidence'].every(k => prodSvc.some(s => s.key === k)));
    // place 本地渠道关系（xc:true）：仅出海
    st.work4.route.scope = 'domestic';
    ok('place(domestic)：无 本地渠道关系', !W4.stepSpecs('place').some(s => s.key === 'localChannelRelations'));
    st.work4.route.scope = 'global';
    ok('place(global)：含 本地渠道关系', W4.stepSpecs('place').some(s => s.key === 'localChannelRelations'));
  }

  // ---- 5. buildStepPrompt 组合提示词 ----
  console.log('\n[5] buildStepPrompt 组合提示词');
  {
    const st = freshState();
    sandbox.state = st;
    sandbox.Work2.selectedTiers = () => st.work2.selectedTiers;
    st.work4.product.coreDifferentiators = ['安全'];
    st.work4.price.tiers = [{name:'标准版', price:149, unit:'GBP'}];
    const prompt = W4.buildStepPrompt('promotion');
    ok('prompt 含 专家角色', prompt.includes('整合营销传播专家'));
    ok('prompt 含 上下文（市场/主张）', prompt.includes('东南亚') && prompt.includes('让烹饪更轻松'));
    ok('prompt 含全部有效 key', ['theme','advertising','pr','salesPromotion','crm','contentStrategy','context','taboos','kolTiers','language'].every(k => prompt.includes('（' + k + '）')));
    ok('prompt 含字段 guide', prompt.includes('传播主题') && prompt.includes('键名 media/budgetShare/message/kpi'));
    ok('prompt 约定末尾一个 JSON 块', prompt.includes('末尾一个') && prompt.includes('json'));
    ok('prompt 无 emoji', !/[\u{1F300}-\u{1FAFF}☀-➿✦⚡✓↻▶★]/u.test(prompt));
  }

  // ---- 6. extractStepJsonObject：末尾对象优先 ----
  console.log('\n[6] extractStepJsonObject');
  {
    const st = freshState();
    sandbox.state = st;
    // 叙事 + 两个对象：取最后一个
    const t1 = '## 传播主题\n\n正文\n\n```json\n{"theme":"旧"}\n```\n\n```json\n{"theme":"新","advertising":[{"media":"TikTok","budgetShare":100}]}\n```';
    const o1 = W4.extractStepJsonObject(t1);
    ok('多块取最后一个对象', o1 && o1.theme === '新');
    ok('对象内数组保留', o1 && o1.advertising.length === 1);
    // 无 fence 裸对象（含智能引号）兜底
    const t2 = '{“theme”:“裸JSON”, “crm”:{“tool”:“CRM”}}';
    const o2 = W4.extractStepJsonObject(t2);
    ok('无 fence 裸对象 + 智能引号 → 解析', o2 && o2.theme === '裸JSON' && o2.crm.tool === 'CRM');
    // 数组块不当作字段对象
    const t3 = '```json\n[{"media":"a"}]\n```';
    ok('数组块不返回（需要对象）', W4.extractStepJsonObject(t3) === null);
    // 无任何 JSON
    ok('纯正文 → null', W4.extractStepJsonObject('就是一段话') === null);
  }

  // ---- 7. applyStepAll：整组覆盖 + 容错 + 不静默失败 ----
  console.log('\n[7] applyStepAll 整组覆盖');
  {
    const st = freshState();
    sandbox.state = st;
    sandbox.Work2.selectedTiers = () => st.work2.selectedTiers;
    const p = st.work4.promotion;
    const gen = '## 传播主题\n\n正文参考\n\n```json\n{' +
      '"theme":"让烹饪更轻松",' +
      '"advertising":[{"media":"TikTok","budgetShare":70,"message":"轻松下厨","kpi":"CPM"},{"media":"小红书","budgetShare":30,"message":"食谱内容","kpi":"CTR"}],' +
      '"pr":[{"event":"新品发布","timing":"Q4","expectedReach":"500w"}],' +
      '"salesPromotion":[{"tactic":"满减","mechanic":"满200减30","period":"11月"}],' +
      '"crm":{"tool":"企微","membership":"积分制","repurchase":"老客券","notes":""},' +
      '"contentStrategy":"KOL 矩阵 + UGC",' +
      '"context":"高语境",' +
      '"taboos":"避开绿色",' +
      '"kolTiers":"头部1+腰部5",' +
      '"language":"本地化翻译"}\n```';
    const r = W4.applyStepAll('promotion', gen);
    ok('applyStepAll 成功', r.ok === true);
    ok('theme 文本填入', p.theme === '让烹饪更轻松');
    ok('advertising 表格清洗（share 归一）', p.advertising.length === 2 && Math.abs(p.advertising.reduce((s,a)=>s+a.budgetShare,0) - 100) < 1);
    ok('pr 表格填入', p.pr.length === 1 && p.pr[0].event === '新品发布');
    ok('salesPromotion 表格填入', p.salesPromotion.length === 1);
    ok('crm 对象 4 键', p.crm.tool === '企微' && p.crm.membership === '积分制' && p.crm.repurchase === '老客券' && p.crm.notes === '');
    ok('内容策略文本填入', p.contentStrategy === 'KOL 矩阵 + UGC');
    ok('跨文化字段填入', p.context === '高语境' && p.taboos === '避开绿色' && p.kolTiers === '头部1+腰部5' && p.language === '本地化翻译');
    // 缺失 key 不动、失败不静默
    const before = JSON.stringify(p.advertising);
    const r2 = W4.applyStepAll('promotion', '没有 JSON');
    ok('无 JSON：ok:false + reason', r2.ok === false && !!r2.reason);
    ok('失败时字段不动', JSON.stringify(p.advertising) === before);
    // 只含部分 key：未含字段不动
    W4.applyStepAll('promotion', '```json\n{"theme":"新主题"}\n```');
    ok('部分 key：theme 覆盖', p.theme === '新主题');
    ok('部分 key：未含的 crm 不动', p.crm.membership === '积分制');
    // 截断抢救：对象完整但结尾 ``` 被 max_tokens 切掉 → 括号平衡扫描仍可应用
    const truncated = '## 传播主题\n\n正文\n\n```json\n{"theme":"截断主题","crm":{"tool":"企微","membership":"积分"}}';
    const r3 = W4.applyStepAll('promotion', truncated);
    ok('未闭合 fence：抢救成功', r3.ok === true);
    ok('未闭合 fence：完整字段生效', p.theme === '截断主题' && p.crm.membership === '积分');
    ok('未闭合 fence：未含字段不动', p.advertising.length === 2);
    // 真正截断在对象中途（顶层缺 }）：无有效前缀可救 → 显式失败、字段不动
    const midTrunc = '```json\n{"theme":"切半主题","advertising":[{"media":"a"}';
    const r4 = W4.applyStepAll('promotion', midTrunc);
    ok('对象中途截断：抢救失败 + reason', r4.ok === false && !!r4.reason);
    ok('对象中途截断：字段不动', p.theme === '截断主题');
  }

  // ---- 8. applyStepAll：place（tags/text/structure）与 price（enum） ----
  console.log('\n[8] applyStepAll place/price');
  {
    const st = freshState();
    sandbox.state = st;
    sandbox.Work2.selectedTiers = () => st.work2.selectedTiers;
    const placeGen = '```json\n{"onlineSelf":["官网","App"],"onlineThird":"Amazon, TikTok Shop","structure":[{"name":"线上","children":[{"name":"自营","share":40},{"name":"三方","share":60}]}]}\n```';
    const r = W4.applyStepAll('place', placeGen);
    ok('place 应用成功', r.ok === true);
    ok('tags 数组填入', JSON.stringify(st.work4.place.onlineSelf) === JSON.stringify(['官网','App']));
    ok('逗号字符串 tag 拆分', JSON.stringify(st.work4.place.onlineThird) === JSON.stringify(['Amazon','TikTok Shop']));
    ok('structure 解析归一', st.work4.place.structure.length === 1 && Math.abs(st.work4.place.structure[0].children.reduce((s,c)=>s+c.share,0) - 100) < 1);
    const priceGen = '```json\n{"strategy":"value","strategyNote":"高端定位","tiers":[{"name":"基础版","targetSegment":"入门","price":89,"unit":"GBP","hero":false,"notes":""}],"ppp":"购买力中等"}\n```';
    const r2 = W4.applyStepAll('price', priceGen);
    ok('price 应用成功', r2.ok === true);
    ok('enum 单选校验通过', st.work4.price.strategy === 'value');
    ok('strategyNote 文本', st.work4.price.strategyNote === '高端定位');
    ok('tiers 表格清洗', st.work4.price.tiers.length === 1 && st.work4.price.tiers[0].price === 89);
    ok('ppp 跨文化字段填入', st.work4.price.ppp === '购买力中等');
    // 非法 enum 值被忽略
    W4.applyStepAll('price', '```json\n{"strategy":"not-a-real-strategy"}\n```');
    ok('非法 enum 值忽略（原值保留）', st.work4.price.strategy === 'value');
  }

  // ---- 9. stepHasContent（覆盖确认依据） ----
  console.log('\n[9] stepHasContent');
  {
    const st = freshState();
    sandbox.state = st;
    ok('空字段 → false', W4.stepHasContent('promotion') === false);
    st.work4.promotion.theme = '有主题';
    ok('文本字段有值 → true', W4.stepHasContent('promotion') === true);
    const st2 = freshState();
    sandbox.state = st2;
    st2.work4.promotion.crm.membership = '积分';
    ok('嵌套 crm 有值 → true', W4.stepHasContent('promotion') === true);
    const st3 = freshState();
    sandbox.state = st3;
    st3.work4.place.structure = [{name:'线上', children:[{name:'自营', share:100}]}];
    ok('structure 有值 → true', W4.stepHasContent('place') === true);
  }

  // ---- 10. runAiDraft 双写（字段 + 叙事自动采纳）+ 直接覆盖 ----
  console.log('\n[10] runAiDraft 双写 + 直接覆盖');
  {
    const st = freshState();
    sandbox.state = st;
    sandbox.Work2.selectedTiers = () => st.work2.selectedTiers;
    toasts = []; confirmCalls = [];
    let captured = null;
    sandbox.API.aiButton = (opts) => { captured = opts; };
    const btn = { textContent:'AI 起草', disabled:false };
    W4.runAiDraft('promotion', { short:'传播方案' }, btn);
    ok('首次生成不弹确认', confirmCalls.length === 0);
    ok('aiButton 收到 prompt（含 JSON 约定）', captured && captured.buildPrompt()[0].content.includes('末尾一个'));
    // 模拟 LLM 返回：正文 + 对象
    captured.onResult('## 传播主题\n\n参考正文\n\n```json\n{"theme":"AI 主题","crm":{"tool":"企微","membership":"积分制"}}\n```', null, 'mock');
    ok('字段已填入', st.work4.promotion.theme === 'AI 主题' && st.work4.promotion.crm.membership === '积分制');
    ok('叙事已存 aiResult（JSON 块被剥掉）', st.work4.promotion.aiResult.includes('## 传播主题') && !st.work4.promotion.aiResult.includes('```json'));
    ok('段落自动全部采纳', Object.keys(st.work4.promotion.adoptedSegments).length === 1);
    ok('toast 报份数', toasts.some(t => t.includes('已生成并填入') && t.includes('个字段')));
    ok('toast 无 emoji', !toasts.some(t => /[\u{1F300}-\u{1FAFF}☀-➿✦⚡✓↻▶★]/u.test(t)));
    // 已有 AI 结果：直接整体覆盖，不弹 confirm
    confirmCalls = [];
    W4.runAiDraft('promotion', { short:'传播方案' }, btn);
    ok('已有 AI 结果直接覆盖且不 confirm', confirmCalls.length === 0);
    // 解析失败：叙事照存 + 字段不动
    st.work4.promotion.theme = '手动主题';
    st.work4.promotion.aiResult = '';
    st.work4.promotion.adoptedSegments = {};
    confirmCalls = []; toasts = [];
    W4.runAiDraft('promotion', { short:'传播方案' }, btn);
    captured.onResult('## 一段正文\n\n没有 JSON', null, 'mock');
    ok('失败时正文仍存 aiResult', st.work4.promotion.aiResult.includes('一段正文'));
    ok('失败时字段不动', st.work4.promotion.theme === '手动主题');
    ok('失败 toast 显式 reason', toasts.some(t => t.includes('未能解析字段')));
  }

  // ---- 11. renderSegments 只读展示 ----
  console.log('\n[11] renderSegments 只读展示');
  {
    const st = freshState();
    sandbox.state = st;
    ok('无 aiResult → null', W4.renderSegments('product') === null);
    st.work4.product.aiResult = '## 物理特征\n\n3 句话\n\n```json\n[{"name":"旧数据"}]\n```';
    const wrap = W4.renderSegments('product');
    ok('有 aiResult → 返回容器', !!wrap);
    // 段落文本直接 markdown 渲染
    ok('renderMarkdown 转义防注入', !W4.renderMarkdown('<script>x</script>').includes('<script>'));
    ok('renderMarkdown 列表渲染', W4.renderMarkdown('- a\n- b').includes('<li'));
    // 2026-09-01：叙事区 Markdown 表格 → table.data（复用表单表格样式，要求分隔行）
    const mdTbl = '## 价格档位\n\n| 档位 | 目标人群 | 建议价格 |\n| --- | --- | --- |\n| 基础版 | 入门用户 | £89.99 |\n| **标准版** | 新手父母 | £149.99 |\n\n三档价差控制在 £60。';
    const tblHtml = W4.renderMarkdown(mdTbl);
    ok('renderMarkdown 表格 → table.data', tblHtml.includes('<table class="data"') && tblHtml.includes('<th>档位</th>'), tblHtml);
    ok('  表头与数据行', tblHtml.includes('<td>基础版</td>') && tblHtml.includes('£89.99'));
    ok('  格内粗体生效', tblHtml.includes('<td><strong>标准版</strong></td>'));
    ok('  竖线不再裸露为段落', !/<p[^>]*>\s*\|/.test(tblHtml));
    ok('  表后散文正常', tblHtml.includes('三档价差控制在'));
    ok('  全角竖线容错', W4.renderMarkdown('｜A｜B｜\n｜---｜---｜\n｜1｜2｜').includes('<td>1</td>'));
    ok('  无分隔行仍是段落', W4.renderMarkdown('a | b\nc | d').includes('<p'));
  }

  // ---- 12. parseStructured 兜底链（ADR 0005 长期回归） ----
  console.log('\n[12] parseStructured 兜底');
  {
    const saved = sandbox.JsonExtract;
    delete sandbox.JsonExtract;
    const r1 = W4.parseStructured('this is not json', 'structure');
    ok('无 JsonExtract + 无效 JSON：ok=false', !r1.ok);
    ok('无 JsonExtract + reason 指明解析库未加载', /解析库未加载/.test(r1.reason || ''));
    const r2 = W4.parseStructured('[{"name":"x","targetSegment":"y","price":1,"unit":"u","hero":false,"notes":""}]', 'tiers');
    ok('无 JsonExtract + 合法 JSON 同样显式失败', !r2.ok && /解析库未加载/.test(r2.reason || ''));
    sandbox.JsonExtract = saved;
  }

  // ---- 13. Markdown 表格 fallback + 智能引号 + 截断抢救（保持） ----
  console.log('\n[13] Markdown 表格 / 智能引号 / 截断抢救');
  {
    const md1 = '## 段标题\n\n| 档位 | 价格 | 单位 | 目标客群 | 备注 |\n| --- | --- | --- | --- | --- |\n| 基础版 | 89 | GBP | 价格敏感 | 入门 |\n| 标准版 | 149 | GBP | 中端家庭 | 主力 |\n';
    const r1 = W4.parseStructured(md1, 'tiers');
    ok('tiers: Markdown fallback 2 行', r1.ok && r1.value.length === 2 && r1.value[0].name === '基础版');
    ok('tiers: fallback 警告', r1.warnings && r1.warnings.some(w => /markdown-table/.test(w)));
    const LQ = '“', RQ = '”';
    const smart = '## 各档位建议定价\n```json\n[{' + LQ + 'name' + RQ + ':' + LQ + '基础版' + RQ + ',' + LQ + 'price' + RQ + ':89}]';
    const r2 = W4.parseStructured(smart, 'tiers');
    ok('智能引号 fence: 归一化解析成功', r2.ok && r2.value[0].name === '基础版');
    const trunc = '```json\n[{"name":"基础版","price":"79","hero":false},{"name":"进阶版","hero":true}';
    const r3 = W4.parseStructured(trunc, 'tiers');
    ok('截断 JSON: 抢救 2 行', r3.ok && r3.value.length === 2 && r3.value[1].hero === true);
    ok('截断 JSON: warning 标记', r3.ok && r3.warnings.some(w => /truncated-json-salvaged/.test(w)));
    ok('_lenientJsonParse 三级降级', W4._lenientJsonParse('[{"a":1}]').via === 'strict' && W4._lenientJsonParse('not json') === null);
    ok('_normalizeJsonQuotes 智能引号归一', W4._normalizeJsonQuotes('“x”') === '"x"');
    // 表格抗抖动
    ok('表格: 全角竖线归一', (W4.parseMarkdownTable('｜档位｜价格｜\n｜---｜---｜\n｜基础版｜79｜')||[]).length === 1);
    ok('表格: em-dash 分隔行', (W4.parseMarkdownTable('| 档位 | 价格 |\n|———|———|\n| 基础版 | 79 |')||[]).length === 1);
    ok('表格: 多块取最大', (W4.parseMarkdownTable('| a | b |\n|---|---|\n| 1 | 2 |\n\n| c | d |\n|---|---|\n| 3 | 4 |\n| 5 | 6 |')||[]).length === 2);
  }

  // ---- 14. tagList schema（保持） ----
  console.log('\n[14] tagList schema');
  {
    ok('tagList: bullet 解析', W4.parseStructured('- 官网\n- App', 'tagList').ok && W4.parseStructured('- 官网\n- App', 'tagList').value.length === 2);
    ok('tagList: 中文逗号解析', W4.parseStructured('官网、App、小程序', 'tagList').ok && W4.parseStructured('官网、App、小程序', 'tagList').value.length === 3);
    ok('tagList: JSON 数组解析', W4.parseStructured('["Amazon"]', 'tagList').ok && W4.parseStructured('["Amazon"]', 'tagList').value.length === 1);
    ok('tagList: 单值 → 1 元素', W4.parseStructured('单个值', 'tagList').value[0] === '单个值');
  }

  // ---- 15. chart helpers（保持） ----
  console.log('\n[15] chart helpers');
  {
    ok('renderPlaceChannel 是函数', typeof W4.renderPlaceChannel === 'function');
    ok('renderHundredBudget 是函数', typeof W4.renderHundredBudget === 'function');
    ok('renderPriceTiers 是函数', typeof W4.renderPriceTiers === 'function');
  }

  // ---- 16. 结构清理：无 summary 步 / 无 draft4P / 无旧入口 ----
  console.log('\n[16] 结构清理（ADR 0008）');
  {
    ok('steps 只剩 5 步（无 summary）', W4.steps.length === 5 && !W4.steps.some(s => s.id === 'summary'));
    ok('NEXT_STEPS 无 promotion 下游（promotion 是末步）', !('promotion' in W4.NEXT_STEPS) && W4.NEXT_STEPS.place === 'promotion');
    ok('无 mvo.summary', !W4.mvo.summary);
    ok('4 P mvo 无「采纳了至少 1 个 AI 起草段落」检查', ['product','price','place','promotion'].every(k =>
      !W4.mvo[k]().checks.some(c => c.label.includes('采纳'))));
    ok('draft4P 已删除', typeof W4.draft4P === 'undefined' && typeof W4.draft4PRow === 'undefined');
    ok('hydrateLastPrompts 已删除', typeof W4.hydrateLastPrompts === 'undefined');
    ok('aiBox 已删除', typeof W4.aiBox === 'undefined');
    ok('segText 已删除', typeof W4.segText === 'undefined');
    ok('fieldAiButton / _fieldWithAi 已删除', typeof W4.fieldAiButton === 'undefined' && typeof W4._fieldWithAi === 'undefined');
    ok('targetFieldMap / writeStructuredField 已删除', typeof W4.targetFieldMap === 'undefined' && typeof W4.writeStructuredField === 'undefined');
    ok('mergeAiResult / _appendAiResult 已删除', typeof W4.mergeAiResult === 'undefined' && typeof W4._appendAiResult === 'undefined');
    ok('RENDER_VERSION 保留正文渲染缓存失效版本', Number(W4.RENDER_VERSION) >= 6);
    // 源码级：新入口文案统一「AI 起草」，无 emoji
    const src = w4Src;
    ok('源码含 4 个统一步级按钮', ['AI 起草产品卖点','AI 起草定价建议','AI 起草渠道策略','AI 起草传播方案'].every(s => src.includes(s)));
    ok('源码不再有「让 AI 生成」旧文案', !src.includes('让 AI 生成渠道策略') && !src.includes('让 AI 生成传播方案'));
    ok('源码不再有 draft4P / fieldAiButton / _fieldWithAi', !src.includes('draft4P') && !src.includes('fieldAiButton') && !src.includes('_fieldWithAi'));
  }

  console.log(`
${pass} passed, ${fail} failed`);

  process.exit(fail ? 1 : 0);
})();
