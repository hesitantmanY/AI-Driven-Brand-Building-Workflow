/* ============================================================
   WORKSHOP 4 — 营销组合 4P
   Steps: route / product / price / place / promotion（无汇总步——
   4P 做完经 promotion 末步跨坊 CTA 直达 Workshop 5，汇总由 Work5 承担）
   2026-09-01 步级 AI 起草统一（ADR 0008，supersedes ADR 0004/0007）：
   - 每 P 步首一个「AI 起草」主按钮（workshop123 模式）：一次 LLM 调用
     双写——字段 JSON 容错解析整组填入表单，叙事 Markdown 存 aiResult
     并自动全部采纳（段落区只读正文展示，JSON 永不外露）
   - 已有 AI 结果时点「重新生成」直接整体替换（不弹确认）
   - summaryText 字段优先（表单是唯一真相源，导出/Work5 随字段变更）
   - simpleTable oninput 触发 chart 局部刷新
   ============================================================ */
Work4.steps = [
  {id:'route',     label:'1. 路径'},
  {id:'product',   label:'2. 产品'},
  {id:'price',     label:'3. 价格'},
  {id:'place',     label:'4. 渠道'},
  {id:'promotion', label:'5. 促销'}
];
// 每步的下游步骤；末步（promotion）无下游，出口走跨坊 CTA（2026-08-28 统一步间 CTA）
Work4.NEXT_STEPS = { route:'product', product:'price', price:'place', place:'promotion' };

Work4.defaultData = () => ({
  _meta: {},
  route: {
    scope:'global',
    oemType:'',
    entryMode:'',
    light:[],
    politicalPower:''
  },
  product: {
    name:'', description:'', coreDifferentiators:[],
    physicalFeatures:'', serviceOffering:'', technologyMoat:'',
    skus:[], aiResult:'', _aiGenerated:false,
    businessType:'physical',
    certifications:'', localization:'', serviceLocalization:'',
    people:'', process:'', physicalEvidence:'',
    // 段落化（2026-08-29 ADR 0004）：segId → {at, source, targetField?}
    adoptedSegments: {}
  },
  price: {
    strategy:'', strategyNote:'',
    tiers:[], channelPricing:[], promotions:[],
    competitorPrices:'', aiResult:'', _aiGenerated:false,
    ppp:'', pricingNumbers:'', fxSensitivity:'',
    adoptedSegments: {}
  },
  place: {
    onlineSelf:[], onlineThird:[], onlineNotes:'',
    offlineDirect:[], offlineDistrib:[], offlineRetail:[], offlineNotes:'',
    keyPartners:[], channelIncentives:'',
    structure:[],
    aiResult:'', _aiGenerated:false,
    localChannelRelations:'',
    adoptedSegments: {}
  },
  promotion: {
    advertising:[], pr:[], salesPromotion:[],
    crm:{tool:'',membership:'',repurchase:'',notes:''},
    contentStrategy:'', aiResult:'', _aiGenerated:false, theme:'',
    context:'', taboos:'', kolTiers:'', language:'',
    adoptedSegments: {}
  }
});

// Bump when changing render output so cached steps re-render for existing users.
Work4.RENDER_VERSION = '7';

// 段落切分（按 Markdown 二级/三级标题）
// 返回 [{segId, level, heading, body}]；segId 形如 'seg-1' / 'seg-2-1'（含子段时）。
// 无标题时整段作为 'seg-0' 单一段落返回。
Work4.segResult = function(rawText){
  if(!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\r?\n/);
  const segs = [];
  let cur = null;
  let pre = [];           // 标题前的开场白（intro）
  for(const line of lines){
    const m2 = line.match(/^##\s+(.+?)\s*$/);
    const m3 = line.match(/^###\s+(.+?)\s*$/);
    if(m2 || m3){
      if(cur){
        cur.body = cur.body.join('\n').trim();
        segs.push(cur);
      } else if(pre.length){
        segs.push({segId:'seg-0', level:2, heading:'开场', body:pre.join('\n').trim()});
      }
      cur = {segId:`seg-${segs.length+1}`, level: m3?3:2, heading:(m3?m3[1]:m2[1]).trim(), body:[]};
    } else {
      if(cur) cur.body.push(line);
      else pre.push(line);
    }
  }
  if(cur){
    cur.body = cur.body.join('\n').trim();
    segs.push(cur);
  } else if(pre.length && !segs.length){
    segs.push({segId:'seg-0', level:2, heading:'开场', body:pre.join('\n').trim()});
  }
  // 重新编号 segId（保证连续）
  segs.forEach((s,i)=> s.segId = `seg-${i+1}`);
  return segs;
};

// JSON 健壮解析 + schema 校验（work4 schema 集合）。
// 返回 {ok, value, raw, reason, warnings}
// 解析 Markdown 表格 → 数组对象 [{col1: val1, col2: val2, ...}]
// 输入：含 "## 标题\n| 列1 | 列2 |\n| --- | --- |\n| v1 | v2 |\n..." 的文本
// 输出：[{col1:'v1', col2:'v2', ...}, ...] 或 null（无表格）
// 2026-08-30 重写：旧逐行状态机对 LLM 输出抖动零容忍——全角竖线 ｜、行首零宽字符、
// 分隔行后夹空行、数据行缺一侧竖线、em-dash 当分隔符，任一抖动即 break 返回 null
// （截图故障：明明有表却报「未找到 JSON 块或 Markdown 表格」）。
// 改为块扫描：归一化后找所有「表头行 + 分隔行 + 数据行」块，取行数最多的。
// ============================================================
// 结构化解析链（2026-09-01 架构评审候选 1）：实现已迁入 JsonExtract，
// 这里只留薄委托，保证调用点与既有测试兼容。JsonExtract 缺失时显式失败，
// 不再在 Work4 内维护第二套兜底链（ADR 0005 增补）。
// ============================================================
Work4.parseMarkdownTable = function(rawText){
  return (typeof JsonExtract!=='undefined' && JsonExtract.parseMarkdownTable)
    ? JsonExtract.parseMarkdownTable(rawText) : null;
};
Work4._normalizeJsonQuotes = function(text){
  return (typeof JsonExtract!=='undefined' && JsonExtract.normalizeJsonQuotes)
    ? JsonExtract.normalizeJsonQuotes(text) : text;
};
Work4._escapeBareNewlines = function(text){
  return (typeof JsonExtract!=='undefined' && JsonExtract.escapeBareNewlines)
    ? JsonExtract.escapeBareNewlines(text) : text;
};
Work4._lenientJsonParse = function(body){
  return (typeof JsonExtract!=='undefined' && JsonExtract.lenientJsonParse)
    ? JsonExtract.lenientJsonParse(body) : null;
};
Work4._salvageJsonArray = function(rawText){
  return (typeof JsonExtract!=='undefined' && JsonExtract.salvageJsonArray)
    ? JsonExtract.salvageJsonArray(rawText) : null;
};
Work4._overlaySalvaged = function(rows, salvRows, schemaKey){
  if(typeof JsonExtract!=='undefined' && JsonExtract.overlaySalvaged){
    JsonExtract.overlaySalvaged(rows, salvRows, schemaKey);
  }
};
// 2026-08-31：草稿区 textarea 里 ```json 块常被 LLM 压成单行（如 [{"name":"基础版",...},...]）。
// 产品步 prompt 软提示 SKU 走 JSON，LLM 通常只输出 prose；价格步 prompt 同时给 Markdown 表格 +
// JSON 块，两者都"漏出来"在 textarea 里很丑。这里在写 aiResult / 渲染段位 / 浮层草稿前，
// 把 ```json``` 块原地 pretty-print（2 空格缩进）。失败时原样保留（不动用户手改），
// 语言标签大小写跟随原文，不动其他 fence / 表格 / prose。
Work4._prettifyJsonBlocks = function(text){
  if(!text || typeof text !== 'string') return text;
  const opener = /```(json|JSON)[ \t]*\n/g;
  let out = '', lastEnd = 0, m;
  while((m = opener.exec(text)) !== null){
    const openStart = m.index;
    const lang = m[1];
    const bodyStart = openStart + m[0].length;
    const rest = text.slice(bodyStart);
    const closeMatch = rest.match(/\n[ \t]*```/);
    let segEnd;
    let bodyRaw;
    if(closeMatch){
      bodyRaw = rest.slice(0, closeMatch.index);
      segEnd = bodyStart + closeMatch.index + closeMatch[0].length;
    } else {
      bodyRaw = rest;
      segEnd = text.length;
    }
    const trimmed = bodyRaw.replace(/^\s+/,'').replace(/\s+$/,'');
    out += text.slice(lastEnd, openStart);
    if(trimmed){
      let parseTarget = trimmed;
      if(!closeMatch){
        const stripped = trimmed.replace(/```+\s*$/, '').trim();
        if(stripped && stripped !== trimmed) parseTarget = stripped;
      }
      const lenient = Work4._lenientJsonParse(parseTarget);
      let parsed = lenient && lenient.value;
      if(parsed == null && closeMatch){
        const salv = Work4._salvageJsonArray(trimmed);
        if(salv && salv.value != null) parsed = salv.value;
      }
      let pretty = null;
      if(parsed != null){ try{ pretty = JSON.stringify(parsed, null, 2); }catch(e){ pretty = null; } }
      if(pretty != null){
        out += '```' + lang + '\n' + pretty + '\n```';
        lastEnd = segEnd;
        continue;
      }
    }
    out += text.slice(openStart, segEnd);
    lastEnd = segEnd;
  }
  out += text.slice(lastEnd);
  return out;
};

Work4.parseStructured = function(rawText, schemaKey){
  if(typeof JsonExtract==='undefined' || !JsonExtract.structured){
    // 2026-09-01：解析库必须加载（tests/llm_seam.test.js 源码断言锁死）。
    // 缺失时显式失败，不再静默早退。
    return {ok:false, raw:rawText||'', reason:'解析库未加载：JsonExtract 缺失'};
  }
  return JsonExtract.structured(rawText, schemaKey);
};

/* ============================================================
   步级 AI 起草（2026-09-01 ADR 0008）：每 P 步一个「AI 起草」主按钮
   一次 LLM 调用 → 叙事正文（## 标题 + 散文）+ 末尾一个 JSON 对象（全部字段）
   → 字段 JSON 容错解析整组填入表单；叙事存 aiResult 自动全部采纳（只读展示）
   ============================================================ */
Work4.isGlobal  = () => !!state.work4 && state.work4.route.scope !== 'domestic';
Work4.isService = () => !!state.work4 && ['service','hybrid'].includes(state.work4.product.businessType);

// 每步字段规格（prompt 构建 + 解析清洗共用，一处维护）。
// kind: tags=字符串数组 / text=字符串 / table=数组对象（复用 parseStructured schema）
//       crm=对象{tool,membership,repurchase,notes} / structure=渠道结构 / enum=单选值
// cond: 条件字段——不满足条件时不出现在 prompt，解析时也跳过。
// place 的规格 = PLACE_FIELD_AI（渲染与起草共用）+ structure，见下方补挂。
Work4.STEP_FIELD_SPEC = {
  product: [
    { key:'coreDifferentiators', kind:'tags',  name:'核心差异化', guide:'3-6 条差异化卖点（功能/情感/服务承诺合并列出），字符串数组' },
    { key:'skus',                kind:'table', schema:'skus', name:'SKU 列表', guide:'2-4 个 SKU 对象数组，键名 name/specs/price_range/differentiator' },
    { key:'physicalFeatures',    kind:'text',  name:'物理特征 / 技术规格', guide:'1-3 句话谈关键技术参数、性能指标、规格差异' },
    { key:'serviceOffering',     kind:'text',  name:'服务承诺', guide:'1-2 句话谈售后、保修、安装、培训承诺' },
    { key:'technologyMoat',      kind:'text',  name:'技术护城河', guide:'1-3 句话谈专利、独有工艺、供应链优势' },
    { key:'certifications',      kind:'text',  name:'市场准入认证', cond:()=>Work4.isGlobal(), guide:'1-3 句话谈必需认证及获取路径' },
    { key:'localization',        kind:'text',  name:'本地化适配', cond:()=>Work4.isGlobal(), guide:'1-3 句话谈功能/审美/包装规格本地化' },
    { key:'serviceLocalization', kind:'text',  name:'服务本地化', cond:()=>Work4.isGlobal(), guide:'1-3 句话谈售后网络、本地语言、安装培训' },
    { key:'people',              kind:'text',  name:'People 人员', cond:()=>Work4.isService(), guide:'1-2 句话谈前台/客服/技师的形象与能力' },
    { key:'process',             kind:'text',  name:'Process 流程', cond:()=>Work4.isService(), guide:'1-2 句话谈交付步骤、响应时效' },
    { key:'physicalEvidence',    kind:'text',  name:'Physical Evidence 有形展示', cond:()=>Work4.isService(), guide:'1-2 句话谈门店/物料/界面/评价' }
  ],
  price: [
    { key:'strategy',       kind:'enum', values:['cost-plus','value','competitive','penetration','skimming'], name:'定价策略', guide:'五选一：cost-plus / value / competitive / penetration / skimming' },
    { key:'strategyNote',   kind:'text', name:'策略选择理由', guide:'1-2 句话' },
    { key:'tiers',          kind:'table', schema:'tiers', name:'价格档位', guide:'2-4 档对象数组，键名 name/targetSegment/price/unit/hero/notes' },
    { key:'channelPricing', kind:'table', schema:'channelPricing', name:'渠道差异化定价', guide:'对象数组，键名 channel/priceAdjustment/rationale' },
    { key:'promotions',     kind:'table', schema:'promotions', name:'促销节奏', guide:'2-4 条对象数组，键名 occasion/discount/period' },
    { key:'competitorPrices', kind:'text', name:'竞品价格信息', guide:'1-3 句话，含高端/中端/低端典型价位与差异化点' },
    { key:'ppp',            kind:'text', name:'购买力 / PPP 校准', cond:()=>Work4.isGlobal(), guide:'1-3 句话谈目标市场可支配收入、价格敏感度、价差建议' },
    { key:'pricingNumbers', kind:'text', name:'数字 / 尾数 / 税', cond:()=>Work4.isGlobal(), guide:'1-2 句话谈吉庆数字、.99 习惯、含税与增值税惯例' },
    { key:'fxSensitivity',  kind:'text', name:'汇率敏感度 / 本币结算', cond:()=>Work4.isGlobal(), guide:'1-2 句话谈本币/美元结算偏好、汇损影响、对冲策略' }
  ],
  promotion: [
    { key:'theme',           kind:'text',  name:'传播主题', guide:'一句话，与价值主张 / Slogan 一致' },
    { key:'advertising',     kind:'table', schema:'advertising', name:'广告 / 媒介组合', guide:'3-5 条对象数组，键名 media/budgetShare/message/kpi，budgetShare 总和 100' },
    { key:'pr',              kind:'table', schema:'pr', name:'公关事件', guide:'2-3 条对象数组，键名 event/timing/expectedReach' },
    { key:'salesPromotion',  kind:'table', schema:'salesPromotion', name:'销售促进', guide:'2-4 条对象数组，键名 tactic/mechanic/period' },
    { key:'crm',             kind:'crm',   name:'CRM 与复购', guide:'对象，键名 tool/membership/repurchase/notes' },
    { key:'contentStrategy', kind:'text',  name:'内容策略', guide:'1-3 句话谈 KOL/KOC 矩阵、UGC 引导、品牌叙事节奏' },
    { key:'context',         kind:'text',  name:'高/低语境', cond:()=>Work4.isGlobal(), guide:'1-2 句话谈高/低语境对内容方向的影响' },
    { key:'taboos',          kind:'text',  name:'禁忌与本地节日', cond:()=>Work4.isGlobal(), guide:'1-2 句话谈宗教、颜色、符号、性别表达等禁忌及可借势节日' },
    { key:'kolTiers',        kind:'text',  name:'KOL/KOC 分层', cond:()=>Work4.isGlobal(), guide:'1-2 句话谈头部/腰部/素人的平台选择与配比' },
    { key:'language',        kind:'text',  name:'语言 / 翻译 / 本地代言', cond:()=>Work4.isGlobal(), guide:'1-2 句话谈语言策略、翻译要求、本地代言建议' }
  ]
};

// 每步有效规格（过滤条件字段）
Work4.stepSpecs = function(pKey){
  const all = Work4.STEP_FIELD_SPEC[pKey] || [];
  return all.filter(s => s.cond ? s.cond() : (s.xc ? Work4.isGlobal() : true));
};

// 字段当前值摘要（prompt 的「已有」行）
Work4.fieldCurrent = function(pKey, spec){
  const p = state.work4[pKey];
  const v = p ? p[spec.key] : undefined;
  if(v == null || v === '') return '无';
  if(Array.isArray(v)) return v.length ? JSON.stringify(v) : '无';
  if(typeof v === 'object') return JSON.stringify(v);
  return String(v).trim() || '无';
};

// 每步上下文引用（上游决策 + 关键相邻字段；place 沿用旧 placeCtx 内容）
Work4.stepContext = function(pKey){
  const tiers = (typeof Work2!=='undefined'&&Work2.selectedTiers)?Work2.selectedTiers():{tier1:null};
  const vp = state.work3.proposition;
  const wid = state.work3.identity || {};
  const base = `业务"${state.work1.sbu.name||''}"，目标市场"${tiers.tier1?.name||'未选'}"，价值主张"${vp.chosenValueText||''}"，定位"${vp.positioningStatement||''}"，品牌人格 ${wid.mbti||vp.mbti||''}，Slogan"${wid.chosenSlogan||vp.chosenSlogan||''}"`;
  if(pKey === 'product'){
    return base + `。产品：${state.work4.product.name} ${state.work4.product.description}，已有差异化：${(state.work4.product.coreDifferentiators||[]).join('、')||'无'}`;
  }
  if(pKey === 'price'){
    return base + `。定价策略：${state.work4.price.strategy||'未选'}，已有档位：${JSON.stringify(state.work4.price.tiers||[])}，竞品：${state.work4.price.competitorPrices||'未提供'}`;
  }
  if(pKey === 'place'){
    return `业务"${state.work1.sbu.name||''}"进入"${tiers.tier1?.name||''}"，产品 ${state.work4.product.name||''}（${state.work4.product.description||''}），价格档位：${JSON.stringify(state.work4.price.tiers||[])}，价值主张："${vp.chosenValueText||''}"，当前渠道结构：${JSON.stringify(state.work4.place.structure||[])}`;
  }
  if(pKey === 'promotion'){
    return base + `。渠道结构：${JSON.stringify(state.work4.place.structure||[])}，当前主题：${state.work4.promotion.theme||'未填'}`;
  }
  return base;
};

// 组合提示词：正文（## 标题 + 散文）+ 末尾一个 JSON 对象（全部字段）
Work4.buildStepPrompt = function(pKey){
  const expert = {product:'产品营销专家', price:'定价策略顾问', place:'渠道策略专家', promotion:'整合营销传播专家'}[pKey] || '营销顾问';
  const title = {product:'产品卖点', price:'定价建议', place:'渠道策略', promotion:'传播方案'}[pKey];
  const lines = Work4.stepSpecs(pKey)
    .map(s => `- ${s.name}（${s.key}）：${s.guide}。已有：${Work4.fieldCurrent(pKey, s)}`)
    .join('\n');
  return `你是${expert}。${Work4.stepContext(pKey)}。
请给出${title}：先写叙事正文（每段 \`##\` 开头，散文/列表/Markdown 表格均可，供用户阅读），最后附一个 JSON 对象汇总全部字段建议（键名固定为下方括号内的小写 key；已有内容仅供参考，可被更优方案整体替换）：

${lines}

只输出：正文若干段 + 末尾一个 \`\`\`json\`\`\` 块。JSON 键名严格用上述 key；tags 类为字符串数组、partners 类为 [{name, side}] 对象数组（side 只能填 线上 或 线下，无法判断就省略 side）、table 类为对象数组、text 类为字符串、crm 为对象、structure 为渠道结构数组。除末尾 JSON 块外不要输出其他代码块。`;
};

// 提取末尾字段 JSON 对象（prompt 契约：最后一个能解析的对象块；无 fence 时整段裸 JSON 兜底）
Work4.extractStepJsonObject = function(text){
  const fences = String(text||'').match(/```(?:json|JSON)?\s*([\s\S]*?)```/g) || [];
  for(let i = fences.length - 1; i >= 0; i--){
    const body = fences[i].replace(/^```(?:json|JSON)?\s*/, '').replace(/```$/, '').trim();
    const got = Work4._lenientJsonParse(body);
    if(got && got.value && typeof got.value === 'object' && !Array.isArray(got.value)) return got.value;
  }
  const norm = Work4._escapeBareNewlines(Work4._normalizeJsonQuotes(String(text||'')));
  try{
    const v = JSON.parse(norm);
    if(v && typeof v === 'object' && !Array.isArray(v)) return v;
  }catch(e){}
  // 截断抢救（ADR 0005 同源）：fence 未闭合或对象被 max_tokens 切半时，
  // 从首个 { 起做括号平衡扫描；完整对象直接解析，未闭合对象回退渐进截尾。
  return Work4._salvageJsonObject(text);
};

// 对象形态抢救（_salvageJsonArray 的对象版）：fence 未闭合（max_tokens 把结尾 ``` 切掉）
// 或正文 + 裸对象时，从首个 { 起做括号平衡扫描取完整对象。
// 数组形态（非步级契约）直接拒绝；真正截断在对象中途的残缺 JSON 无法靠前缀救回（数组
// 抢救的截尾思路对对象不成立——顶层少一个 } 就没有任何有效前缀），交给用户重新生成。
Work4._salvageJsonObject = function(rawText){
  if(!rawText || typeof rawText !== 'string') return null;
  let body = null;
  const fenceRe = /```(?:json|JSON)?[^\n]*\n([\s\S]*?)(?:```|$)/g;
  let m, last = null;
  while((m = fenceRe.exec(rawText)) !== null){ last = m[1]; }
  if(last != null && last.trim()) body = last;
  else {
    const start = rawText.indexOf('{');
    if(start === -1) return null;
    body = rawText.slice(start);
  }
  body = Work4._normalizeJsonQuotes(body);
  const objStart = body.indexOf('{');
  if(objStart === -1) return null;
  if(body[0] === '[') return null;  // 数组块：不是步级字段对象，跳过
  let depth = 1, inStr = false, esc = false, quoteCh = '';
  const ends = [];
  for(let i = objStart + 1; i < body.length; i++){
    const ch = body[i];
    if(inStr){
      if(esc){ esc = false; continue; }
      if(ch === '\\'){ esc = true; continue; }
      if(ch === quoteCh) inStr = false;
      continue;
    }
    if(ch === '"' || ch === "'"){ inStr = true; quoteCh = ch; continue; }
    if(ch === '{') depth++;
    else if(ch === '}'){
      depth--;
      if(depth === 0) ends.push(i + 1);  // 完整对象结束位置（从后往前试）
    }
  }
  for(let i = ends.length - 1; i >= 0; i--){
    try{
      const v = JSON.parse(body.slice(objStart, ends[i]));
      if(v && typeof v === 'object' && !Array.isArray(v)) return v;
    }catch(e){}
  }
  return null;
};

// 整组覆盖：解析字段对象 → 逐 spec 清洗写入（仅写入对象里存在的 key，未含的字段不动）。
// 返回 {ok, n, total, reason?, warnings?}；解析失败不动任何字段（显式 toast，不静默）。
Work4.caseLocked = function(){ return !!(state && state.meta && (state.meta.isDemo || state.meta.demoCase)); };
Work4.applyStepAll = function(pKey, text){
  if(Work4.caseLocked()) return {ok:false, n:0, total:0, reason:'案例浏览中，不可修改'};
  const obj = Work4.extractStepJsonObject(text);
  const specs = Work4.stepSpecs(pKey);
  const p = state.work4[pKey];
  if(!obj) return {ok:false, n:0, total:specs.length, reason:'未找到字段 JSON 对象'};
  let n = 0;
  const warnings = [];
  const fieldLabel = s => s.key === 'keyPartners' ? '关键伙伴' : (s.name || s.key);
  const keepWarning = name => warnings.push(name + ' 返回空结果，已保留原值');
  specs.forEach(s => {
    if(!(s.key in obj) || obj[s.key] == null) return; // 只有“未含 key”不动
    const v = obj[s.key];
    if(s.kind === 'tags'){
      const arr = Array.isArray(v) ? v : String(v).split(/[,，、;；\n]/).map(x=>x.replace(/^[\s\-\*•·]+/,'').trim()).filter(Boolean);
      if(arr.length){ p[s.key] = arr; n++; }
      else keepWarning(fieldLabel(s)); // AI01：空列表不覆盖已有数据
    } else if(s.kind === 'partners' || s.kind === 'table' || s.kind === 'structure'){
      if(Array.isArray(v) && !v.length){ keepWarning(fieldLabel(s)); return; }
      const schema = s.kind === 'partners' ? 'partnerList' : (s.kind === 'structure' ? 'structure' : s.schema);
      const parsed = Work4.parseStructured('```json\n' + JSON.stringify(v) + '\n```', schema);
      if(parsed && parsed.ok && Array.isArray(parsed.value) && parsed.value.length){
        p[s.kind === 'structure' ? 'structure' : s.key] = parsed.value;
        n++;
        if(parsed.warnings && parsed.warnings.length) warnings.push(...parsed.warnings);
      } else {
        const label = s.kind === 'structure' ? '渠道结构' : fieldLabel(s);
        warnings.push(label + ' 解析失败，已保留原值' + (parsed && parsed.reason ? '：' + parsed.reason : ''));
      }
    } else if(s.kind === 'crm'){
      const c = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
      p.crm = p.crm || {};
      let wrote=0;
      ['tool','membership','repurchase','notes'].forEach(k => { if(c[k] !== undefined){ p.crm[k] = String(c[k]||'').trim(); wrote++; } });
      // AI05：空 crm 对象不虚计"已填入"
      if(wrote) n++;
      else keepWarning(fieldLabel(s));
    } else if(s.kind === 'enum'){
      if(s.values.includes(String(v))){ p[s.key] = String(v); n++; }
      else warnings.push((s.name || s.key) + ' 值不在可选范围，已保留原值（' + String(v).slice(0,20) + '）'); // AI05
    } else {
      p[s.key] = String(v).trim();
      n++;
    }
  });
  if(!n && !warnings.length) return {ok:false, n:0, total:specs.length, reason:'对象里没有可用字段'};
  return {ok:true, n, total:specs.length, warnings};
};

// 该步表单是否已有内容（内容检测/健康提示；AI 按钮文案以 _aiGenerated/aiResult 为准）
Work4.stepHasContent = function(pKey){
  const p = state.work4[pKey];
  return (Work4.STEP_FIELD_SPEC[pKey] || []).some(s => {
    const v = p[s.key];
    if(Array.isArray(v)) return v.length > 0;
    if(v && typeof v === 'object') return Object.keys(v).some(k => !!String(v[k]).trim());
    return !!String(v || '').trim();
  });
};

Work4.renderStep = function(id){
  const sec=document.querySelector('#steps4 .step[data-step="'+id+'"]');
  if(!sec) return;
  Work4.syncBodyAttrs();
  Work4.syncFromSbu();          // 2026-08-30：切步时从 work1 拉 SBU
  // RENDER_VERSION guard（契约在 UI.mountGuard，2026-09-01 候选 4）
  if(!UI.mountGuard(sec, Work4, id)) return;
  sec.innerHTML='';
  const idx4 = Work4.steps.findIndex(s=>s.id===id);
  sec.appendChild(el('div',{class:'sub-head'},
    el('span',{class:'num'},'4.'+(idx4+1)),
    el('h3',{}, Work4.titles[id])
  ));
  const subEl4 = Work4.subtitles && Work4.subtitles[id];
  if(subEl4){
    sec.appendChild(el('p',{class:'lede', style:{fontFamily:'var(--font-display)', fontStyle:'normal', fontSize:'1.125rem', lineHeight:1.5, color:'var(--color-ink)', margin:'0 0 28px'}}, subEl4));
  }
  sec.appendChild(el('div',{class:'plate plate--empty'}));
  // Context bar（上游只读）
  const tiers=(typeof Work2!=='undefined'&&Work2.selectedTiers)?Work2.selectedTiers():{tier1:null};
  const vp=state.work3.proposition;
  const wid=state.work3.identity||{};
  const slogan=wid.chosenSlogan||vp.chosenSlogan||'';
  const ctxBar=el('div',{class:'callout'},
    el('span',{class:'callout-title'},'UPSTREAM'),
    el('div',{class:'mono',style:{'font-size':'11px',marginTop:'4px'}},
      `SBU: ${state.work1.sbu.name||'—'}  ·  目标市场: ${tiers.tier1?.name||'—'}  ·  价值主张: ${vp.chosenValueText||'—'}  ·  定位: ${vp.positioningStatement||'—'}  ·  Slogan: ${slogan||'—'}`)
  );
  sec.appendChild(ctxBar);
  UI.mountMvo(sec, Work4, id);

  const fn=Work4.render[id]; if(fn) fn(sec);
  const nxt=UI.stepNextCta(4,id); if(nxt) sec.querySelector('.plate').appendChild(nxt);
  const nw=UI.nextWorkCta(4,id); if(nw) sec.querySelector('.plate').appendChild(nw);
  UI.mountMark(sec, Work4);
};

Work4.mvo = {
  route: () => ({
    checks: [
      {label:'选定了市场范围（出海/国内）', test:()=>!!state.work4.route.scope},
      {label:'判断了微笑曲线位置（OEM/ODM/OBM/EMS）', test:()=>!!state.work4.route.oemType},
      {label:'选定了进入模式', test:()=>!!state.work4.route.entryMode},
    ],
    note:'路径决定控制权——OEM 几乎没有品牌和定价权，OBM 要自己承担渠道和传播。先想清楚再填 4P。'
  }),
  product: () => ({
    checks: [
      {label:'写了产品描述与核心差异点', test:()=>!!(state.work4.product.description||'').trim()&&(state.work4.product.coreDifferentiators||[]).length>0},
      // 修复 2026-08-30：原「列了 SKU/产品线」已无 UI（SKU 表删除），改用「写了技术护城河或物理特征」
      {label:'写了技术护城河或物理特征', test:()=>!!(state.work4.product.technologyMoat||'').trim()||!!(state.work4.product.physicalFeatures||'').trim()},
      {label:'出海时考虑了认证与本地化', test:()=>state.work4.route.scope==='domestic'||!!(state.work4.product.certifications||'').trim()}
    ],
    note:'产品要承接 Work3 的价值主张——如果差异点支撑不了主张，要么改产品要么改主张。'
  }),
  price: () => ({
    checks: [
      {label:'选定了定价策略', test:()=>!!(state.work4.price.strategy||'').trim()},
      {label:'有价格档位/渠道定价', test:()=>(state.work4.price.tiers||[]).length>0||(state.work4.price.channelPricing||[]).length>0},
      {label:'出海时考虑了购买力/汇率', test:()=>state.work4.route.scope==='domestic'||!!(state.work4.price.ppp||state.work4.price.fxSensitivity||'').toString().trim()}
    ],
    note:'价格是唯一产生收入的 P。定价要和定位匹配——高端定位打低价会摧毁价值感。'
  }),
  place: () => ({
    checks: [
      {label:'至少规划了线上或线下一类渠道', test:()=>(state.work4.place.onlineSelf||[]).length+(state.work4.place.onlineThird||[]).length+(state.work4.place.offlineDirect||[]).length+(state.work4.place.offlineDistrib||[]).length>0},
      {label:'列了关键渠道伙伴', test:()=>(state.work4.place.keyPartners||[]).length>0}
    ],
    note:'渠道要去目标客群"已经在"的地方，而不是你"想铺"的地方。先确认客群聚集的渠道。'
  }),
  promotion: () => ({
    checks: [
      {label:'确定了传播主题', test:()=>!!(state.work4.promotion.theme||'').trim()},
      {label:'至少规划了 2 类传播手段（广告/PR/促销/CRM）', test:()=>['advertising','pr','salesPromotion'].filter(k=>(state.work4.promotion[k]||[]).length>0).length>=2},
      {label:'出海时考虑了文化语境与禁忌', test:()=>state.work4.route.scope==='domestic'||!!(state.work4.promotion.taboos||state.work4.promotion.context||'').toString().trim()}
    ],
    note:'促销不是"发个帖"——主题、媒介、KOL、节奏要形成组合，且不能和品牌人格打架。'
  }),
};

// 修复 2026-08-30：产品名/描述/业务类型从 work1.sbu 同步到 work4.product，
// 保持 work1 单真源。Work4.product 字段保留作为 cache（不作为输入源）。
Work4.syncFromSbu = function(){
  if(typeof state === 'undefined' || !state.work1 || !state.work1.sbu) return;
  const sbu = state.work1.sbu;
  const p = state.work4.product;
  p.name = sbu.name || '';
  p.description = sbu.summary || '';
  p.businessType = sbu.businessType || 'physical';
};

// Drive conditional-field visibility in CSS via body attributes.
Work4.syncBodyAttrs = function(){
  const r=state.work4.route||{}, p=state.work4.product||{};
  document.body.dataset.w4Scope=r.scope||'global';
  document.body.dataset.w4Biz=p.businessType||'physical';
  document.body.dataset.w4Oem=r.oemType||'';
  document.body.dataset.w4Entry=r.entryMode||'';
};

Work4.titles={
  route:'出海路径与进入模式',
  product:'产品 / 技术 / 服务',
  price:'定价 / 价格体系',
  place:'销售渠道治理',
  promotion:'传播促销 / 客户关系'
};
Work4.subtitles={
  route:'判断业务在微笑曲线上的位置、用什么模式进入市场、以什么姿态起步。这决定了后面四个 P 你能控制多少。',
  product:'产品是什么、卖给谁、靠什么差异化；海外还要过认证、做本地化。让卖点支撑 Work 3 的价值主张。',
  price:'定价策略、价格档位、渠道差异化与促销节奏；跨文化还要考虑购买力、汇率与数字禁忌。',
  place:'线上线下渠道组合、关键伙伴、本地关系与激励；让渠道覆盖目标客群聚集地。',
  promotion:'传播主题、媒介组合、公关事件、销售促进与 CRM；跨文化要匹配语境、避开禁忌、选对 KOL。'
};
Work4.render = {};
/* ============================================================
   AI 起草段落化渲染（2026-08-29 ADR 0004）
   ============================================================ */

// 上游 context payload 摘要（per-P 通用）
Work4.contextSummary = function(){
  const tiers=(typeof Work2!=='undefined'&&Work2.selectedTiers)?Work2.selectedTiers():{tier1:null};
  const vp=state.work3.proposition||{};
  const wid=state.work3.identity||{};
  const items = [
    ['SBU', state.work1.sbu.name],
    ['市场', tiers.tier1?.name],
    ['价值主张', vp.chosenValueText],
    ['定位', vp.positioningStatement],
    ['Slogan', wid.chosenSlogan||vp.chosenSlogan],
    ['品牌人格', wid.mbti||vp.mbti],
  ];
  return items.map(([k,v])=> `${k}=${v||'—'}`).join(' · ');
};

// 渲染 head row：上下文引用 + 统一一个「AI 起草」主按钮（2026-09-01 ADR 0008）
// opts: { label, short }；prompt 由 Work4.buildStepPrompt(pKey) 统一构建
Work4.aiHeadRow = function(pKey, opts){
  const p = state.work4[pKey];
  p.adoptedSegments = p.adoptedSegments || {};
  const generated = !!p.aiResult || p._aiGenerated===true;
  // 按钮文案状态机（无 emoji）：AI 未生成 → 原文案；AI 已生成 → 「重新生成{内容}」。
  // 手动填写不触发重新生成态，避免把人工数据误当 AI 产物。
  const btnLabel = generated
    ? ('重新生成' + (opts.short || pKey))
    : (opts.label || 'AI 起草');
  const headRow = el('div',{class:'p-head-row', style:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'24px',marginBottom:'18px',flexWrap:'wrap'}});
  // 左：上下文引用折叠
  const summary = Work4.contextSummary();
  const previewItems = summary.split(' · ').slice(0,3).join(' · ');
  const ctxBox = el('details',{class:'ai-context', style:{flex:'1 1 320px',minWidth:0,fontSize:'12px',lineHeight:1.5}});
  const ctxSum = el('summary',{style:{cursor:'pointer',color:'var(--color-ink-2)',fontFamily:'var(--font-mono)',fontSize:'12px',padding:'4px 0'}},
    '▾ 基于：', previewItems, el('span',{style:{marginLeft:'6px',opacity:0.6}},' …')
  );
  ctxBox.appendChild(ctxSum);
  ctxBox.appendChild(el('div',{style:{padding:'8px 0 4px',color:'var(--color-ink-2)',fontFamily:'var(--font-mono)',fontSize:'12px'}},
    summary,
    el('br'),
    el('span',{style:{fontSize:'10px',opacity:0.7}}, '一次生成本步全部字段填入下方表单，可逐项审改。点「重新生成」会直接整体替换上一次 AI 结果。')
  ));
  headRow.appendChild(ctxBox);
  // 右：按钮组（一个主按钮 + 清空叙事正文）
  const btns = el('div',{style:{display:'flex',gap:'8px',flexShrink:0,alignItems:'center',flexWrap:'wrap'}});
  const aiBtn = el('button',{class:'primary'}, btnLabel);
  aiBtn.addEventListener('click', () => Work4.runAiDraft(pKey, opts, aiBtn));
  btns.appendChild(aiBtn);
  if(!!p.aiResult){
    const clearBtn = el('button',{class:'ghost small danger', onclick:async e=>{
      if(await Interaction.confirm({title:'清空叙事正文？',message:'清空 AI 起草的叙事正文？表单内容不受影响。此操作不可撤销。',confirmLabel:'清空正文',trigger:e.currentTarget}) && p===state.work4[pKey] && !Work4.caseLocked()){
        p.aiResult = '';
        p.adoptedSegments = {};
        autosave(); Work4.rerender(pKey);
      }
    }}, '清空正文');
    btns.appendChild(clearBtn);
  }
  headRow.appendChild(btns);
  return headRow;
};

// 触发 AI 起草（per-P，2026-09-01 ADR 0008）：
//   - 已有 AI 结果时直接整体替换（不弹确认）
//   - 一次调用 → applyStepAll 双写：字段 JSON 填表单 + 叙事正文存 aiResult 并自动全部采纳
Work4.runAiDraft = function(pKey, opts, btn){
  if(Work4.caseLocked()){ showToast('案例浏览中，不可用 AI'); return; }
  const p = state.work4[pKey];
  const origLabel = btn.textContent;
  const restoreBtn = ()=>{ btn.disabled = false; btn.textContent = origLabel; };
  let prompt;
  try{
    prompt = Work4.buildStepPrompt(pKey);
  }catch(e){
    showToast('AI 起草失败：' + (e && e.message ? e.message : String(e)));
    return false;
  }
  const container = document.createElement('div');
  btn.disabled = true;
  btn.textContent = '生成中…';
  try{
    API.aiButton({
      button: btn,
      container,
      jsonMode: false,
      label: origLabel,
      buildPrompt: () => [{role:'user', content: prompt}],
      onResult: (r, raw, source) => {
        const text = typeof r === 'string' ? r : (raw || (r && typeof r==='object' ? JSON.stringify(r,null,2) : ''));
        if(!text){
          showToast('AI 未返回内容');
          restoreBtn();
          return;
        }
        // 双写：字段 JSON → 表单；叙事正文（剥掉 JSON 块）→ aiResult + 自动全部采纳
        const applied = Work4.applyStepAll(pKey, text);
        p._aiGenerated = true;
        const narrative = String(text).replace(/```(?:json|JSON)?[\s\S]*?```/g, '').trim();
        p.aiResult = narrative ? Work4._prettifyJsonBlocks(narrative) : '';
        p.adoptedSegments = {};
        if(narrative) Work4.adoptAll(pKey);
        autosave();
        Work4.rerender(pKey);
        restoreBtn();
        if(applied.ok){
          // AI05：字段级警告(归一化/部分失败)不再吞掉
          let msg = '已生成并填入 ' + applied.n + '/' + applied.total + ' 个字段，请逐项审改';
          if(applied.warnings && applied.warnings.length){
            msg += ' ｜ ' + applied.warnings.slice(0,3).join('；') + (applied.warnings.length>3 ? '…' : '');
          }
          showToast(msg);
        } else {
          showToast('未能解析字段：' + applied.reason + '；正文已存入段落区');
        }
      }
    });
  }catch(e){
    showToast('AI 起草失败：' + (e && e.message ? e.message : String(e)));
    restoreBtn();
    return false;
  }
  // 异步路径，aiButton 完成时 Runner.finish 不会主动恢复 button；onResult 会。
  // 兜底：60 秒后强制恢复
  setTimeout(restoreBtn, 60000);
};

// 段落展示区（2026-09-01 ADR 0008）：只读正文——AI 起草后自动全部采纳，
// 段落不再逐段操作；表单是唯一编辑与真相源。历史数据里含 ```fence 的段落
// 不展示原始 JSON，折叠成提示行。
Work4.renderSegments = function(pKey){
  const p = state.work4[pKey];
  if(!p.aiResult) return null;
  const segs = Work4.segResult(p.aiResult);
  const wrap = el('div',{class:'ai-segments', style:{display:'flex',flexDirection:'column',gap:'14px',marginTop:'8px'}});
  const NOTE = '\n（结构化数据已填入上方表单，此处不重复展示）';
  segs.forEach(seg => {
    const card = el('div',{class:'ai-seg-card ai-seg-card--adopted', style:{
      border:'1px solid var(--color-rule)',
      background:'#f0f7f0', padding:'12px 14px', borderLeft:'3px solid #2c6e2c'
    }});
    card.appendChild(el('div',{style:{fontFamily:'var(--font-display)',fontSize:'15px',fontStyle:'normal',marginBottom:'6px',color:'var(--color-ink)'}}, seg.heading));
    const prose = el('div',{class:'ai-seg-prose', style:{fontSize:'14px',lineHeight:1.7,color:'var(--color-ink)'}});
    prose.innerHTML = Work4.renderMarkdown(seg.body.replace(/```(?:json|JSON)?[\s\S]*?```/g, NOTE));
    card.appendChild(prose);
    wrap.appendChild(card);
  });
  return wrap;
};

// 全部采纳（2026-09-01：AI 起草后自动调用——段落区只读展示，无需手动逐段采纳）
Work4.adoptAll = function(pKey){
  if(Work4.caseLocked()) return;
  const p = state.work4[pKey];
  p.adoptedSegments = p.adoptedSegments || {};
  const segs = Work4.segResult(p.aiResult);
  segs.forEach(s => {
    if(!p.adoptedSegments[s.segId]){
      p.adoptedSegments[s.segId] = {at: Date.now(), source: 'bulk', targetField: null};
    }
  });
  autosave();
};

// 2026-09-01：极简 markdown 渲染（段落区只读成稿视图用）。先转义防注入，再支持
// **粗体**、`代码`、无序/有序列表、Markdown 表格、段落。段标题已在拆段时剥离，这里不处理 #。
// 表格分支：与 JsonExtract.parseMarkdownTable 同容错（全角竖线/零宽字符归一化，
// 要求「表头 + 分隔行」，无分隔行的竖线行仍按普通段落渲染），复用全局 .data 表格样式。
Work4.renderMarkdown = function(text){
  const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inline = s => escHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const P = 'style="margin:6px 0"', LI = 'style="margin:3px 0"';
  const lines = String(text || '')
    .replace(/｜/g, '|')
    .replace(/[​‌‍⁠﻿]/g, '')
    .split(/\r?\n/);
  const DASH_CELL = /^:?[-–—―_=]+:?$/;
  const splitCells = l => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
  const isSep = l => { if(l.indexOf('|') === -1) return false; const cs = splitCells(l); return cs.length >= 2 && cs.every(c => DASH_CELL.test(c)); };
  let html = '', listType = null;
  const closeList = () => { if(listType){ html += '</ul>'; listType = null; } };
  for(let i = 0; i < lines.length; i++){
    const line = lines[i];
    const bul = line.match(/^\s*[-*]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.、]\s+(.*)$/);
    if(!bul && !num && line.trim() && line.indexOf('|') !== -1 && isSep(lines[i+1] || '')){
      closeList();
      const header = splitCells(line);
      let j = i + 2;
      const rows = [];
      while(j < lines.length && lines[j].trim() && lines[j].indexOf('|') !== -1 && !isSep(lines[j])){ rows.push(splitCells(lines[j])); j++; }
      html += '<div class="table-wrap"><table class="data"><thead><tr>'
        + header.map(h => `<th>${inline(h)}</th>`).join('')
        + '</tr></thead><tbody>';
      rows.forEach(r => {
        html += '<tr>' + header.map((h, c) => `<td>${inline(r[c] || '')}</td>`).join('') + '</tr>';
      });
      html += '</tbody></table></div>';
      i = j - 1;
      continue;
    }
    if(bul || num){
      if(listType !== 'ul'){ closeList(); html += `<ul style="margin:6px 0;padding-left:22px">`; listType = 'ul'; }
      html += `<li ${LI}>` + inline((bul || num)[1]) + '</li>';
    } else if(!line.trim()){
      closeList();
    } else {
      closeList();
      html += `<p ${P}>` + inline(line) + '</p>';
    }
  }
  closeList();
  return html;
};

/* ---------- ROUTE ---------- */
Work4.render.route = function(sec){
  const plate = sec.querySelector('.plate');
  const r=state.work4.route;

  // 0. Market scope
  plate.appendChild(el('h4',{},'市场范围'));
  const scopeRow=el('div',{class:'grid2'});
  [['global','出海 / 跨国经营'],['domestic','本阶段聚焦国内市场']].forEach(([v,label])=>{
    scopeRow.appendChild(el('div',{class:'card'+(r.scope===v?' selected':'')},
      el('label',{style:{display:'flex',gap:'8px','align-items':'center','font-family':'var(--font-display)','font-style':'normal','font-size':'16px','text-transform':'none','letter-spacing':0,'color':'var(--color-ink)'}},
        el('input',{type:'radio',name:'w4scope',checked:r.scope===v,onchange:()=>{r.scope=v;autosave();Work4.syncBodyAttrs();Work4.rerender('route')}}), label)));
  });
  plate.appendChild(scopeRow);

  if(r.scope==='domestic'){
    plate.appendChild(el('div',{class:'callout'},
      el('span',{class:'callout-title'},'国内模式'),
      el('p',{class:'muted',style:{'font-size':'13px',margin:'4px 0 0'}},'聚焦单一国内市场时，跨文化调适字段已隐藏。后面的 4P 作为常规营销组合填写即可；如业务转向出海，回到本页切换即可恢复全部字段。')));
    plate.appendChild(el('h4',{},'业务在微笑曲线上的位置'));
    Work4.oemCards(sec, r);
    return;
  }

  // Global scope full flow
  plate.appendChild(el('h4',{},'业务在微笑曲线上的位置'));
  Work4.oemCards(sec, r);

  plate.appendChild(el('h4',{},'进入模式'));
  const entryRow=el('div',{class:'grid3'});
  [['export','直接出口（最低控制）','用贸易商/经销商卖货给海外客户，最快但无终端控制'],
   ['licensing','授权许可','把品牌/技术/配方授权给当地伙伴，收特许费'],
   ['franchise','特许加盟','标准化门店模式开放加盟，收取加盟费+持续分成'],
   ['contract-mfg','合同制造','委托当地工厂代工，零重资产但有品控风险'],
   ['jv','合资','与当地伙伴股权合作，分担投入与风险'],
   ['acquisition','并购','买下当地公司（品牌/渠道/团队），最快获得市场地位'],
   ['greenfield','绿地自建','从零建团队/工厂/品牌，最重但完全控制']]
    .forEach(([v,label,desc])=>{
      entryRow.appendChild(el('div',{class:'card'+(r.entryMode===v?' selected':'')},
        el('label',{style:{display:'flex',gap:'8px','align-items':'center','font-family':'var(--font-display)','font-style':'normal','font-size':'16px','text-transform':'none','letter-spacing':0,'color':'var(--color-ink)'}},
          el('input',{type:'radio',name:'w4entry',checked:r.entryMode===v,onchange:()=>{r.entryMode=v;autosave();Work4.syncBodyAttrs();Work4.rerender('route')}}), label),
        el('p',{class:'muted',style:{'font-size':'12px',margin:'6px 0 0'}},desc)));
    });
  plate.appendChild(entryRow);

  plate.appendChild(el('h4',{},'出海姿态（可多选）'));
  const lightRow=el('div',{class:'grid3'});
  [['single-point','单点突破','集中资源打一个市场/品类/客群'],
   ['borrow-boat','借船出海','搭便车：跨境平台/已有合作伙伴'],
   ['philosophy','长期主义','品牌+渠道+本地化全栈投入，接受长期 ROI']]
    .forEach(([v,label,desc])=>{
      const on=Array.isArray(r.light)&&r.light.includes(v);
      lightRow.appendChild(el('div',{class:'card'+(on?' selected':'')},
        el('label',{style:{display:'flex',gap:'8px','align-items':'center','font-family':'var(--font-display)','font-style':'normal','font-size':'16px','text-transform':'none','letter-spacing':0,'color':'var(--color-ink)'}},
          el('input',{type:'checkbox',checked:on,onchange:e=>{
            r.light=Array.isArray(r.light)?r.light:[];
            if(e.target.checked){ if(!r.light.includes(v)) r.light.push(v); }
            else{ r.light=r.light.filter(x=>x!==v); }
            autosave(); Work4.rerender('route');
          }}), label),
        el('p',{class:'muted',style:{'font-size':'12px',margin:'6px 0 0'}},desc)));
    });
  plate.appendChild(lightRow);

  if(['jv','acquisition','greenfield'].includes(r.entryMode)){
    plate.appendChild(el('h4',{},'政企关系'));
    plate.appendChild(el('p',{class:'muted',style:{'font-size':'12px',margin:'0 0 6px'}},
      '合资/并购/绿地直接面对当地监管与政策环境。记录政府关系、准入许可、合规要点。'));
    plate.appendChild(UI.field('政企关系 / 合规要点',
      el('textarea',{rows:3,oninput:e=>{r.politicalPower=e.target.value;autosave()}},r.politicalPower||'')));
  }
};

Work4.oemCards = function(sec, r){
  const plate = (sec && sec.querySelector) ? sec.querySelector('.plate') : sec;
  const types=[
    ['OEM','代工生产','按委托方规格制造，无自有品牌；微笑曲线底部'],
    ['ODM','设计+制造','有设计能力，但产品贴委托方品牌'],
    ['OBM','自有品牌','从研发到品牌营销全链条，品牌资产归自己'],
    ['EMS','代工服务','电子/精密制造服务（富士康式），规模与供应链为核心能力']
  ];
  const row=el('div',{class:'grid2'});
  types.forEach(([v,label,desc])=>{
    row.appendChild(el('div',{class:'card'+(r.oemType===v?' selected':'')},
      el('label',{style:{display:'flex',gap:'8px','align-items':'center','font-family':'var(--font-display)','font-style':'normal','font-size':'16px','text-transform':'none','letter-spacing':0,'color':'var(--color-ink)'}},
        el('input',{type:'radio',name:'w4oem',checked:r.oemType===v,onchange:()=>{r.oemType=v;autosave();Work4.syncBodyAttrs();Work4.rerender('route')}}), label),
      el('p',{class:'muted',style:{'font-size':'12px',margin:'6px 0 0'}},desc)
    ));
  });
  plate.appendChild(row);
};

/* ---------- PRODUCT ---------- */
Work4.render.product = function(sec){
  const plate = sec.querySelector('.plate');
  const p=state.work4.product;
  p.adoptedSegments = p.adoptedSegments || {};

  // 0. 顶部 head row：上下文引用 + AI 起草按钮
  plate.appendChild(Work4.aiHeadRow('product', {
    short: '产品卖点',
    label: 'AI 起草产品卖点'
  }));

  // 1. 段落展示区（只读叙事正文）
  const segsWrap = Work4.renderSegments('product');
  if(segsWrap) plate.appendChild(segsWrap);

  // 2. 表单：SBU 预览 + 核心差异化 + 物理特征/服务承诺/技术护城河 + 跨文化 3 块（2026-08-30：SKU 表已删）
  // 修复 2026-08-30：产品名/描述/业务类型原 work4 独有，重复 work1 SBU 步
  // 字段。统一从 work1.sbu 单真源读取，work4 只读展示 + 「去 Work 1 改」链接。
  const sbu = (typeof state !== 'undefined' && state.work1 && state.work1.sbu) || {};
  const bizLabel = {physical:'实体产品', service:'服务', hybrid:'产品+服务'}[sbu.businessType||'physical'];
  // 只读预览块
  const previewBox = el('div', {class:'callout', style:'margin:0 0 14px;display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap'},
    el('div', {style:'flex:1;min-width:240px'},
      el('div', {style:'font-family:var(--font-mono);font-size:11px;color:var(--color-ink-2);margin-bottom:4px'}, '来自 Work 1 · SBU 步（只读）'),
      el('div', {style:'font-family:var(--font-display);font-style:normal;font-size:18px;margin-bottom:4px'}, sbu.name || '— 尚未在 Work 1 填写 SBU 名称'),
      el('div', {style:'color:var(--color-ink-2);font-size:13px;line-height:1.5;white-space:pre-wrap'}, sbu.summary || '— 尚未在 Work 1 填写业务概述'),
      el('div', {style:'margin-top:8px;font-size:12px;color:var(--color-ink-2)'},
        el('span', {style:'font-family:var(--font-mono)'}, '业务类型：'),
        el('strong', {style:'color:var(--color-ink)'}, bizLabel)
      )
    ),
    el('button', {class:'ghost small', onclick:()=>{
      // goStep 只在当前工作坊内切步：先 goWork(1)（会落到首步），再切到 sbu
      App.goWork(1);
      App.goStep('sbu');
    }}, '在 Work 1 修改 →')
  );
  plate.appendChild(previewBox);

  // 核心差异化
  plate.appendChild(el('h4',{},'核心差异化'));
  const diff=UI.tagsInput(()=>p.coreDifferentiators||[], '输入后回车添加', next=>{p.coreDifferentiators=next;autosave();});
  diff.el.querySelector('input').addEventListener('blur',()=>{p.coreDifferentiators=diff.get();autosave()});
  plate.appendChild(diff.el);
  plate.appendChild(UI.field('物理特征 / 技术规格', el('textarea',{rows:3,oninput:e=>{p.physicalFeatures=e.target.value;autosave()}},p.physicalFeatures)));
  plate.appendChild(UI.field('服务承诺（售后、保修、安装、培训）', el('textarea',{rows:2,oninput:e=>{p.serviceOffering=e.target.value;autosave()}},p.serviceOffering)));
  plate.appendChild(UI.field('技术护城河（专利、独有工艺、供应链）', el('textarea',{rows:2,oninput:e=>{p.technologyMoat=e.target.value;autosave()}},p.technologyMoat)));

  // 跨文化产品调适
  const xc=el('div',{class:'x-culture'});
  xc.appendChild(el('h4',{},'跨文化产品调适'));
  // 修复 2026-08-30：跨文化产品调适 3 块全部常驻国内可见（原 .x-culture 仅出海才显）
  xc.appendChild(UI.field('市场准入认证（CE/FCC/FDA/CCC/halal 等）', el('textarea',{rows:2,oninput:e=>{p.certifications=e.target.value;autosave()}},p.certifications||'')));
  xc.appendChild(UI.field('本地化适配（功能、审美/颜色、包装规格）', el('textarea',{rows:3,oninput:e=>{p.localization=e.target.value;autosave()}},p.localization||'')));
  xc.appendChild(UI.field('服务本地化（售后网络、本地语言、安装培训）', el('textarea',{rows:2,oninput:e=>{p.serviceLocalization=e.target.value;autosave()}},p.serviceLocalization||'')));
  plate.appendChild(xc);

  // 服务业扩展
  const xs=el('div',{class:'x-service'});
  xs.appendChild(el('h4',{},'服务业扩展（7P）'));
  xs.appendChild(UI.field('People 人员（前台、客服、技师的形象与能力）', el('textarea',{rows:2,oninput:e=>{p.people=e.target.value;autosave()}},p.people||'')));
  xs.appendChild(UI.field('Process 服务流程（交付步骤、响应时效）', el('textarea',{rows:2,oninput:e=>{p.process=e.target.value;autosave()}},p.process||'')));
  xs.appendChild(UI.field('Physical Evidence 有形展示（门店、物料、界面、评价）', el('textarea',{rows:2,oninput:e=>{p.physicalEvidence=e.target.value;autosave()}},p.physicalEvidence||'')));
  plate.appendChild(xs);
};

/* ---------- PRICE ---------- */
Work4.render.price = function(sec){
  const plate = sec.querySelector('.plate');
  const p=state.work4.price;
  p.adoptedSegments = p.adoptedSegments || {};

  // 0. 顶部 head row
  plate.appendChild(Work4.aiHeadRow('price', {
    short: '定价建议',
    label: 'AI 起草定价建议'
  }));

  // 1. 段落化结果
  const segsWrap = Work4.renderSegments('price');
  if(segsWrap) plate.appendChild(segsWrap);

  // 2. 定价策略
  plate.appendChild(el('h4',{},'定价策略'));
  const strategies=[
    ['cost-plus','成本加成','在成本基础上增加固定比例；适合成熟品类、价格敏感客户。'],
    ['value','价值定价','基于客户感知价值；适合差异化强、情感价值高的品牌。'],
    ['competitive','竞争定价','紧贴主要竞品；适合同质化高、竞争激烈的市场。'],
    ['penetration','渗透定价','低价快速抢占份额；适合网络效应强的品类。'],
    ['skimming','撇脂定价','高价收割早期用户；适合创新强、稀缺供给。']
  ];
  const row=el('div',{class:'grid3'});
  strategies.forEach(([v,label,desc])=>{
    const card=el('div',{class:'card'+(p.strategy===v?' selected':'')},
      el('label',{style:{display:'flex',gap:'8px','align-items':'center','font-family':'var(--font-display)','font-style':'normal','font-size':'16px','text-transform':'none','letter-spacing':0,'color':'var(--color-ink)'}},
        el('input',{type:'radio',name:'prStrat',checked:p.strategy===v,onchange:()=>{p.strategy=v;autosave();Work4.rerender('price')}}), label),
      el('p',{class:'muted',style:{'font-size':'12px'}},desc)
    );
    row.appendChild(card);
  });
  plate.appendChild(row);
  plate.appendChild(UI.field('选择理由', el('textarea',{rows:2,oninput:e=>{p.strategyNote=e.target.value;autosave()}},Work4._prettifyJsonBlocks(p.strategyNote))));

  // 价格档位（2026-09-01：AI 起草统一走步首按钮，表格为就地审改区）
  plate.appendChild(el('h4',{},'价格档位'));
  Work4.simpleTable(sec, p.tiers, [
    {key:'name',label:'档位名',type:'text'},
    {key:'targetSegment',label:'目标客群',type:'text'},
    {key:'price',label:'价格',type:'number'},
    {key:'unit',label:'单位/币种',type:'text'},
    {key:'hero',label:'主力款',type:'check'},
    {key:'notes',label:'备注',type:'text'}
  ], 'tiers');

  plate.appendChild(el('h4',{},'渠道差异化定价'));
  Work4.simpleTable(sec, p.channelPricing, [
    {key:'channel',label:'渠道',type:'text'},
    {key:'priceAdjustment',label:'价格调整',type:'text'},
    {key:'rationale',label:'理由',type:'text'}
  ], 'channelPricing');

  plate.appendChild(el('h4',{},'促销节奏'));
  Work4.simpleTable(sec, p.promotions, [
    {key:'occasion',label:'节点',type:'text'},
    {key:'discount',label:'折扣/机制',type:'text'},
    {key:'period',label:'时段',type:'text'}
  ], 'promotions');

  // 修复 2026-08-30：竞品价格从 work1 environment.competitors 预填（用户可覆盖）
  // 仅在首次进入且字段为空时预填 + 显示一次告知；用户编辑后不再覆盖
  if(!p.competitorPrices){
    const comps = (state.work1.environment && state.work1.environment.competitors) || [];
    if(comps.length){
      const lines = comps.slice(0,7).map(c => `- ${c.name||'匿名'}：${c.price||'（未填）'} ${c.position?'（'+c.position+'）':''}`.trim());
      p.competitorPrices = '【自动从 Work 1 竞品表预填，可编辑覆盖】\n' + lines.join('\n');
    }
  }
  plate.appendChild(UI.field('竞品价格信息（粘贴）',
    el('textarea',{rows:4,placeholder:'目标竞品的价格 / 定价档位 / 促销价（自动从 Work 1 预填）',oninput:e=>{p.competitorPrices=e.target.value;autosave()}},p.competitorPrices||'')));

  // 跨文化定价 3 块（修复 2026-08-30：每块加 AI 起草按钮 + 从 work2 tier1 预填）
  const xc=el('div',{class:'x-culture'});
  xc.appendChild(el('h4',{},'跨文化定价'));
  // 从 work2 tier1 预填（首次进入且字段为空时）
  const w2tiers = (typeof Work2!=='undefined'&&Work2.selectedTiers)?Work2.selectedTiers():{tier1:null};
  const w2t1 = w2tiers.tier1;
  // PPP 校准
  if(!p.ppp && w2t1){
    p.ppp = `【自动从 Work 2 · ${w2t1.name} 预填】\n请结合该市场可支配收入（PPP/IMF 数据）、与母国市场的价差建议 1-2 句话谈。可点步首「AI 起草」生成。`;
  }
  xc.appendChild(UI.field('购买力 / PPP 校准',
    el('textarea',{rows:2,placeholder:'目标市场可支配收入、价格敏感度、与母国市场的价差',oninput:e=>{p.ppp=e.target.value;autosave()}},p.ppp||'')));
  // 数字与尾数
  if(!p.pricingNumbers && w2t1){
    p.pricingNumbers = `【自动从 Work 2 · ${w2t1.name} 预填】\n请结合该市场的吉庆数字、.99/.95 习惯、是否含税、增值税惯例填 1-2 句话。可点步首「AI 起草」生成。`;
  }
  xc.appendChild(UI.field('数字 / 尾数 / 税（吉庆数字、.99 习惯、关税增值税）',
    el('textarea',{rows:2,oninput:e=>{p.pricingNumbers=e.target.value;autosave()}},p.pricingNumbers||'')));
  // 汇率敏感度
  if(!p.fxSensitivity && w2t1){
    p.fxSensitivity = `【自动从 Work 2 · ${w2t1.name} 预填】\n请结合该市场本币稳定性、汇损风险、对冲策略填 1-2 句话。可点步首「AI 起草」生成。`;
  }
  xc.appendChild(UI.field('汇率敏感度 / 本币结算',
    el('textarea',{rows:2,oninput:e=>{p.fxSensitivity=e.target.value;autosave()}},p.fxSensitivity||'')));
  plate.appendChild(xc);

  // 价格档位图
  if(p.tiers && p.tiers.length){
    plate.appendChild(el('h4',{},'价格档位图'));
    const chartPlate=el('section',{class:'plate chart-slot', 'data-chart':'price-tiers'},
      el('span',{class:'plate-label'},'F5 · TICK ROWS · 价格档位'),
      el('div',{'data-chart-host':''})
    );
    Work4.renderPriceTiers(chartPlate.querySelector('[data-chart-host]'), p);
    plate.appendChild(chartPlate);
  }
};

/* ---------- PLACE ---------- */
// place 字段规格（渲染与 AI 起草共用）+ 渠道结构；渲染循环仍按 PLACE_FIELD_AI 逐字段画，
// AI 起草统一走步首按钮（STEP_FIELD_SPEC.place → buildStepPrompt / applyStepAll）。
Work4.PLACE_FIELD_AI = [
  { label:'自营（官网、独立站、App、小程序等）', key:'onlineSelf', kind:'tags', group:'online', name:'自营渠道',
    guide:'建议的自营渠道（官网、独立站、App、小程序等），逐项列出，key 值为字符串数组' },
  { label:'第三方平台（Amazon、TikTok Shop、Shopee、Lazada 等）', key:'onlineThird', kind:'tags', group:'online', name:'第三方平台',
    guide:'建议入驻的第三方平台（Amazon、TikTok Shop、Shopee、Lazada 等），逐项列出，key 值为字符串数组' },
  { label:'线上备注', key:'onlineNotes', kind:'text', group:'online', rows:2, name:'线上备注',
    guide:'1-2 句话补充线上渠道要点（各平台角色分工、运营主体、与线下的关系），key 值为字符串' },
  { label:'直营门店 / 专柜', key:'offlineDirect', kind:'tags', group:'offline', name:'直营渠道',
    guide:'建议的直营渠道（直营门店、专柜、店中店等），逐项列出，key 值为字符串数组' },
  { label:'经销商 / 代理商', key:'offlineDistrib', kind:'tags', group:'offline', name:'经销商',
    guide:'建议的经销商/代理商类型（区域代理、行业代理、批发商等），逐项列出，key 值为字符串数组' },
  { label:'超市 / KA / 零售', key:'offlineRetail', kind:'tags', group:'offline', name:'KA 零售',
    guide:'建议的商超零售渠道（连锁商超、便利店、KA 卖场等），逐项列出，key 值为字符串数组' },
  { label:'线下备注', key:'offlineNotes', kind:'text', group:'offline', rows:2, name:'线下备注',
    guide:'1-2 句话补充线下渠道要点（业态组合、覆盖区域、与线上的协作），key 值为字符串' },
  { label:'关键合作伙伴', key:'keyPartners', kind:'partners', name:'关键合作伙伴',
    guide:'值得优先合作的关键伙伴对象数组 [{name, side}]，name 为伙伴名，side 只填 线上 或 线下，判断不了就省略 side' },
  { label:'渠道激励机制', key:'channelIncentives', kind:'text', rows:3, name:'渠道激励机制',
    guide:'1-3 句话给出按渠道差异化的激励建议（返点、账期、进场费、支持政策），key 值为字符串' },
  { label:'本地渠道关系', key:'localChannelRelations', kind:'text', rows:3, name:'本地渠道关系', xc:true,
    placeholder:'本地经销商/代理合作模式、账期、返点与关系维护',
    guide:'2-3 句话给出本地经销商/代理合作模式、账期、返点与关系维护要点，key 值为字符串' }
];
// 步级规格补挂（place = 渲染清单 + 渠道结构；2026-09-01 ADR 0008）
Work4.STEP_FIELD_SPEC = Work4.STEP_FIELD_SPEC || {};
Work4.STEP_FIELD_SPEC.place = Work4.PLACE_FIELD_AI.concat([
  { key:'structure', kind:'structure', name:'渠道结构', guide:'渠道结构对象数组，一级固定为“线上”“线下”两组且线上在前（一级 share 总和 100）：[{"name":"线上","children":[{"name":"自营","share":40}]},{"name":"线下","children":[{"name":"经销商","share":60}]}]' }
]);

Work4.render.place = function(sec){
  const plate = sec.querySelector('.plate');
  const p=state.work4.place;
  p.adoptedSegments = p.adoptedSegments || {};

  // 0. 顶部 head row（统一 AI 起草按钮）
  plate.appendChild(Work4.aiHeadRow('place', {
    short: '渠道策略',
    label: 'AI 起草渠道策略'
  }));

  // 1. 段落展示区（只读叙事正文）
  const segsWrap = Work4.renderSegments('place');
  if(segsWrap) plate.appendChild(segsWrap);

  // 2. 渠道清单（渲染循环不变：规格驱动逐字段画，AI 起草统一走步首按钮）
  const renderPlaceField = (spec) => {
    const content = spec.kind === 'partners'
      ? Work4.partnerBox(()=>p[spec.key], v => { p[spec.key] = v; autosave(); })
      : (spec.kind === 'tags'
        ? Work4.tagBox(()=>p[spec.key], v => { p[spec.key] = v; autosave(); })
        : el('textarea', {rows: spec.rows || 2, placeholder: spec.placeholder || '', oninput: e => { p[spec.key] = e.target.value; autosave(); }}, p[spec.key] || ''));
    return UI.field(spec.label, content);
  };
  let curGroup = '';
  const xc = el('div', {class:'x-culture'});
  let hasXcH4 = false;
  Work4.PLACE_FIELD_AI.forEach(spec => {
    if(spec.xc){
      // 2026-09-06：xc 字段不再单加 <h4>「本地渠道关系」——
      // renderPlaceField 已经把 spec.label 作为 field label 渲染，
      // 再叠一个手写 h4 会和 LLM 输出的 ## 本地渠道关系 段头撞成"两个同名小标题"。
      // xc 容器保留（继承跨文化样式），xc<h4> 占位去掉。
      xc.appendChild(renderPlaceField(spec));
      return;
    }
    if(spec.group && spec.group !== curGroup){
      curGroup = spec.group;
      plate.appendChild(el('h4',{},curGroup === 'online' ? '线上渠道' : '线下渠道'));
    }
    plate.appendChild(renderPlaceField(spec));
  });
  plate.appendChild(xc);

  // 渠道结构
  plate.appendChild(el('h4',{},'渠道结构（销售占比）'));
  // 首次进入且 structure 为空时，填入种子 + 显示告知（不再静默）
  const isFirstTimeSeed = !p.structure.length && !p._seedNoticeShown;
  if(!p.structure.length){
    p.structure=[
      {name:'线上', children:[{name:'自营',share:20},{name:'第三方平台',share:80}]},
      {name:'线下', children:[{name:'直营',share:30},{name:'经销商',share:50},{name:'KA',share:20}]}
    ];
    p._seedNoticeShown = true;
    autosave();
  }
  if(isFirstTimeSeed){
    plate.appendChild(el('div',{class:'callout', style:{background:'#fff8e1',borderLeft:'3px solid #d4a017',padding:'10px 14px',margin:'6px 0 12px',fontSize:'13px'}},
      el('strong',{},'已为你填入示例渠道结构'),
      el('span',{style:{color:'var(--color-ink-2)'}}, ' — 这只是起点，请按实际修改或点上方 AI 起草重抽。')
    ));
  }
  // 渠道结构表（带行内编辑，触发 chart 局部重画）
  const table=el('div',{class:'table-wrap'});
  const t=el('table',{class:'data'});
  t.innerHTML='<thead><tr><th>一级渠道</th><th>二级渠道</th><th style="width:100px">占比 %</th><th></th></tr></thead>';
  const tb=el('tbody');
  p.structure.forEach((grp,gi)=>{
    grp.children.forEach((ch,ci)=>{
      const tr=el('tr');
      if(ci===0) tr.appendChild(el('td',{rowspan:grp.children.length,style:{'font-style':'normal','vertical-align':'top'}},
        el('input',{value:grp.name,oninput:e=>{grp.name=e.target.value;autosave();Work4.refreshCharts('place')}})));
      tr.appendChild(el('td',{},el('input',{value:ch.name,oninput:e=>{ch.name=e.target.value;autosave();Work4.refreshCharts('place')}})));
      tr.appendChild(el('td',{},el('input',{type:'number',min:0,max:100,value:ch.share,oninput:e=>{ch.share=parseInt(e.target.value)||0;autosave();Work4.refreshCharts('place')}})));
      const getChildren=()=>{
        const groups=state.work4.place.structure||[];
        const current=groups.find(g=>g===grp || (grp.id && g.id===grp.id)) || groups[gi];
        return current?.children||[];
      };
      tr.appendChild(el('td',{},el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Interaction.removeItem({
        list:getChildren,index:ci,type:'二级渠道',name:()=>Interaction.objectName('二级渠道',ch.name,ci,getChildren,c=>c.name),trigger:e.currentTarget,
        onChange:()=>{autosave();Work4.rerender('place');}
      })},'二级渠道',()=>ch.name,ci,getChildren,c=>c.name),'×')));
      tb.appendChild(tr);
    });
  });
  t.appendChild(tb); table.appendChild(t); plate.appendChild(table);
  plate.appendChild(el('div',{class:'row'},
    el('button',{class:'small',onclick:()=>{p.structure[0].children.push({name:'',share:0});autosave();Work4.rerender('place')}},'+ 线上二级'),
    el('button',{class:'small',onclick:()=>{p.structure[1].children.push({name:'',share:0});autosave();Work4.rerender('place')}},'+ 线下二级')
  ));

  // 合计 ≠100 只提示不阻断（01 号票 (e) / 03 号票 (e)）
  const mismatchHost=el('div',{'data-channel-mismatch':''});
  Work4.renderStructureMismatches(mismatchHost, p.structure);
  plate.appendChild(mismatchHost);

  // 渠道图（chart-slot 由 refreshCharts 识别）
  if(p.structure && p.structure.length){
    plate.appendChild(el('h4',{},'渠道占比图'));
    const chartPlate=el('section',{class:'plate chart-slot', 'data-chart':'place-channel'},
      el('span',{class:'plate-label'},'G7 · TREE LR / F13 · NESTED TREEMAP'),
      el('div',{'data-chart-host':''})
    );
    Work4.renderPlaceChannel(chartPlate.querySelector('[data-chart-host]'), p);
    plate.appendChild(chartPlate);
  }
};

/* ---------- PROMOTION ---------- */
Work4.render.promotion = function(sec){
  const plate = sec.querySelector('.plate');
  const p=state.work4.promotion;
  const r=state.work4.route;
  p.adoptedSegments = p.adoptedSegments || {};

  if(r.oemType && r.oemType!=='OBM'){
    plate.appendChild(el('div',{class:'warning',style:{'font-size':'13px'}},
      el('strong',{},r.oemType+' 模式提示：'),
      el('span',{},' 此模式下面向 C 端的品牌广告/PR 主要由委托方负责。下表内容可用于企业级 B2B 传播（能力、认证、供应链），消费者品牌资产不会沉淀到本企业。')));
  }

  // 0. 顶部 head row（统一 AI 起草按钮）
  plate.appendChild(Work4.aiHeadRow('promotion', {
    short: '传播方案',
    label: 'AI 起草传播方案'
  }));

  // 1. 段落展示区（只读叙事正文）
  const segsWrap = Work4.renderSegments('promotion');
  if(segsWrap) plate.appendChild(segsWrap);

  // 2. 表单
  plate.appendChild(UI.field('传播主题（一句话）', el('input',{value:p.theme,oninput:e=>{p.theme=e.target.value;autosave()}})));

  plate.appendChild(el('h4',{},'广告 / 媒介投放'));
  Work4.simpleTable(sec, p.advertising, [
    {key:'media',label:'媒介',type:'text'},
    {key:'budgetShare',label:'预算占比%',type:'number'},
    {key:'message',label:'核心信息',type:'text'},
    {key:'kpi',label:'KPI',type:'text'}
  ], 'advertising');

  // 媒介预算图
  if(p.advertising && p.advertising.length && p.advertising.some(a=>a.budgetShare)){
    plate.appendChild(el('h4',{},'媒介预算'));
    const chartPlate=el('section',{class:'plate chart-slot', 'data-chart':'promo-budget'},
      el('span',{class:'plate-label'},'L14 · HUNDRED FIELD · 媒介预算'),
      el('div',{'data-chart-host':''})
    );
    Work4.renderHundredBudget(chartPlate.querySelector('[data-chart-host]'), p);
    plate.appendChild(chartPlate);
  }

  plate.appendChild(el('h4',{},'公关事件'));
  Work4.simpleTable(sec, p.pr, [
    {key:'event',label:'事件',type:'text'},
    {key:'timing',label:'时机',type:'text'},
    {key:'expectedReach',label:'预期触达',type:'text'}
  ], 'pr');

  plate.appendChild(el('h4',{},'销售促进'));
  Work4.simpleTable(sec, p.salesPromotion, [
    {key:'tactic',label:'手段',type:'text'},
    {key:'mechanic',label:'机制',type:'text'},
    {key:'period',label:'时段',type:'text'}
  ], 'salesPromotion');

  plate.appendChild(el('h4',{},'CRM 与复购'));
  plate.appendChild(el('div',{class:'grid2'},
    UI.field('CRM 工具', el('input',{value:p.crm.tool,oninput:e=>{p.crm.tool=e.target.value;autosave()}})),
    UI.field('会员体系', el('input',{value:p.crm.membership,oninput:e=>{p.crm.membership=e.target.value;autosave()}}))
  ));
  plate.appendChild(UI.field('复购激励', el('input',{value:p.crm.repurchase,oninput:e=>{p.crm.repurchase=e.target.value;autosave()}})));
  plate.appendChild(UI.field('CRM 备注', el('textarea',{rows:2,oninput:e=>{p.crm.notes=e.target.value;autosave()}},p.crm.notes)));
  plate.appendChild(UI.field('内容策略（KOL/KOC、UGC、品牌叙事节奏）', el('textarea',{rows:3,oninput:e=>{p.contentStrategy=e.target.value;autosave()}},p.contentStrategy)));

  const xc=el('div',{class:'x-culture'});
  xc.appendChild(el('h4',{},'跨文化传播'));
  xc.appendChild(UI.field('高/低语境（高语境重隐喻关系画面，低语境重直白事实）', el('textarea',{rows:2,oninput:e=>{p.context=e.target.value;autosave()}},p.context||'')));
  xc.appendChild(UI.field('禁忌与本地节日（宗教、颜色、符号、性别表达、营销节点）', el('textarea',{rows:2,oninput:e=>{p.taboos=e.target.value;autosave()}},p.taboos||'')));
  xc.appendChild(UI.field('KOL/KOC 分层（头部/腰部/素人及平台选择）', el('textarea',{rows:2,oninput:e=>{p.kolTiers=e.target.value;autosave()}},p.kolTiers||'')));
  xc.appendChild(UI.field('语言/翻译/本地代言', el('textarea',{rows:2,oninput:e=>{p.language=e.target.value;autosave()}},p.language||'')));
  plate.appendChild(xc);
};

/* ============================================================
   通用 helpers
   ============================================================ */

// 摘要文本：字段优先（表单是唯一真相源——2026-09-01 ADR 0008；
// 用户在表单里的修改直接反映到导出 / Work5）
Work4.summaryText = function(key){
  if(key==='route'){
    const r=state.work4.route;
    const out=[];
    if(r.scope) out.push(`市场范围：${r.scope==='global'?'出海/跨国':'国内市场'}`);
    if(r.oemType) out.push(`微笑曲线位置：${r.oemType}`);
    if(r.entryMode) out.push(`进入模式：${r.entryMode}`);
    if(Array.isArray(r.light)&&r.light.length) out.push(`出海姿态：${r.light.join('、')}`);
    if(r.politicalPower) out.push(`政企关系：${r.politicalPower}`);
    return out.join('\n');
  }
  const p=state.work4[key];
  if(!p) return '';
  if(key==='product') return [
    p.name?`产品名：${p.name}`:'',
    p.description?`描述：${p.description}`:'',
    p.coreDifferentiators.length?`核心差异化：${p.coreDifferentiators.join('、')}`:'',
    p.physicalFeatures?`物理特征：${p.physicalFeatures}`:'',
    p.serviceOffering?`服务：${p.serviceOffering}`:'',
    p.technologyMoat?`技术护城河：${p.technologyMoat}`:''
  ].filter(Boolean).join('\n');
  if(key==='price') return [
    p.strategy?`策略：${p.strategy}（${p.strategyNote||''}）`:'',
    p.tiers.length?`档位：\n${p.tiers.map(t=>`- ${t.name} ${t.price}${t.unit||''}${t.hero?' ★':''}（${t.targetSegment||''}）`).join('\n')}`:'',
    p.channelPricing.length?`渠道差异化：\n${p.channelPricing.map(c=>`- ${c.channel}：${c.priceAdjustment}（${c.rationale||''}）`).join('\n')}`:'',
    p.promotions.length?`促销节奏：\n${p.promotions.map(x=>`- ${x.occasion}：${x.discount}（${x.period||''}）`).join('\n')}`:'',
    p.ppp?`PPP 校准：${p.ppp}`:'',
    p.pricingNumbers?`数字与尾数：${p.pricingNumbers}`:'',
    p.fxSensitivity?`汇率敏感度：${p.fxSensitivity}`:''
  ].filter(Boolean).join('\n');
  if(key==='place') return [
    p.onlineSelf.length?`线上自营：${p.onlineSelf.join('、')}`:'',
    p.onlineThird.length?`第三方平台：${p.onlineThird.join('、')}`:'',
    p.offlineDirect.length?`线下直营：${p.offlineDirect.join('、')}`:'',
    p.offlineDistrib.length?`经销商：${p.offlineDistrib.join('、')}`:'',
    p.offlineRetail.length?`KA：${p.offlineRetail.join('、')}`:'',
    p.keyPartners.length?`关键伙伴：${p.keyPartners.map(x=>(x&&typeof x==='object'&&!Array.isArray(x)?x.name:x)).join('、')}`:'',
    p.localChannelRelations?`本地渠道关系：${p.localChannelRelations}`:'',
    p.channelIncentives?`渠道激励：${p.channelIncentives}`:'',
    p.structure.length?`渠道结构：\n${p.structure.map(g=>`- ${g.name}: ${g.children.map(c=>c.name+' '+c.share+'%').join('、')}`).join('\n')}`:''
  ].filter(Boolean).join('\n');
  if(key==='promotion') return [
    p.theme?`传播主题：${p.theme}`:'',
    p.advertising.length?`媒介组合：\n${p.advertising.map(a=>`- ${a.media} ${a.budgetShare}% — ${a.message}（KPI: ${a.kpi}）`).join('\n')}`:'',
    p.pr.length?`公关事件：\n${p.pr.map(e=>`- ${e.event}（${e.timing}）：${e.expectedReach}`).join('\n')}`:'',
    p.salesPromotion.length?`销售促进：\n${p.salesPromotion.map(s=>`- ${s.tactic}：${s.mechanic}（${s.period}）`).join('\n')}`:'',
    p.contentStrategy?`内容策略：${p.contentStrategy}`:'',
    p.context?`高低语境：${p.context}`:'',
    p.taboos?`禁忌与节日：${p.taboos}`:'',
    p.kolTiers?`KOL/KOC 分层：${p.kolTiers}`:'',
    p.language?`语言/翻译：${p.language}`:'',
    p.crm.membership?`CRM：${p.crm.tool} / ${p.crm.membership} / ${p.crm.repurchase}`:''
  ].filter(Boolean).join('\n');
  return '';
};

// simpleTable：可选 onChange 回调（用于 simpleTable oninput 触发 chart 局部重画）
Work4.simpleTable=function(sec, arr, cols, keyName){
  const addNoun=({advertising:'媒介',pr:'公关事件',salesPromotion:'促销手段',tiers:'价格档位',channelPricing:'渠道定价',promotions:'促销节奏'}[keyName]||'一行');
  const plate = (sec && sec.querySelector) ? sec.querySelector('.plate') : sec;
  const stepEl = (sec && sec.closest) ? sec.closest('.step') : null;
  const stepId = stepEl ? stepEl.dataset.step : null;
  const owner=stepId || ({tiers:'price',channelPricing:'price',promotions:'price',advertising:'promotion',pr:'promotion',salesPromotion:'promotion',skus:'product'}[keyName]) || Work4.currentStepId();
  const getRows=()=>Array.isArray(state.work4?.[owner]?.[keyName])?state.work4[owner][keyName]:arr;
  const nameOf=row=>row[cols.find(c=>c.type!=='number' && c.type!=='check')?.key]||'';
  const table=el('div',{class:'table-wrap'});
  const t=el('table',{class:'data'});
  t.innerHTML='<thead><tr>'+cols.map(c=>`<th>${c.label}</th>`).join('')+'<th style="width:50px"></th></tr></thead>';
  const tb=el('tbody');
  arr.forEach((row,i)=>{
    const tr=el('tr');
    cols.forEach(c=>{
      const td=el('td');
      if(c.type==='check'){
        const cb=document.createElement('input');
        cb.type='checkbox'; cb.checked=!!row[c.key]; cb.style.width='auto';
        cb.addEventListener('change',()=>{ row[c.key]=cb.checked; autosave(); Work4.refreshCharts(stepId); });
        td.appendChild(cb);
      }else{
        const inp=document.createElement(c.type==='textarea'?'textarea':'input');
        if(c.type!=='textarea') inp.type=c.type||'text';
        inp.value=row[c.key]??'';
        inp.addEventListener('input', e=>{
          row[c.key]= c.type==='number'? parseFloat(e.target.value)||null : e.target.value;
          autosave();
          Work4.refreshCharts(stepId);
        });
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });
    tr.appendChild(el('td',{},el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Interaction.removeItem({
      list:getRows,index:i,type:addNoun,name:()=>Interaction.objectName(addNoun,nameOf(row),i,getRows,nameOf),trigger:e.currentTarget,
      onChange:()=>{autosave();Work4.rerender(owner);}
    })},addNoun,()=>nameOf(row),i,getRows,nameOf),'删除')));
    tb.appendChild(tr);
  });
  t.appendChild(tb); table.appendChild(t); plate.appendChild(table);
  plate.appendChild(el('button',{class:'small',onclick:()=>{
    const blank={}; cols.forEach(c=>blank[c.key]= c.type==='number'?null:(c.type==='check'?false:''));
    getRows().push(blank);
    autosave(); Work4.rerender(owner);
  }}, '+ 添加'+addNoun));
};

Work4.currentStepId=function(){
  const t=document.querySelector('#steps4 .step.active');
  return t?t.dataset.step:null;
};

Work4.tagBox=function(arr, onChange){
  const ti=UI.tagsInput(arr||[], '输入后回车添加', onChange);
  ti.el.querySelector('input').addEventListener('blur',()=>onChange(ti.get()));
  return ti.el;
};

// 关键伙伴专用 chip 变体（03 号票 (a)）：chip 内嵌「线上 | 线下」双键段控，
// 未分类 = 两键都不亮，点亮键再点一次取消；手动新增默认未分类。
// 通用 Work4.tagBox 与其他 tags 字段零波及。
Work4.partnerBox=function(arr, onChange){
  const wrap=el('div',{class:'chip-row partner-row'});
  const input=el('input',{type:'text',placeholder:'输入伙伴名称回车添加'});
  const getItems=typeof arr==='function'?arr:()=>arr||[];
  const nameOf=item=>String(item && typeof item==='object'?item.name??'':item??'').trim();
  const sync=()=>onChange(getItems());
  const render=()=>{
    wrap.innerHTML='';
    getItems().forEach((item,i)=>{
      const name=nameOf(item),itemSide=item && typeof item==='object'?item.side:'';
      const chip=el('span',{class:'partner-chip'});
      chip.appendChild(el('span',{class:'partner-name'},name||'未命名关键伙伴，第 '+(i+1)+' 项'));
      const seg=el('span',{class:'sbu-segmented partner-seg',role:'group','aria-label':(name||'第 '+(i+1)+' 项')+' 渠道归属'});
      ['线上','线下'].forEach(side=>{
        const on=itemSide===side;
        const relationLabel=(on?'取消关联':'关联')+'关键伙伴：'+Interaction.objectName('关键伙伴',name,i,getItems,nameOf)+'（'+side+'）';
        const btn=el('button',{type:'button',class:'sbu-seg partner-seg-btn'+(on?' is-on':''),
          'aria-pressed':on?'true':'false','aria-label':relationLabel,title:relationLabel},side);
        btn.addEventListener('click',()=>{
          const items=getItems(),index=items.indexOf(item);if(index<0)return;
          if(item && typeof item==='object')item.side=on?'':side;
          else items[index]={name,side:on?'':side};
          sync(); render(); autosave();
          Work4.refreshCharts('place');
        });
        seg.appendChild(btn);
      });
      chip.appendChild(seg);
      chip.appendChild(el('span',{class:'sbu-seg-status partner-status'},itemSide==='线上'||itemSide==='线下'?itemSide:'未分类'));
      chip.appendChild(el('button',Interaction.deleteButton({class:'partner-remove',onclick:e=>Interaction.removeItem({
        list:getItems,index:i,type:'关键伙伴',name:()=>Interaction.objectName('关键伙伴',nameOf(item),i,getItems,nameOf),trigger:e.currentTarget,
        onChange:()=>{sync();render();autosave();Work4.rerender('place');}
      })},'关键伙伴',()=>nameOf(item),i,getItems,nameOf),'×'));
      wrap.appendChild(chip);
    });
    wrap.appendChild(input);
  };
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter' && input.value.trim()){
      e.preventDefault();
      getItems().push({name:input.value.trim(), side:''});
      input.value='';
      sync(); render(); autosave();
      Work4.refreshCharts('place');
    }
  });
  render();
  return wrap;
};

// 渠道结构合计 ≠100 的组（只提示不阻断，01 号票 (e)）
Work4.structureMismatches=function(structure){
  const out=[];
  (structure||[]).forEach(g=>{
    if(!g || !Array.isArray(g.children)) return;
    const total=g.children.reduce((s,c)=>s+(Number(c.share)||0),0);
    if(total>0 && Math.abs(total-100)>0.5) out.push({name:g.name||'', total:Math.round(total*10)/10});
  });
  return out;
};
// 把 mismatch 结果渲染进宿主（宿主常驻，数字编辑时可实时刷新）。
Work4.renderStructureMismatches=function(host, structure){
  if(!host) return;
  host.innerHTML='';
  const mismatches=Work4.structureMismatches(structure);
  if(!mismatches.length) return;
  const callout=el('div',{class:'callout', style:{margin:'12px 0',fontSize:'13px'}},
    el('span',{class:'callout-title'},'合计提示'));
  mismatches.forEach(m=>{
    callout.appendChild(el('div',{},'渠道结构“'+(m.name||'未命名')+'”当前合计 '+m.total+'%，应为 100%'));
  });
  host.appendChild(callout);
};
// 结构表行内编辑走 refreshCharts，这里同步刷新 callout，避免等整步重渲染。
Work4.refreshStructureMismatches=function(stepId){
  const sec=document.querySelector('#steps4 .step[data-step="'+stepId+'"]');
  if(!sec) return;
  const host=sec.querySelector('[data-channel-mismatch]');
  if(!host) return;
  const p=state.work4.place;
  Work4.renderStructureMismatches(host, p.structure);
};

// 局部 chart 重画（不重渲染整步，避免输入失焦）
Work4.refreshCharts = function(stepId){
  if(!stepId) return;
  const sec = document.querySelector('#steps4 .step[data-step="'+stepId+'"]');
  if(!sec) return;
  if(stepId === 'place') Work4.refreshStructureMismatches(stepId);
  const hosts = sec.querySelectorAll('.chart-slot [data-chart-host]');
  hosts.forEach(host => {
    // 整体替换 host 内部：先清空，再调用对应 renderer 重建
    while(host.firstChild) host.removeChild(host.firstChild);
    const slot = host.closest('.chart-slot');
    const kind = slot && slot.dataset.chart;
    if(kind === 'place-channel'){
      const p = state.work4.place;
      if(p.structure && p.structure.length){
        Work4.renderChannelTree(host, p.structure, p.keyPartners);
        Work4.renderTreemap(host, p.structure);
      }
    } else if(kind === 'promo-budget'){
      const p = state.work4.promotion;
      if(p.advertising && p.advertising.length && p.advertising.some(a=>a.budgetShare)){
        const total = p.advertising.reduce((a,b)=>a+(Number(b.budgetShare)||0),0);
        const seg = p.advertising.filter(a=>a.budgetShare).map((a,i)=>({label:a.media, count:Math.round(Number(a.budgetShare)/total*100), color:['#1a1a1a','#3a3a3a','#5a5a5a','#7a7a7a','#9a9a9a','#bababa'][i%6]}));
        if(typeof renderHundredField==='function') renderHundredField(host, seg);
      }
    } else if(kind === 'price-tiers'){
      const p = state.work4.price;
      if(p.tiers && p.tiers.length && typeof renderBarChart==='function'){
        renderBarChart(host, p.tiers.filter(t=>t.price).map(t=>({label:t.name+(t.hero?' · HERO':''),value:Number(t.price)})),{unit:''});
      }
    }
  });
};

// 三个 render helper：让 refreshCharts 和初次 render 走同一份代码（DRY）
Work4.renderPlaceChannel = function(host, p){
  if(!p.structure || !p.structure.length) return;
  Work4.renderChannelTree(host, p.structure, p.keyPartners);
  Work4.renderTreemap(host, p.structure);
};
Work4.renderHundredBudget = function(host, p){
  if(!p.advertising || !p.advertising.length || !p.advertising.some(a=>a.budgetShare)) return;
  if(typeof renderHundredField !== 'function') return;
  const total = p.advertising.reduce((a,b)=>a+(Number(b.budgetShare)||0),0);
  const seg = p.advertising.filter(a=>a.budgetShare).map((a,i)=>({label:a.media, count:Math.round(Number(a.budgetShare)/total*100), color:['#1a1a1a','#3a3a3a','#5a5a5a','#7a7a7a','#9a9a9a','#bababa'][i%6]}));
  renderHundredField(host, seg);
};
Work4.renderPriceTiers = function(host, p){
  if(!p.tiers || !p.tiers.length) return;
  if(typeof renderBarChart !== 'function') return;
  renderBarChart(host, p.tiers.filter(t=>t.price).map(t=>({label:t.name+(t.hero?' · HERO':''),value:Number(t.price)})),{unit:''});
};

Work4.refreshDynamic=function(){
  // 切到本步时如果 aiResult 存在，调用一次（无强需求，保留占位）
};

// 强制重绘某 step
Work4.rerender=function(id){
  const sec=document.querySelector('#steps4 .step[data-step="'+id+'"]');
  if(!sec) return;
  sec.dataset.rendered='0';
  Work4.renderStep(id);
};

Work4.renderChannelTree=function(container, structure, partners){
  // 2026-09-07（用户标注）：伙伴不再画成右侧虚线行，改为列在左侧 group 框内
  // 标题下方（「线上下面加伙伴 / 线下下面加伙伴」）；右侧只保留渠道 bar。
  // 与 work5 channelTreeSvg 同构：框加宽到 180，伙伴名按宽度换行，
  // 框高 = max(渠道行数, 标题+伙伴行)。
  const partnerArr = Array.isArray(partners) ? partners : [];
  const normalizedPartners = partnerArr.map(p => (p && typeof p === 'object' && !Array.isArray(p)) ? p : { name: String(p || '').trim(), side: '' });
  const unclassified = normalizedPartners.filter(p => p.name && p.side !== '线上' && p.side !== '线下').map(p => p.name);
  const partnerOfSide = (side) => normalizedPartners
    .map(p => (p && typeof p === 'object' && !Array.isArray(p)) ? p : { name: String(p || '').trim(), side: '' })
    .filter(p => p.name && p.side === side)
    .map(p => p.name);
  const ROW_H = 34, GROUP_X = 20, GROUP_W = 180, INNER_PAD = 12;
  const CONN_X = GROUP_X + GROUP_W + 18, ROW_X = CONN_X + 32, BAR_W = 230, TEXT_X = ROW_X + BAR_W + 8;
  const PARTNER_LINE_H = 17;
  const wrapLines = (text, maxUnits) => {
    const out = [];
    let cur = '', units = 0;
    for(const ch of String(text)){
      const w = /[⺀-鿿　-〿＀-￯]/.test(ch) ? 2 : 1;
      if(units + w > maxUnits && cur){ out.push(cur); cur = ''; units = 0; }
      cur += ch; units += w;
    }
    if(cur) out.push(cur);
    return out;
  };
  const MAX_UNITS = 26;
  const meta = (structure||[]).map(grp => {
    const kids = grp.children || [];
    const pns = partnerOfSide(grp.name);
    // 每个伙伴先自行换行；首行带 ·、续行缩进对齐
    const partnerBlocks = pns.map(pn => wrapLines(pn, MAX_UNITS));
    const partnerLineCount = partnerBlocks.reduce((a, ls) => a + ls.length, 0);
    const barsH = Math.max(1, kids.length) * ROW_H;
    const boxH = pns.length ? (50 + PARTNER_LINE_H * partnerLineCount + 10) : 34;
    return { grp, kids, pns, partnerBlocks, gh: Math.max(barsH, boxH) };
  });
  const totalH = meta.reduce((a, m) => a + m.gh, 20) + meta.length * 8 + (unclassified.length ? 28 : 0);
  const W = 640, H = totalH;
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  let y = 20;
  meta.forEach(m => {
    const { grp, kids, pns, partnerBlocks, gh } = m;
    const gy = y + gh / 2;
    const groupShare=(kids||[]).reduce((a,c)=>a+(Number(c.share)||0),0);
    svg += `<rect x="${GROUP_X}" y="${y}" width="${GROUP_W}" height="${gh}" fill="var(--color-paper-2)" stroke="var(--color-ink)" data-partners="${esc(pns.join('、'))}"/>`;
    if(pns.length){
      svg += `<text x="${GROUP_X + INNER_PAD}" y="${y + 22}" font-family="Playfair Display" font-style="normal" font-size="14" fill="var(--color-ink)">${esc(grp.name)} ${groupShare}%</text>`;
      svg += `<text x="${GROUP_X + INNER_PAD}" y="${y + 42}" font-family="JetBrains Mono" font-size="9" letter-spacing="1" fill="var(--color-ink-2)">◇ 伙伴：${esc(pns.join('、'))}</text>`;
      let li = 0;
      partnerBlocks.forEach(lines => lines.forEach((ln, j)=>{
        const prefix = j === 0 ? '· ' : '   ';
        svg += `<text x="${GROUP_X + INNER_PAD}" y="${y + 60 + li * PARTNER_LINE_H}" font-family="Playfair Display" font-style="normal" font-size="11" fill="var(--color-ink)">${prefix}${esc(ln)}</text>`;
        li++;
      }));
    } else {
      svg += `<text x="${GROUP_X + GROUP_W / 2}" y="${gy + 4}" text-anchor="middle" font-family="Playfair Display" font-style="normal" font-size="14" fill="var(--color-ink)">${esc(grp.name)} ${groupShare}%</text>`;
    }
    // 2026-09-07（用户要求）：bar 行距按框高 gh 平均分布（spread），
    // 伙伴多时框被撑高，bar 自动均匀散开铺满框高，连接线从框中心 gy 对称发散。
    // gh >= kids*ROW_H，故 step = gh/n >= ROW_H，bar 不会重叠。
    const step = kids.length ? gh / kids.length : ROW_H;
    kids.forEach((ch, ci) => {
      const cy = y + step * (ci + 0.5);
      svg += `<line x1="${CONN_X}" y1="${gy}" x2="${ROW_X}" y2="${cy}" stroke="var(--color-rule)"/>`;
      const share = Number.parseFloat(ch.share);
      const safeShare = Number.isFinite(share) ? Math.max(0, share) : 0;
      const barW = (safeShare / 100) * BAR_W;
      svg += `<rect x="${ROW_X}" y="${cy - 10}" width="${BAR_W}" height="20" fill="var(--color-paper-2)" stroke="var(--color-rule)"/>`;
      svg += `<rect x="${ROW_X}" y="${cy - 10}" width="${barW}" height="20" fill="var(--color-ink)"/>`;
      svg += `<text x="${TEXT_X}" y="${cy + 4}" font-family="JetBrains Mono" font-size="11" fill="var(--color-ink)">${esc(ch.name)} ${safeShare}%</text>`;
    });
    y += gh + 8;
  });
  if(unclassified.length) svg += `<desc>◇ 未分类伙伴：${esc(unclassified.join('、'))} — 回 Work4 标注线上/线下</desc>`;
  svg += `</svg>`;
  container.insertAdjacentHTML('beforeend', svg);
};

Work4.renderTreemap=function(container, structure){
  const W=640,H=220,PAD=3;
  const COLORS=['#1a1a1a','#5a5a5a','#9a9a9a','#c8c8c8'];
  const total=(structure||[]).reduce((a,g)=>a+(g.children||[]).reduce((x,c)=>x+(Number(c.share)||0),0),0);
  if(!total) return;
  let svg=`<svg class="chart" viewBox="0 0 ${W} ${H}" style="margin-top:12px">`;
  let x=0;
  (structure||[]).forEach((grp,gi)=>{
    const gShare=(grp.children||[]).reduce((a,c)=>a+(Number(c.share)||0),0);
    const gw=gShare/total*W;
    svg+=`<rect x="${x}" y="0" width="${gw}" height="${H}" fill="none" stroke="var(--color-ink)"/>`;
    svg+=`<text x="${x+6}" y="14" font-family="JetBrains Mono" font-size="10" fill="var(--color-ink)">${esc(grp.name)} ${gShare}%</text>`;
    let y=20;
    const innerH=H-20;
    (grp.children||[]).forEach(ch=>{
      const sh=Number(ch.share)||0;
      const chH=gShare? sh/gShare*innerH : 0;
      if(chH>1){
        svg+=`<rect x="${x+PAD}" y="${y+PAD}" width="${Math.max(0,gw-2*PAD)}" height="${chH-2*PAD}" fill="${COLORS[gi%COLORS.length]}" opacity="0.85"/>`;
        if(chH>22 && gw>90){
          const dark = gi%2===0;
          svg+=`<text x="${x+PAD+6}" y="${y+chH/2+4}" font-family="JetBrains Mono" font-size="10" fill="${dark?'var(--color-paper)':'var(--color-ink)'}">${esc(ch.name)} ${sh}%</text>`;
        }
      }
      y+=chH;
    });
    x+=gw;
  });
  svg+='</svg>';
  container.insertAdjacentHTML('beforeend', svg);
};

Work4.exportMd = function(){
  return `\n## IV. 营销组合\n\n### 出海路径\n${Work4.summaryText('route')}\n\n### 产品\n${Work4.summaryText('product')}\n\n### 价格\n${Work4.summaryText('price')}\n\n### 渠道\n${Work4.summaryText('place')}\n\n### 促销\n${Work4.summaryText('promotion')}\n`;
};

// 2026-09-01 候选 4：迁移注册契约（ADR 0008 已移除段落采纳流）
// 04 号票：旧存档 keyPartners string[] → [{name, side}] + 词表启发式初值；
// 顺手把 [线下,线上] 结构归位成 [线上,线下]（位置映射前提，幂等）。
Work4.PARTNER_ONLINE_WORDS = ['平台','电商','Amazon','TikTok','Shopee','Lazada','独立站','官网','小程序','App','直播','KOC','KOL','MCN','博主','UP 主','种草','社媒'];
Work4.PARTNER_OFFLINE_WORDS = ['经销','代理','商超','KA','超市','门店','专柜','直营','批发','分销','连锁','终端','医院','基地','展会'];
Work4.guessPartnerSide=function(name){
  const n=String(name||'').toLowerCase();
  if(Work4.PARTNER_ONLINE_WORDS.some(w=>n.includes(String(w).toLowerCase()))) return '线上';
  if(Work4.PARTNER_OFFLINE_WORDS.some(w=>n.includes(String(w).toLowerCase()))) return '线下';
  return '';
};
Work4.migrateKeyPartners=function(w4){
  if(!w4 || typeof w4!=='object') return w4;
  const place=w4.place;
  if(place && Array.isArray(place.keyPartners)){
    const normalized=place.keyPartners.map(p=>{
      if(p && typeof p==='object' && !Array.isArray(p)){
        const name=String(p.name==null?'':p.name).trim();
        if(!name) return null;
        return {name, side:(p.side==='线上'||p.side==='线下') ? p.side : ''};
      }
      const name=String(p==null?'':p).trim();
      return name ? {name, side:Work4.guessPartnerSide(name)} : null;
    }).filter(Boolean);
    place.keyPartners=normalized;
  }
  if(place && Array.isArray(place.structure)){
    // 渠道结构的位置契约固定为 [线上,线下]。旧数据可能反序、缺组或带额外空组；
    // 统一归位/补桶，才能让伙伴 side 与树图位置稳定映射。
    const clean=place.structure.filter(g=>g && typeof g==='object');
    const online=clean.find(g=>String(g.name||'').trim()==='线上') || {name:'线上', children:[]};
    const offline=clean.find(g=>String(g.name||'').trim()==='线下') || {name:'线下', children:[]};
    online.children=Array.isArray(online.children)?online.children:[];
    offline.children=Array.isArray(offline.children)?offline.children:[];
    place.structure=[online, offline];
  }
  return w4;
};
Work4.workKey = 'work4';
Work4.migrations = [Work4.migrateKeyPartners];
