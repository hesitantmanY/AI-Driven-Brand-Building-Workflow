/* ============================================================
   WORKSHOP 3 — 价值主张与定位（6 步版）
   Steps: scenarios / mining / candidates / matrix / proposition / identity
   流程：场景细分 → 卖点挖掘 → 备选卖点 → 合意性×可实施性评分与矩阵
         → 主张与定位 → 人格与 Slogan。
   每步一个「AI 起草…」主按键；多子动作步为真流水线（API 自动 / 手动粘贴双模式）。
   上游：Work 1（SBU、画像/使用场景/价值体系/合成调研）、Work 2（tier1 + tier2，旧兼容）。
   ============================================================ */
Work3.steps = [
  {id:'scenarios', label:'1. 场景细分'},
  {id:'mining', label:'2. 卖点挖掘'},
  {id:'candidates', label:'3. 备选卖点'},
  {id:'matrix', label:'4. 评分与矩阵'},
  {id:'proposition', label:'5. 主张与定位'},
  {id:'identity', label:'6. 人格与 Slogan'}
];
// 每步的下游步骤；末步（identity）无下游，出口走跨坊 CTA（2026-08-28 统一步间 CTA）
Work3.NEXT_STEPS = { scenarios:'mining', mining:'candidates', candidates:'matrix', matrix:'proposition', proposition:'identity' };

Work3.DEFAULT_DESIRABILITY_DIMS = [
  {key:'importance', label:'重要性', definition:'这个卖点对客户有多重要'},
  {key:'uniqueness', label:'独特性', definition:'竞品是否也在说/做'},
  {key:'credibility', label:'可信性', definition:'客户凭什么相信你能做到'}
];
Work3.DEFAULT_IMPLEMENTABILITY_DIMS = [
  {key:'feasibility', label:'可行性', definition:'技术/供应链/成本能否实现'},
  {key:'communicability', label:'可传播性', definition:'能否用一句话让客户听懂'},
  {key:'sustainability', label:'可持续性', definition:'能否长期维持、不被轻易复制'}
];

Work3.defaultData = () => ({
  _scenariosGenerated:false,
  _painMapGenerated:false,
  // 上游接入（只读回显 + 场景细分）
  context: {
    sbuName:'', sbuOneLine:'',
    targetMarket:'', targetMarketReason:'',
    tier1: null,            // {marketId, name, rationale} — work2.decision.tier1
    tier2: [],              // [{marketId, name}]
    personas: [],           // work1.personas（只读引用）
    valueFramework: [],     // work1.valueFramework.indicators
    hasSurvey: false
  },
  // 场景细分（市场细分场景，≠ work1 使用场景）
  scenarios: [
    // {id, name, description, personaIds:[], needStrength:{pain,willingness,frequency}, selected}
  ],
  // 卖点挖掘（双模式 AI）
  mining: {
    documents: [],
    simulatedDocuments: [],   // 画像生成的模拟语料（独立存放，与真实语料混合建模，构成可见）
    includeSimulated: true,   // 「建模时包含模拟语料」默认勾选（2026-08-29 共识）
    includeNegative: true,    // 模拟语料包含负面反馈/抱怨（默认勾选，支撑痛点证据）
    includeWork1Open:true, includeWork1Themes:true,
    ldaParams:{ k:5, passes:15, iterations:100, no_below:2, no_above:0.5 },
    ldaResult:null, ldaError:null,
    topics: [],             // [{id,label,share,keywords,representative_docs}]
    wordFreqTop:[], stats:null,
    corpusComposition: null, // {real, simulated, total} — 最近一次建模的语料构成快照
    painMap: [
      // {id, pain, evidence, frequency, linkedNeeds:[], linkedTopicId, type:'痛点'|'痒点', scenarioId}
    ]
  },
  // 备选卖点（初始 5 个空行）
  candidates: Array.from({length:5},()=>({id:uid('c'),name:'',pain:'',painId:'',description:'',evidence:'',source:'user',scenarioId:'',selected:false,desirabilityScores:{},extraDims:{}})),
  dimensions: {
    desirability: Work3.DEFAULT_DESIRABILITY_DIMS.map(d=>({...d})),
    implementability: Work3.DEFAULT_IMPLEMENTABILITY_DIMS.map(d=>({...d}))
  },
  // 2026-09-01 wayfinder map：最优 = 第一象限 ∩ 均衡带 |y−x| ≤ sectorWidth（默认 1.5）。
  // 旧字段 sectorAngle/sectorRadius 作废（mergeWithDefaults 嵌套合并保证新字段出现）。
  matrix: { showSector:true, sectorWidth:1.5, xCut:null, yCut:null, manualSelected:[] },
  migration: { prompt:'', analyses:[] },
  // 主张与定位
  proposition: {
    coreValueIds: [],       // selected 卖点自动同步（顺序 = 主辅）
    alternatives: [],       // [{id, text}]
    chosenValueText:'',
    positioning:{brand:'',audience:'',coreValue:'',category:''},
    positioningStatement:''
  },
  // 人格与 Slogan（自 proposition 迁出）
  identity: {
    mbti:'', personalityTraits:[],
    sloganOptions:[], chosenSlogan:''
  },
  _scoreDone: [],           // 评分断点续跑（内部）
  _pipeProp: [],            // 主张与定位流水线断点
  _pipeIdentity: []         // 人格与 Slogan 流水线断点
});

/* ---------- 数据迁移 ----------
   旧 work3（无 scenarios、proposition 含人格/slogan）→ 新 schema 无损。
   注意：迁移必须幂等且不带 showToast——落盘与提示由 mergeWithDefaults 统一处理
   （迁移不落盘会导致每次刷新重跑 + 重复弹窗）。 */
Work3.migrateWork3 = function(old){
  if(!old) return old;
  // 1. identity ← old.proposition（旧数据含 slogan/mbti/personalityTraits）
  const p = old.proposition;
  if(p && (p.mbti || (p.sloganOptions||[]).length || (p.personalityTraits||[]).length) && !old._identityDone){
    old.identity = old.identity || {};
    old.identity.mbti = old.identity.mbti || p.mbti || '';
    old.identity.personalityTraits = (old.identity.personalityTraits||[]).length ? old.identity.personalityTraits : (p.personalityTraits||[]);
    old.identity.sloganOptions = (old.identity.sloganOptions||[]).length ? old.identity.sloganOptions : (p.sloganOptions||[]);
    old.identity.chosenSlogan = old.identity.chosenSlogan || p.chosenSlogan || '';
    delete p.mbti; delete p.personalityTraits; delete p.sloganOptions; delete p.chosenSlogan;
    old._identityDone = true;
  }
  // 2. scenarios = []（旧数据无）
  if(!Array.isArray(old.scenarios)){ old.scenarios = []; }
  // 2b. 模拟语料字段（2026-08-29 共识：真实 + 模拟双来源混合建模）
  if(!old.mining) old.mining = {};
  if(!Array.isArray(old.mining.simulatedDocuments)){ old.mining.simulatedDocuments = []; }
  if(old.mining.includeSimulated == null){ old.mining.includeSimulated = true; }
  // 3. painMap/candidates 补 scenarioId
  (old.mining?.painMap||[]).forEach(x=>{ if(x.scenarioId==null){ x.scenarioId=''; } });
  (old.candidates||[]).forEach(c=>{ if(c.scenarioId==null){ c.scenarioId=''; } });
  return old;
};

/* ---------- 上游同步 ---------- */
Work3.syncContext = function(){
  const c = state.work3.context;
  c.sbuName = state.work1.sbu.name || '';
  c.sbuOneLine = state.work1.sbu.summary || state.work1.sbu.category || '';
  // Work 2 读取统一 helper：tier1/tier2（v2），旧数据回退 selectedMarketId
  const tiers = (typeof Work2!=='undefined' && Work2.selectedTiers) ? Work2.selectedTiers() : {tier1:null,tier2:[]};
  c.tier1 = tiers.tier1;
  c.tier2 = tiers.tier2 || [];
  c.targetMarket = tiers.tier1 ? tiers.tier1.name : '';
  c.targetMarketReason = tiers.tier1 ? (tiers.tier1.rationale||'') : '';
  c.personas = state.work1.personas.map(p=>({id:p.id,name:p.name,painPoints:p.painPoints,values:p.values,quote:p.quote,region:p.region}));
  c.valueFramework = [state.work1.values.chosenFunctional, state.work1.values.chosenEmotional, state.work1.values.chosenSocial].filter(Boolean);
  c.hasSurvey = ((state.work1.survey&&state.work1.survey.responses)||[]).length>0;
};

/* ---------- 骨架 ---------- */
Work3.renderStep = function(id){
  const sec=document.querySelector('#steps3 .step[data-step="'+id+'"]');
  if(!sec) return;
  // RENDER_VERSION guard（契约在 UI.mountGuard，2026-09-01 候选 4）
  if(!UI.mountGuard(sec, Work3, id)) return;
  Work3.syncContext();
  sec.innerHTML='';
  const idx3 = Work3.steps.findIndex(s=>s.id===id);
  sec.appendChild(el('div',{class:'sub-head'},
    el('span',{class:'num'},'3.'+(idx3+1)),
    el('h3',{}, Work3.titles[id])
  ));
  const subEl3 = Work3.subtitles && Work3.subtitles[id];
  if(subEl3){
    sec.appendChild(el('p',{class:'lede', style:{fontFamily:'var(--font-display)', fontStyle:'normal', fontSize:'1.125rem', lineHeight:1.5, color:'var(--color-ink)', margin:'0 0 28px'}}, subEl3));
  }
  sec.appendChild(el('div',{class:'plate plate--empty'}));
  UI.mountMvo(sec, Work3, id);
  const fn=Work3.render[id]; if(fn) fn(sec);
  // 步间跳转 CTA：本步 mvo 全过后显示「下一步 →」（2026-08-28 统一步间 CTA）
  const nxt=UI.stepNextCta(3,id); if(nxt) sec.querySelector('.plate').appendChild(nxt);
  // 跨工作坊闭环 CTA：末步 mvo 全过后显示「IV. 营销组合 →」
  const nw=UI.nextWorkCta(3,id); if(nw) sec.querySelector('.plate').appendChild(nw);
  UI.mountMark(sec, Work3);
};
// Bump when changing render output so cached steps re-render.
Work3.RENDER_VERSION = '4';
// Forced redraw (clear cache + re-render).
Work3.rerender=function(id){
  const sec=document.querySelector('#steps3 .step[data-step="'+id+'"]');
  if(!sec) return;
  sec.dataset.rendered='0';
  Work3.renderStep(id);
};
// Global refreshDynamic: default behavior invalidates cache on any id change.
Work3.refreshDynamic=function(id){
  Work3.rerender(id);
};

/* 删除后只清理确实指向该对象的引用，其他填写与评分继续保留。 */
Work3.deleteChanged = function(step){
  if(typeof document.querySelectorAll==='function'){
    document.querySelectorAll('#steps3 .step, #steps4 .step, #steps5 .step').forEach(sec=>{sec.dataset.rendered='0';});
  }
  autosave(); Work3.rerender(step);
  if(typeof App!=='undefined' && typeof App.updateSummary==='function') App.updateSummary();
};
Work3.deleteName = function(type,item,index,list,nameOf){
  return Interaction.objectName(type,nameOf(item),index,list,nameOf);
};
Work3.removeScenario = function(index,trigger){
  const w=state.work3, item=w.scenarios[index]; if(!item) return Promise.resolve(false);
  const pains=(w.mining.painMap||[]).filter(p=>p.scenarioId===item.id);
  const candidates=(w.candidates||[]).filter(c=>c.scenarioId===item.id);
  const impact=pains.length||candidates.length
    ? `将取消 ${pains.length} 条痛点、${candidates.length} 个备选卖点对该场景的关联。场景中的 ${(item.personaIds||[]).length} 个画像关联随场景删除；痛点、卖点及其已有评分和证据会保留。` : '';
  return Interaction.removeItem({list:()=>state.work3.scenarios,index,type:'场景',
    name:()=>Work3.deleteName('场景',item,index,w.scenarios,s=>s.name),impact,trigger,
    onChange:()=>{
      if(impact){
        (w.mining.painMap||[]).forEach(p=>{if(p.scenarioId===item.id)p.scenarioId='';});
        (w.candidates||[]).forEach(c=>{if(c.scenarioId===item.id)c.scenarioId='';});
      }
      Work3.deleteChanged('scenarios');
    }});
};
Work3.removePain = function(index,trigger){
  const w=state.work3, item=w.mining.painMap[index]; if(!item) return Promise.resolve(false);
  const linked=w.candidates.filter(c=>c.painId===item.id || (!c.painId && Work3.resolvePainId(c.pain,true)===item.id));
  const impact=linked.length ? `将解除 ${linked.length} 个备选卖点对该痛点的绑定。卖点中已有的痛点描述、证据和评分会保留；该痛点不再出现在痛点地图和下游证据中。` : '';
  return Interaction.removeItem({list:()=>state.work3.mining.painMap,index,type:'痛点',
    name:()=>Work3.deleteName('痛点',item,index,w.mining.painMap,p=>p.pain),impact,trigger,
    onChange:()=>{
      if(impact) linked.forEach(c=>{if(w.candidates.includes(c))c.painId='';});
      Work3.deleteChanged('mining');
    }});
};
Work3.hasCandidateScores = function(c){
  const dims=[...state.work3.dimensions.desirability,...state.work3.dimensions.implementability];
  return dims.some(d=>Work3.scoreValue(c[d.key])!=null) ||
    Object.values(c.desirabilityScores||{}).some(sc=>Object.values(sc||{}).some(v=>Work3.scoreValue(v)!=null)) ||
    Work3.scoreValue(c.reviewDes)!=null || Work3.scoreValue(c.reviewImp)!=null;
};
Work3.removeCandidate = function(index,trigger){
  const w=state.work3, item=w.candidates[index]; if(!item) return Promise.resolve(false);
  const manual=(w.matrix.manualSelected||[]).includes(item.id);
  const core=(w.proposition.coreValueIds||[]).includes(item.id);
  const analyses=(w.migration.analyses||[]).filter(a=>a.candidateId===item.id).length;
  const checkpoints=(w._scoreDone||[]).filter(k=>String(k).split(':').at(-1)===item.id).length;
  const scored=Work3.hasCandidateScores(item);
  const impact=scored||manual||core||item.selected||analyses||checkpoints
    ? `该卖点${scored?'已有评分，删除会移除它的评分和矩阵点位；':'会从矩阵及排名中移除；'}将清理${manual?'手动入选记录、':''}${core||item.selected?'核心卖点引用、':''}${analyses+' 条迁移分析和 '+checkpoints+' 个评分断点'}。其他卖点及已有主张、定位和正文保留，下游证据按剩余卖点更新。` : '';
  return Interaction.removeItem({list:()=>state.work3.candidates,index,type:'备选卖点',
    name:()=>Work3.deleteName('备选卖点',item,index,w.candidates,c=>c.name),impact,trigger,
    onChange:()=>{
      if(impact){
        w.matrix.manualSelected=(w.matrix.manualSelected||[]).filter(id=>id!==item.id);
        w.proposition.coreValueIds=(w.proposition.coreValueIds||[]).filter(id=>id!==item.id);
        w.migration.analyses=(w.migration.analyses||[]).filter(a=>a.candidateId!==item.id);
        w._scoreDone=(w._scoreDone||[]).filter(k=>String(k).split(':').at(-1)!==item.id);
      }
      Work3.deleteChanged('candidates');
    }});
};
Work3.removeDimension = function(axis,index,trigger){
  const w=state.work3, dims=w.dimensions[axis], item=dims[index]; if(!item) return Promise.resolve(false);
  if(dims.length<=1){showToast('每侧至少保留 1 个维度');return Promise.resolve(false);}
  const label=axis==='desirability'?'合意性':'可实施性';
  const scored=w.candidates.filter(c=>Work3.scoreValue(c[item.key])!=null ||
    Object.values(c.desirabilityScores||{}).some(sc=>Work3.scoreValue(sc?.[item.key])!=null)).length;
  return Interaction.removeItem({list:()=>state.work3.dimensions[axis],index,type:'评分维度',
    name:()=>Work3.deleteName('评分维度',item,index,dims,d=>d.label),trigger,
    impact:`这是${label}维度。将删除 ${scored} 个卖点中该维度的评分及 persona 子分，移除该维度的来源标记。本轴评分断点、复盘覆盖分和现有迁移分析将失效；矩阵按剩余维度重新计算，另一轴的维度和评分保留。`,
    onChange:()=>{
      w.candidates.forEach(c=>{
        delete c[item.key]; delete c['src_'+item.key];
        if(c.extraDims)delete c.extraDims[item.key];
        Object.values(c.desirabilityScores||{}).forEach(sc=>{if(sc)delete sc[item.key];});
        delete c[axis==='desirability'?'reviewDes':'reviewImp'];
      });
      const prefix=axis==='desirability'?'d:':'i:';
      w._scoreDone=(w._scoreDone||[]).filter(k=>!String(k).startsWith(prefix));
      w.migration.analyses=[]; w.migration.prompt='';
      Work3.deleteChanged('matrix');
    }});
};
Work3.removeAlternative = function(index,trigger){
  const p=state.work3.proposition, item=p.alternatives[index]; if(!item) return Promise.resolve(false);
  const selected=!!p.chosenValueText && item.text===p.chosenValueText;
  return Interaction.removeItem({list:()=>state.work3.proposition.alternatives,index,type:'价值主张候选',
    name:()=>Work3.deleteName('价值主张候选',item,index,p.alternatives,a=>a.text),trigger,
    impact:selected?'这是已选定的价值主张。删除后将清除选定指针，下游不再将它作为选定主张；已有定位、表单及叙事正文保留。':'',
    onChange:()=>{if(selected)p.chosenValueText='';Work3.deleteChanged('proposition');}});
};
Work3.removeSlogan = function(index,trigger){
  const id=state.work3.identity, item=id.sloganOptions[index]; if(item==null) return Promise.resolve(false);
  const selected=!!id.chosenSlogan && item===id.chosenSlogan;
  return Interaction.removeItem({list:()=>state.work3.identity.sloganOptions,index,type:'Slogan',
    name:()=>Work3.deleteName('Slogan',item,index,id.sloganOptions,s=>s),trigger,
    impact:selected?'这是已选定的 Slogan。删除后将清除选定指针，下游不再将它作为选定 Slogan；已有品牌人格、表单及叙事正文保留。':'',
    onChange:()=>{if(selected)id.chosenSlogan='';Work3.deleteChanged('identity');}});
};

Work3.titles = {
  scenarios:'场景细分', mining:'卖点挖掘（LDA + 痛点地图）', candidates:'备选卖点',
  matrix:'合意性 × 可实施性矩阵', proposition:'价值主张与定位', identity:'品牌人格与 Slogan'
};
Work3.subtitles = {
  scenarios:'把 Work 1 的画像与使用场景翻译为目标市场的细分场景——客群规模可估算、痛点可命中、竞品未垄断。',
  mining:'粘贴或导入评论文本，运行 LDA 主题建模，再让 AI 归纳痛点地图（痛点必须解决，痒点是加分项）。',
  candidates:'从痛点地图生成 8–12 个备选卖点；每个卖点绑定痛点、证据与场景。',
  matrix:'逐 persona 打合意性子分 + 企业视角评可实施性；扇面筛选明星卖点，扇面外生成迁移路径。',
  proposition:'从入选卖点写价值主张与定位句（四要素填空）。不做 logo/视觉系统。',
  identity:'品牌人格（MBTI + 特质）与 5 个 slogan。VI 设计与汇报 PPT 在工具边界之外。'
};

Work3.mvo = {
  scenarios: () => ({
    checks: [
      {label:'已读取 Work 2 主战场（tier1）', test:()=>!!state.work3.context.tier1},
      {label:'至少 3 个细分场景', test:()=>(state.work3.scenarios||[]).length>=3},
      {label:'已标记主战场场景（2-4 个）', test:()=>{const n=(state.work3.scenarios||[]).filter(s=>s.selected).length;return n>=1;}}
    ],
    note:'场景是"市场细分"，不是产品使用情境。每个场景要能回答：客群是谁、规模多大、痛在哪、竞品管没管。'
  }),
  mining: () => ({
    checks: [
      {label:'已有主题（真实 LDA 或模拟）', test:()=>(state.work3.mining.topics||[]).length>0},
      {label:'痛点地图至少 5 条（含痛点和痒点）', test:()=>(state.work3.mining.painMap||[]).length>=5}
    ],
    note:'没有真实语料（评论、访谈、客服记录）时，可生成模拟语料补足建模，产出会标注「模拟」；尽量补充真实资料。'
  }),
  candidates: () => ({
    checks: [
      {label:'备选卖点 ≥6 个', test:()=>state.work3.candidates.filter(c=>(c.name||'').trim()).length>=6},
      {label:'每个卖点绑定了痛点与证据', test:()=>state.work3.candidates.filter(c=>(c.name||'').trim()).every(c=>(c.pain||'').trim().length>0)},
      {label:'卖点都关联了场景（可留空但提示）', test:()=>state.work3.candidates.filter(c=>(c.name||'').trim()).some(c=>c.scenarioId)}
    ],
    note:'卖点要具体到"客户能感知的利益"，而不是"品质卓越""服务一流"这类正确的废话。每个卖点绑定痛点并给支撑证据：语料摘录（[真实]/[模拟]）、量化统计（N 篇评论提及）或可验证依据；没有就写「内部策略，无评论」。'
  }),
  matrix: () => ({
    checks: [
      {label:'所有卖点有合意性与可实施性分', test:()=>{
        const named=state.work3.candidates.filter(c=>(c.name||'').trim());
        if(!named.length) return false;
        const ddims=state.work3.dimensions.desirability, idims=state.work3.dimensions.implementability;
        const hasDesirability = c => ddims.length>0 && ddims.every(d=>Work3.desirabilityDimensionValue(c,d)!=null);
        const hasImplementability = c => idims.length>0 && idims.every(d=>Work3.scoreValue(c[d.key])!=null);
        return named.every(c=>hasDesirability(c) && hasImplementability(c));
      }},
      {label:'已确定扇面内的入选卖点', test:()=>state.work3.candidates.some(c=>c.selected)}
    ],
    note:'落在"高合意、低可实施"象限的卖点不要丢——那正是迁移路径要解决的问题。'
  }),
  proposition: () => ({
    checks: [
      {label:'已选定价值主张（为谁/提供什么/有何不同）', test:()=>(state.work3.proposition.chosenValueText||'').trim().length>10},
      {label:'定位句四要素完整', test:()=>{const p=state.work3.proposition.positioning||{};return !!(p.brand&&p.audience&&p.coreValue&&p.category);}}
    ],
    note:'主张、定位必须自洽——定位句四要素（品类/目标客群/差异化卖点/可量化利益）一个都不能空。'
  }),
  identity: () => ({
    checks: [
      {label:'MBTI 或人格特质 ≥1', test:()=>!!(state.work3.identity.mbti||(state.work3.identity.personalityTraits||[]).length)},
      {label:'已选定 slogan（可空但提示）', test:()=>!!(state.work3.identity.chosenSlogan||'').trim()}
    ],
    note:'人格和 slogan 要接得住价值主张——一个"高端专业"的定位配"搞笑接地气"的口号会撕裂品牌。'
  })
};
Work3.render={};

/* ---------- 1. 场景细分 ---------- */
Work3.render.scenarios = function(sec){
  const plate = sec.querySelector('.plate');
  const c = state.work3.context;

  // 上游上下文条（只读；点击跳回上游修改）
  const jump = (n)=>el('button',{class:'ghost small',onclick:()=>App.goWork(n)},'去修改 →');
  const bar = el('div',{class:'callout'},
    el('span',{class:'callout-title'},'UPSTREAM CONTEXT'),
    el('div',{class:'grid3',style:{marginTop:'8px'}},
      el('div',{}, el('div',{class:'hint'},'SBU'),
        el('div',{style:{fontFamily:'var(--font-display)',fontStyle:'normal',fontSize:'16px'}}, c.sbuName||'—'),
        el('div',{class:'hint'}, c.sbuOneLine)),
      el('div',{}, el('div',{class:'hint'},'主战场（tier1）'),
        el('div',{style:{fontFamily:'var(--font-display)',fontStyle:'normal',fontSize:'16px'}}, c.tier1? c.tier1.name : '— 请在 Work 2 完成'),
        c.tier1 ? el('div',{class:'hint'}, c.targetMarketReason.slice(0,60)) : jump(2)),
      el('div',{}, el('div',{class:'hint'},'观察市场（tier2）'),
        el('div',{class:'mono',style:{fontSize:'12px'}}, (c.tier2||[]).map(t=>t.name).join('、')||'—')),
      el('div',{}, el('div',{class:'hint'},'客户画像'),
        el('div',{class:'mono',style:{fontSize:'12px'}}, c.personas.length+' 位'), jump(1)),
      el('div',{}, el('div',{class:'hint'},'合成调研'),
        el('div',{class:'mono',style:{fontSize:'12px'}}, c.hasSurvey?'已完成':'未完成（评分将用 AI 直评）'), jump(1))
    )
  );
  plate.appendChild(bar);
  if(!c.tier1) plate.appendChild(el('div',{class:'warning'},'尚未读取 Work 2 主战场。请先去 Work 2 完成矩阵选择（或旧版"选择目标市场"）。'));

  // 主按键：AI 起草场景细分（1 单元）
  const {box} = API.aiCtxBox({
    workId:'work3', needs:['sbu','personas','markets'], fewShotKey:'work3.scenarios',
    label: state.work3._scenariosGenerated ? '重新生成场景细分' : 'AI 起草场景细分',
    system:'你是市场研究专家。请把客户画像与使用场景翻译为 3–5 个"目标市场细分场景"（不是产品使用情境），每个场景须：客群规模可估算、痛点可被现有产品功能命中、竞品未垄断心智。为每个场景给需求强度三维分（1–10）：pain 痛点真实度 / willingness 支付意愿 / frequency 决策频率；关联 1–2 个最匹配的画像 id；默认标记 3 个主战场（selected=true）。',
    instruction:()=>{
      const w1 = state.work1;
      return '业务"'+(w1.sbu.name||'')+'"面向目标市场"'+(c.targetMarket||'未定')+'"（观察市场：'+((c.tier2||[]).map(t=>t.name).join('、')||'无')+'）。'
        + '\n画像：' + JSON.stringify(c.personas.map(p=>({id:p.id,name:p.name,region:p.region,painPoints:p.painPoints,values:p.values})))
        + '\n使用场景（Work 1 感知价值矩阵）：' + JSON.stringify((w1.scenarios||[]).map(s=>({id:s.id,name:s.name,personaIds:s.personaIds})))
        + '\nJSON 返回 {"scenarios":[{"name":"","description":"","personaIds":[],"needStrength":{"pain":0,"willingness":0,"frequency":0},"selected":true}]}';
    },
    onResult:(r,raw,mode)=>{
      if(!r?.scenarios?.length){ showToast('AI 未返回场景，已保留原值'); return; }
      // 2026-08-29 重新生成语义：已生成 → 按钮变「重新生成」，点击直接整组替换（不确认）
      state.work3._scenariosGenerated = true;
      state.work3.scenarios = r.scenarios.map(s=>({
        id:uid('sc'), name:(s.name||'').slice(0,24), description:s.description||'',
        personaIds:s.personaIds||[], needStrength:{pain:s.needStrength?.pain||5, willingness:s.needStrength?.willingness||5, frequency:s.needStrength?.frequency||5},
        selected:!!s.selected
      }));
      autosave(); Work3.rerender('scenarios');
    }
  });
  plate.appendChild(box);

  // 场景卡（可编辑）
  const list = el('div',{});
  state.work3.scenarios.forEach((s,i)=>{
    const card = el('div',{class:'card'+(s.selected?' selected':''),style:'margin-bottom:12px'});
    card.appendChild(el('div',{style:{display:'flex',gap:'10px',alignItems:'center'}},
      el('input',{value:s.name,placeholder:'场景名（≤12 字）',style:{flex:1,fontFamily:'var(--font-display)',fontStyle:'normal',fontSize:'18px'},oninput:e=>{s.name=e.target.value;autosave()}}),
      el('label',{class:'ai-settings-check'}, (()=>{const cb=el('input',{type:'checkbox',checked:s.selected});cb.style.width='auto';cb.addEventListener('change',()=>{s.selected=cb.checked;autosave();Work3.rerender('scenarios');});return cb;})(), ' 主战场'),
      el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work3.removeScenario(i,e.currentTarget)},'场景',()=>s.name,i,()=>state.work3.scenarios,x=>x.name),'×')));
    card.appendChild(el('textarea',{rows:2,placeholder:'描述：客群 / 规模 / 痛点命中 / 竞品空档',style:{marginTop:'6px'},oninput:e=>{s.description=e.target.value;autosave()}},s.description));
    // 需求强度三维滑块
    const sliders = el('div',{class:'grid3',style:'margin-top:8px'});
    [['pain','痛点真实度'],['willingness','支付意愿'],['frequency','决策频率']].forEach(([k,lb])=>{
      const wrap = el('div',{class:'field'},el('label',{},lb+' '+s.needStrength[k]),
        el('input',{type:'range',min:1,max:10,value:s.needStrength[k],onchange:e=>{s.needStrength[k]=parseInt(e.target.value);autosave();Work3.rerender('scenarios')}}));
      sliders.appendChild(wrap);
    });
    card.appendChild(sliders);
    // 关联画像多选
    const pRow = el('div',{class:'chip-row',style:'margin-top:8px'});
    state.work3.context.personas.forEach(p=>{
      const on = (s.personaIds||[]).includes(p.id);
      const chip = el('span',{class:'chip'+(on?' maroon':''),style:'cursor:pointer',onclick:()=>{
        const arr=s.personaIds=s.personaIds||[]; const j=arr.indexOf(p.id);
        if(j>=0) arr.splice(j,1); else arr.push(p.id);
        autosave(); Work3.rerender('scenarios');
      }}, p.name);
      pRow.appendChild(chip);
    });
    card.appendChild(pRow);
    list.appendChild(card);
  });
  plate.appendChild(list);
  plate.appendChild(el('button',{onclick:()=>{state.work3.scenarios.push({id:uid('sc'),name:'',description:'',personaIds:[],needStrength:{pain:5,willingness:5,frequency:5},selected:false});autosave();Work3.rerender('scenarios')}},'+ 添加场景'));
};

/* ---------- 2. 卖点挖掘 ---------- */
/* 语料/参数变化后，上次 LDA 结果不再代表当前 corpus；立即失效，避免旧统计/构成被当现状。 */
Work3.invalidateLda = function(){
  const m=state.work3.mining;
  m.ldaResult=null; m.stats=null; m.topics=[]; m.wordFreqTop=[]; m.corpusComposition=null;
  m._simulated=false; m.ldaError=null;
  (m.painMap||[]).forEach(p=>{ p.linkedTopicId=null; });
};
Work3.corpusCounts = function(){
  const m=state.work3.mining, themes=state.work1?.analysis?.openThemes||[];
  const localReal=(m.documents||[]).length, simulated=(m.simulatedDocuments||[]).length;
  const openAvailable=themes.reduce((n,t)=>n+(t.texts||[]).length,0);
  const themesAvailable=themes.reduce((n,t)=>n+(t.themes||[]).length,0);
  const openUsed=m.includeWork1Open?openAvailable:0, themesUsed=m.includeWork1Themes?themesAvailable:0;
  const realUsed=localReal+openUsed+themesUsed, simulatedUsed=m.includeSimulated!==false?simulated:0;
  return {localReal,simulated,openAvailable,themesAvailable,openUsed,themesUsed,realUsed,simulatedUsed,total:realUsed+simulatedUsed};
};
Work3.simulatedStatus = function(){
  const m=state.work3.mining;
  if(!(m.simulatedDocuments||[]).length)return '当前无模拟语料';
  return m.includeSimulated!==false?'模拟语料仍参与建模':'模拟语料未参与建模';
};
Work3.clearCorpus = async function(source,trigger){
  const w=state.work3,m=w.mining,real=(m.documents||[]).length,sim=(m.simulatedDocuments||[]).length;
  if(state.meta?.isDemo||state.meta?.demoCase)return false;
  const local=source==='real',target=local?'本地真实语料':'模拟语料';
  const message=local
    ? `将删除当前 Work3 手动添加或导入的 ${real} 条真实语料。${sim} 条模拟语料会保留，当前${m.includeSimulated!==false?'仍参与建模':'未参与建模'}；Work1 开放题/主题不会删除，仍按各自勾选状态参与建模。`
    : `将删除 ${sim} 条模拟语料；${real} 条本地真实语料会保留。Work1 开放题/主题不会删除，仍按各自勾选状态参与建模。`;
  if(!await Interaction.confirm({title:'清空'+target+'？',message:message+' 旧 LDA 结果将失效，主题关联将清除；此操作不可撤销。',confirmLabel:'清空'+target,trigger}))return false;
  if(w!==state.work3||state.meta?.isDemo||state.meta?.demoCase)return false;
  const key=local?'documents':'simulatedDocuments',count=(m[key]||[]).length;
  m[key]=[]; Work3.invalidateLda(); Work3.deleteChanged('mining');
  const remaining=Work3.corpusCounts();
  showToast(`已清空${target} ${count} 条。剩余本地真实 ${remaining.localReal} 条、模拟 ${remaining.simulated} 条；${Work3.simulatedStatus()}。Work1 开放题/主题保留，仍按各自勾选状态参与建模。`,7000);
  return true;
};
Work3.removeDocument = function(source,index,trigger){
  const local=source==='real',key=local?'documents':'simulatedDocuments',m=state.work3.mining;
  if(index<0||index>=(m[key]||[]).length)return Promise.resolve(false);
  const type=local?'真实语料':'模拟语料',text=String(m[key][index]);
  return Interaction.removeItem({list:()=>state.work3.mining[key],index,type,name:'第 '+(index+1)+' 条',trigger,
    impact:`来源：${local?'Work3 手动添加/导入的本地真实语料':'画像生成的模拟语料'}。文本摘要：「${text.slice(0,100)}${text.length>100?'…':''}」。删除 1 条后旧 LDA 结果将失效，痛点的主题关联将清除；其他语料来源及其纳入勾选保留。`,
    onChange:()=>{Work3.invalidateLda();Work3.deleteChanged('mining');}});
};
Work3.compositionText = function(comp){
  const real=Number(comp?.real)||0,simulated=Number(comp?.simulated)||0,total=real+simulated;
  const percent=n=>total?(n/total*100).toFixed(1):'0.0';
  return `实际建模语料构成：真实 ${real} 条（${percent(real)}%）+ 模拟 ${simulated} 条（${percent(simulated)}%），共 ${total} 条`;
};
Work3.render.mining = function(sec){
  const plate = sec.querySelector('.plate');
  const m=state.work3.mining;

  // 语料输入（同旧版）
  plate.appendChild(el('h4',{},'语料输入'));
  const docsCard=el('div',{class:'plate'});
  const simCount=(m.simulatedDocuments||[]).length;
  const counts=Work3.corpusCounts();
  docsCard.appendChild(el('span',{class:'plate-label'},`本地真实 ${counts.localReal} 条 + 模拟 ${counts.simulated} 条（${Work3.simulatedStatus()}）`));
  docsCard.appendChild(el('p',{class:'hint'},`Work1 上游真实来源：开放题 ${counts.openAvailable} 条（${m.includeWork1Open?'按勾选纳入 '+counts.openUsed+' 条':'未纳入'}）；主题 ${counts.themesAvailable} 条（${m.includeWork1Themes?'按勾选纳入 '+counts.themesUsed+' 条':'未纳入'}）。当前实际纳入真实 ${counts.realUsed} 条 + 模拟 ${counts.simulatedUsed} 条，共 ${counts.total} 条。`));
  const docList=el('div',{style:{maxHeight:'180px',overflow:'auto',marginBottom:'10px'}});
  function renderDocs(){
    docList.innerHTML='';
    m.documents.slice(0,50).forEach((d,i)=>{
      docList.appendChild(el('div',{style:{display:'flex',gap:'8px','align-items':'flex-start',padding:'4px 0',borderBottom:'1px solid var(--color-rule)'}},
        el('span',{class:'mono',style:{'font-size':'11px',color:'var(--color-ink-2)','min-width':'28px'}}, '#'+(i+1)),
        el('div',{style:{flex:1,'font-size':'13px'}}, d.slice(0,180)+(d.length>180?'…':'')),
        el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work3.removeDocument('real',i,e.currentTarget)},'真实语料','第 '+(i+1)+' 条',i,()=>m.documents),'×')));
    });
    if(m.documents.length>50) docList.appendChild(el('p',{class:'hint'},`还有 ${m.documents.length-50} 条未显示`));
  }
  renderDocs();
  docsCard.appendChild(docList);
  const paste=el('textarea',{rows:4,placeholder:'粘贴评论/访谈/工单，每行一条或空行分隔…'});
  docsCard.appendChild(paste);
  docsCard.appendChild(el('div',{class:'ai-actions',style:{'margin-top':'8px'}},
    el('button',{onclick:()=>{
      const lines=paste.value.split(/\n\s*\n|\n/).map(s=>s.trim()).filter(Boolean);
      m.documents.push(...lines); paste.value=''; Work3.invalidateLda(); autosave(); Work3.rerender('mining');
    }},'添加到语料'),
    el('label',{class:'ghost',title: backendOnline ? '' : '需要启动本地服务才可导入，当前不可用',
      style:{display:'inline-flex',alignItems:'center',gap:'6px',cursor: backendOnline ? 'pointer' : 'not-allowed',opacity: backendOnline ? 1 : .5,'font-family':'var(--font-mono)','font-size':'11px','letter-spacing':'.15em','padding':'9px 16px'}},
      backendOnline ? '导入 Excel/CSV' : '导入 Excel/CSV（需本地服务）',
      el('input',{type:'file',accept:'.xlsx,.xls,.csv,.txt',style:{display:'none'},onchange:e=>Work3.importExcel(e.target.files[0],renderDocs)})
    ),
    el('button',{class:'ghost danger',onclick:e=>Work3.clearCorpus('real',e.currentTarget)},'清空本地真实语料')
  ));
  plate.appendChild(docsCard);

  // 模拟语料生成（2026-08-29 共识：真实 <3 补足；足量后作补充参与建模，可勾选退出）
  const simGen = el('div',{class:'ai-box',style:{margin:'12px 0 0'}});
  const simMid = el('div',{class:'ai-box-mid'});
  if(counts.total<3) simMid.appendChild(el('p',{class:'hint',style:{margin:'0 0 8px'}},`当前纳入真实 ${counts.realUsed} 条、模拟 ${counts.simulatedUsed} 条，共 ${counts.total} 条，不足 3 条：可生成模拟语料补足后建模，模拟产出会全程标注。`));
  const simBtn = el('button',{class:'primary'}, simCount?'重新生成模拟语料':'生成模拟语料（基于画像）');
  simMid.appendChild(simBtn);
  simMid.appendChild(el('label',{style:{display:'flex',gap:'6px','align-items':'center','font-family':'var(--font-body)','text-transform':'none','letter-spacing':0,'font-size':'13px','margin-top':'6px'}},
    el('input',{type:'checkbox',checked:m.includeNegative!==false,onchange:e=>{m.includeNegative=e.target.checked;autosave();}}),
    '语料包含负面反馈/抱怨（默认勾选，支撑痛点证据）'));
  const simHandle = (typeof AiContext!=='undefined')
    ? AiContext.mountSettings(simMid,{workId:'work3', needs:['sbu','personas','scenarios','valueFramework'],
        preview:()=>({system:'你是市场研究助手…', instruction:'画像 + 场景 + 价值体系 → ≥9 条模拟语料'})})
    : {current:()=>({sections:['sbu','personas','scenarios','valueFramework']})};
  simBtn.addEventListener('click', ()=>Work3.generateSimulatedDocs(simBtn, simMid, simHandle.current()));
  simGen.appendChild(simMid);
  plate.appendChild(simGen);

  // 模拟语料卡（独立存放，标注「模拟」，可单删/清空/勾选是否参与建模）
  if(simCount){
    const simCard=el('div',{class:'plate',style:{marginTop:'10px'}});
    const head=el('div',{style:{display:'flex',gap:'8px','align-items':'center',flexWrap:'wrap'}});
    head.appendChild(el('span',{class:'plate-label'},`模拟语料（画像生成 ${simCount} 条）`));
    head.appendChild(el('span',{class:'tag'},'模拟'));
    head.appendChild(el('label',{style:{display:'flex',gap:'6px','align-items':'center','font-family':'var(--font-body)','text-transform':'none','letter-spacing':0,'font-size':'13px'}},
      el('input',{type:'checkbox',checked:m.includeSimulated!==false,onchange:e=>{m.includeSimulated=e.target.checked;Work3.invalidateLda();autosave();Work3.rerender('mining');}}),
      '建模时包含模拟语料（默认勾选，可取消）'));
    head.appendChild(el('button',{class:'ghost small danger',onclick:e=>Work3.clearCorpus('simulated',e.currentTarget)},'清空模拟语料'));
    simCard.appendChild(head);
    const simList=el('div',{style:{maxHeight:'180px',overflow:'auto',marginBottom:'10px'}});
    m.simulatedDocuments.slice(0,50).forEach((d,i)=>{
      simList.appendChild(el('div',{style:{display:'flex',gap:'8px','align-items':'flex-start',padding:'4px 0',borderBottom:'1px solid var(--color-rule)'}},
        el('span',{class:'mono',style:{'font-size':'11px',color:'var(--color-ink-2)','min-width':'28px'}}, '#'+(i+1)),
        el('div',{style:{flex:1,'font-size':'13px'}}, d.slice(0,180)+(d.length>180?'…':'')),
        el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work3.removeDocument('simulated',i,e.currentTarget)},'模拟语料','第 '+(i+1)+' 条',i,()=>m.simulatedDocuments),'×')));
    });
    if(m.simulatedDocuments.length>50) simList.appendChild(el('p',{class:'hint'},`还有 ${m.simulatedDocuments.length-50} 条未显示`));
    simCard.appendChild(simList);
    plate.appendChild(simCard);
  }

  // 包含 Work 1 勾选 + LDA 参数（折叠高级区）
  const inc1=el('label',{style:{display:'flex',gap:'8px','align-items':'center','font-family':'var(--font-body)','text-transform':'none','letter-spacing':0}},
    el('input',{type:'checkbox',checked:m.includeWork1Open,onchange:e=>{m.includeWork1Open=e.target.checked;Work3.invalidateLda();autosave();Work3.rerender('mining')}}),
    '包含 Work 1 开放题答案');
  const inc2=el('label',{style:{display:'flex',gap:'8px','align-items':'center','font-family':'var(--font-body)','text-transform':'none','letter-spacing':0}},
    el('input',{type:'checkbox',checked:m.includeWork1Themes,onchange:e=>{m.includeWork1Themes=e.target.checked;Work3.invalidateLda();autosave();Work3.rerender('mining')}}),
    '包含 Work 1 主题文本');
  plate.appendChild(el('div',{class:'row',style:{'max-width':'560px'}}, inc1, inc2));

  const adv = el('details',{style:'margin:10px 0'});
  adv.appendChild(el('summary',{class:'hint',style:'cursor:pointer'},'LDA 高级参数'));
  const p=m.ldaParams;
  adv.appendChild(el('div',{class:'grid4'},
    UI.field('K 主题数', el('input',{type:'number',min:2,max:15,value:p.k,oninput:e=>{p.k=parseInt(e.target.value);Work3.invalidateLda();autosave()}})),
    UI.field('passes', el('input',{type:'number',min:1,max:50,value:p.passes,oninput:e=>{p.passes=parseInt(e.target.value);Work3.invalidateLda();autosave()}})),
    UI.field('iterations', el('input',{type:'number',min:10,max:500,value:p.iterations,oninput:e=>{p.iterations=parseInt(e.target.value);Work3.invalidateLda();autosave()}})),
    UI.field('no_below', el('input',{type:'number',min:1,max:20,value:p.no_below,oninput:e=>{p.no_below=parseInt(e.target.value);Work3.invalidateLda();autosave()}}))
  ));
  adv.appendChild(UI.field('no_above', el('input',{type:'number',min:0.1,max:1,step:0.05,value:p.no_above,oninput:e=>{p.no_above=parseFloat(e.target.value);Work3.invalidateLda();autosave()}})));
  plate.appendChild(adv);

  // 主按键：AI 起草痛点地图（2 单元流水线：确保主题 → 痛点地图）
  const aiBox = el('div',{class:'ai-box'});
  const mid = el('div',{class:'ai-box-mid'});
  const painBtn = el('button',{class:'primary'}, state.work3._painMapGenerated ? '重新生成痛点地图' : 'AI 起草痛点地图');
  mid.appendChild(painBtn);
  const handle = (typeof AiContext!=='undefined')
    ? AiContext.mountSettings(mid,{workId:'work3', needs:['sbu','personas','scenarios'], fewShotKey:'work3.painmap',
        preview:()=>({system:'你是用户研究专家…', instruction:'主题 + 语料 → 6-10 条痛点/痒点'})})
    : {current:()=>({sections:['sbu','personas','scenarios'], fewShot:'work3.painmap'})};
  painBtn.addEventListener('click', ()=>Work3.runPainPipeline(painBtn, mid, handle.current()));
  aiBox.appendChild(mid);
  plate.appendChild(aiBox);

  if(m.ldaError) plate.appendChild(el('div',{class:'warning'},m.ldaError));

  // LDA 结果区（只读呈现）
  if(m.stats){
    plate.appendChild(el('hr',{class:'rule'}));
    plate.appendChild(el('h4',{},'LDA 结果'));
    if(m.corpusComposition)plate.appendChild(el('p',{class:'hint'},Work3.compositionText(m.corpusComposition)));
    if(m._simulated || (m.corpusComposition && m.corpusComposition.simulated>0)){
      const badges=el('div',{style:{display:'flex',gap:'8px','align-items':'center',margin:'0 0 10px',flexWrap:'wrap'}});
      if(m._simulated) badges.appendChild(el('span',{class:'tag'},'模拟建模（LLM）'));
      if(m.corpusComposition && m.corpusComposition.simulated>0) badges.appendChild(el('span',{class:'tag'},`含模拟语料 ${m.corpusComposition.simulated} 条`));
      plate.appendChild(badges);
    }
    const st=el('div',{class:'grid4'});
    [['原始文档',m.stats.raw_count],['有效文档',m.stats.valid_count],['总词数',m.stats.total_words],['词典大小',m.stats.vocab_size]].forEach(([k,v])=>{
      st.appendChild(el('div',{class:'card',style:{padding:'12px'}},
        el('div',{class:'hint'},k),
        el('div',{class:'mono',style:{'font-size':'22px','color':'var(--color-accent)'}}, v ?? '—')));
    });
    if(m.stats.coherence!=null) st.appendChild(el('div',{class:'card',style:{padding:'12px'}},
      el('div',{class:'hint'},'Coherence c_v'),
      el('div',{class:'mono',style:{'font-size':'22px','color':'var(--color-accent)'}}, m.stats.coherence)));
    plate.appendChild(st);
    if(m.wordFreqTop && m.wordFreqTop.length){
      plate.appendChild(el('h5',{},'Top 25 高频词'));
      const wf=el('section',{class:'plate'}, el('span',{class:'plate-label'},'F5 · TICK ROWS · 词频'));
      renderBarChart(wf, m.wordFreqTop.slice(0,15).map(w=>({label:w.word,value:w.count})),{});
      plate.appendChild(wf);
    }
    plate.appendChild(el('h5',{},`${m.topics.length} 个主题`));
    Work3.markEvidenceSources(m.topics,Work3.collectDocsLabeled()).forEach(t=>{
      const card=el('div',{class:'card',style:{'margin-bottom':'12px'}});
      card.appendChild(el('div',{},
        el('input',{type:'text',value:t.label||('主题 '+(t.id+1)),oninput:e=>{t.label=e.target.value;autosave()},
          style:{'font-family':'var(--font-display)','font-style':'normal','font-size':'18px','border-bottom':'1px solid var(--color-rule)'}},),
        el('span',{class:'tag',style:{'margin-left':'8px'}}, '占比 '+t.share+'%')));
      const kw=el('div',{class:'chip-row',style:{'margin-top':'8px'}});
      t.keywords.slice(0,10).forEach(k=>kw.appendChild(el('span',{class:'chip'}, k.word+' '+Math.round(k.weight*100))));
      card.appendChild(kw);
      if(t.representative_docs && t.representative_docs.length){
        const ex=el('details',{style:{'margin-top':'8px'}});
        ex.appendChild(el('summary',{class:'hint'},'代表性文档'));
        t.representative_docs.forEach(d=>ex.appendChild(el('p',{class:'quote'},d)));
        card.appendChild(ex);
      }
      plate.appendChild(card);
    });
  }

  // 痛点地图表（新增场景列）
  plate.appendChild(el('hr',{class:'rule'}));
  plate.appendChild(el('h4',{},'痛点地图'));
  if(m.painMap.length){
    const table=el('div',{class:'table-wrap'});
    const t=el('table',{class:'data'});
    t.innerHTML='<thead><tr><th style="width:20%">痛点/痒点</th><th>证据</th><th style="width:9%">频次</th><th style="width:9%">类型</th><th style="width:14%">场景</th><th>对应需求</th><th style="width:44px"></th></tr></thead>';
    const tb=el('tbody');
    m.painMap.forEach((p,i)=>{
      const tr=el('tr');
      tr.appendChild(el('td',{},el('input',{value:p.pain,oninput:e=>{p.pain=e.target.value;autosave()}})));
      tr.appendChild(el('td',{},el('textarea',{rows:1,oninput:e=>{p.evidence=e.target.value;autosave()}},p.evidence)));
      tr.appendChild(el('td',{},el('select',{onchange:e=>{p.frequency=e.target.value;autosave()}},
        ...['高','中','低'].map(v=>{const o=el('option',{value:v},v);if(p.frequency===v)o.selected=true;return o;}))));
      tr.appendChild(el('td',{},el('select',{onchange:e=>{p.type=e.target.value;autosave()}},
        ...['痛点','痒点'].map(v=>{const o=el('option',{value:v},v);if(p.type===v)o.selected=true;return o;}))));
      tr.appendChild(el('td',{},Work3.scenarioSelect(p.scenarioId, v=>{p.scenarioId=v;autosave();})));
      const needs=UI.tagsInput(()=>p.linkedNeeds||[], '输入后回车添加', next=>{p.linkedNeeds=next;autosave();});
      needs.el.querySelector('input').addEventListener('blur',()=>{p.linkedNeeds=needs.get();autosave()});
      needs.el.style.fontSize='11px';
      tr.appendChild(el('td',{},needs.el));
      tr.appendChild(el('td',{},el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work3.removePain(i,e.currentTarget)},'痛点',()=>p.pain,i,()=>m.painMap,x=>x.pain),'×')));
      tb.appendChild(tr);
    });
    t.appendChild(tb);table.appendChild(t);plate.appendChild(table);
  }
  plate.appendChild(el('button',{onclick:()=>{m.painMap.push({id:uid('pain'),pain:'',evidence:'',frequency:'中',linkedNeeds:[],type:'痛点',scenarioId:''});autosave();Work3.rerender('mining')}},'+ 添加痛点'));
};

/* 场景下拉（可留空）：卖点表 / 痛点表共用 */
Work3.scenarioSelect = function(value, onChange){
  const sel=el('select',{style:{fontSize:'12px'}});
  sel.appendChild(el('option',{value:''},'—'));
  state.work3.scenarios.forEach(s=>{
    const o=el('option',{value:s.id}, s.name||'未命名'); if(value===s.id) o.selected=true; sel.appendChild(o);
  });
  if(value && !state.work3.scenarios.some(s=>s.id===value)){
    const o=el('option',{value},'(已删除场景)'); o.selected=true; sel.appendChild(o);
  }
  sel.addEventListener('change',()=>onChange(sel.value));
  return sel;
};
Work3.scenarioName = function(id){
  const s=(state.work3.scenarios||[]).find(x=>x.id===id);
  return s ? s.name : '';
};

/* ---------- 卖点 ↔ 痛点关联 ----------
   卖点用 painId 关联痛点地图条目（AI 起草直接带 id）；
   老数据/手动输入只有文本时，用 resolvePainId 模糊匹配兜底。
   用户始终可以改（下拉选择 / 自定义输入）。 */
Work3.painById = function(id){
  return (state.work3.mining.painMap||[]).find(p=>p.id===id) || null;
};
Work3.resolvePainId = function(text, strict){
  const pm = state.work3.mining.painMap||[];
  const t = String(text||'').trim();
  if(!t || !pm.length) return '';
  const norm = s => String(s||'').replace(/[\s，。！？、；：""''（）()\-—·,.]/g,'');
  const nt = norm(t);
  // 1) 精确（id 或去空白标点后的文本）
  const exact = pm.find(p=>p.id===nt || norm(p.pain)===nt);
  if(exact) return exact.id;
  // 2) 包含
  const inc = pm.find(p=>{ const np=norm(p.pain); return np && (np.includes(nt) || nt.includes(np)); });
  if(inc) return inc.id;
  // 3) 2-gram 重合度最高（阈值 0.45）——仅宽松档：strict=true 时禁用
  //    （2026-09-01 grilling：写 painId/证据的"绑定"动作只认精确/包含，
  //    低置信绑错痛点比空着更糟；宽松档仅用于渲染层下拉建议）。
  if(strict) return '';
  const grams = s => { const a=[]; for(let i=0;i+1<s.length;i++) a.push(s.slice(i,i+2)); return a; };
  const tg = new Set(grams(nt));
  let best=null, bestScore=0;
  pm.forEach(p=>{
    const pg = grams(norm(p.pain)); if(!pg.length) return;
    let inter=0; const seen=new Set();
    pg.forEach(g=>{ if(tg.has(g) && !seen.has(g)){ inter++; seen.add(g); } });
    const score = inter / Math.max(1, Math.min(tg.size, pg.length));
    if(score>bestScore){ bestScore=score; best=p; }
  });
  return best && bestScore>=0.45 ? best.id : '';
};
/* 渲染用：候选卖点当前应显示哪个下拉值（painId 优先，文本兜底，否则自定义/空） */
Work3.candidatePainValue = function(c){
  const pm = state.work3.mining.painMap||[];
  if(c.painId && pm.some(p=>p.id===c.painId)) return c.painId;
  if((c.pain||'').trim()){
    const hit = Work3.resolvePainId(c.pain);
    if(hit) return hit;
    return '__custom';
  }
  return '';
};

Work3.importExcel = async function(file, renderDocs){
  const m=state.work3.mining;
  try{
    let result;
    if(backendOnline){
      result=await Backend.parseExcel(file);
    }else{
      showToast('本地服务未连接，Excel 导入不可用');
      return;
    }
    const col = result.suggested_text_column || result.columns[0];
    const texts = result.rows.map(r=>String(r[col]||'')).filter(t=>t.trim().length>10);
    if(confirm(`将导入 ${texts.length} 条文本（列：${col}），是否继续？`)){
      m.documents.push(...texts);
      Work3.invalidateLda();
      autosave(); Work3.rerender('mining');
      showToast('已导入 '+texts.length+' 条');
    }
  }catch(e){ showToast('导入失败: '+e.message); }
};

/* 「生成模拟语料（基于画像）」（2026-08-29 共识）：
   真实语料 <3 时补足到可运行；足量后也可作为补充继续参与建模。
   传输路径：AiContext sections = sbu/personas/scenarios/valueFramework。 */
Work3.simSystemPrompt = function(){
  const m=state.work3.mining;
  const parts = [
    '你是市场研究助手。基于上游上下文（SBU、客户画像、场景细分、价值体系），生成模拟语料：客户评论、访谈或工单文本。',
    '每条第一人称、口语化，贴合画像原话风格；覆盖画像的痛点与价值观；尽量落在已选场景上。',
    '每个画像至少 3 条，总量不少于 9 条。',
    '输出 JSON: {"documents":["文本1","文本2"]}'
  ];
  if(m.includeNegative !== false){
    parts.push('至少一半语料必须是负面/抱怨/吐槽：未满足的需求、失败体验、不满、犹豫、对比竞品后的失望、不推荐的理由；其余可为正面或中性体验，但整批不得写成种草文。');
    parts.push('画像原话（quote）表达的是期望，不是真实好评；负面语料用现在时写「仍在困扰/仍未解决」，不要写「以前痛、现在换了就好了」的推荐腔。');
  }
  if(m.documents.length) parts.push('下面是用户已有真实语料，仅作风格种子（不要照抄原文）：');
  return parts.join('\n');
};
Work3.simUserPrompt = function(){
  const m=state.work3.mining;
  return m.documents.length
    ? '真实语料种子:\n'+m.documents.slice(0,10).map((d,i)=>`${i+1}. ${d.slice(0,150)}`).join('\n')
    : '（无真实语料，直接基于画像与场景生成）';
};
Work3.generateSimulatedDocs = async function(btn, container, cfg){
  const workspace=state,m=state.work3.mining;
  const isCurrent=()=>state===workspace && state.work3.mining===m && !(state.meta?.isDemo||state.meta?.demoCase);
  if(!isCurrent())return false;
  const useManual = state.settings.manualMode || !API.config().apiKey;
  const apply = (r)=>{
    if(!isCurrent())return false;
    const list = (Array.isArray(r?.documents)?r.documents:[])
      .map(x=>typeof x==='string'?x:(x?.text||'')).map(s=>String(s).trim()).filter(s=>s.length>3);
    if(!list.length){ showToast('生成失败：未解析到模拟语料'); return false; }
    m.simulatedDocuments = list;
    Work3.invalidateLda();
    autosave();
    Work3.rerender('mining');
    showToast('已生成模拟语料 '+list.length+' 条（标注「模拟」）');
    return true;
  };
  const system = Work3.simSystemPrompt();
  const user = Work3.simUserPrompt();
  if(useManual){
    API.manualBox(container, system + '\n\n' + user, apply, {title:'生成模拟语料（基于画像）'});
    return;
  }
  const task=Runner.start({id:'work3-simulated-corpus',label:'模拟语料',button:btn,pausable:false});
  if(!task)return false;
  try{
    const messages = AiContext.buildPrompt({
      workId:'work3', sections:(cfg?.sections||['sbu','personas','scenarios','valueFramework']),
      system, instruction:user
    });
    const r = await API.callJson(messages,{signal:task.controller.signal});
    if(task.aborted || !isCurrent())return false;
    return apply(r);
  }catch(e){
    if(isCurrent())showToast(task.aborted||e?.name==='AbortError'?'已中止':'生成模拟语料失败: '+e.message);
    return false;
  }finally{
    if(Runner.current===task)Runner.finish();
    if(isCurrent() && btn){btn.textContent=m.simulatedDocuments.length?'重新生成模拟语料':'生成模拟语料（基于画像）';}
  }
};

/* 收集 LDA 语料（本地粘贴/导入 + Work 1 按勾选 + 模拟语料按 includeSimulated 并入） */
Work3.collectDocs = function(){
  return Work3.collectDocsLabeled().map(x=>x.text);
};

/* 带来源标注的建模语料：[{text, source:'真实'|'模拟'}]。
   真实 = 粘贴/导入 + Work 1 开放题/主题（按勾选）；模拟 = 画像生成（按 includeSimulated）。 */
Work3.collectDocsLabeled = function(){
  const m=state.work3.mining;
  const themes=state.work1?.analysis?.openThemes||[];
  const out=[];
  (m.documents||[]).forEach(t=>out.push({text:t, source:'真实'}));
  if(m.includeWork1Open){
    themes.forEach(ot=>(ot.texts||[]).forEach(t=>out.push({text:t, source:'真实'})));
  }
  if(m.includeWork1Themes){
    themes.forEach(ot=>{
      (ot.themes||[]).forEach(t=>out.push({text:t.label+' '+(ot.question||''), source:'真实'}));
    });
  }
  if(m.includeSimulated!==false && (m.simulatedDocuments||[]).length){
    m.simulatedDocuments.forEach(t=>out.push({text:t, source:'模拟'}));
  }
  return out;
};

/* 代表文档只按本次原文精确匹配来源；生成的改写文本不冒认真实证据。 */
Work3.markEvidenceSources = function(topics,labeled){
  return (topics||[]).map(t=>({...t,representative_docs:(t.representative_docs||[]).map(value=>{
    const text=String(value??'');
    const body=text.replace(/^\[(真实|模拟|真实\/模拟|来源待核对)\]\s*/,'');
    const exact=(labeled||[]).filter(d=>String(d.text)===text);
    const matches=exact.length?exact:(labeled||[]).filter(d=>String(d.text)===body);
    const sources=[...new Set(matches.map(d=>d.source))];
    return '['+(sources.length?sources.join('/'):'来源待核对')+'] '+(exact.length?text:body);
  })}));
};

Work3.runLDA = async function(btn, silent, taskHandle){
  const workspace=state,m=state.work3.mining;
  const isCurrent=()=>state===workspace && state.work3.mining===m && !(state.meta?.isDemo||state.meta?.demoCase);
  if(!isCurrent())return false;
  const docs = Work3.collectDocs();
  if(docs.length<3){ showToast('语料不足 3 条：请提交真实语料，或先生成模拟语料补足'); return false; }
  const labeled = Work3.collectDocsLabeled();
  const simUsed = labeled.filter(x=>x.source==='模拟').length;
  const params={...m.ldaParams},inputStamp=JSON.stringify([labeled,params]),useBackend=!!backendOnline;
  const ownsTask=!taskHandle;
  const task=taskHandle || Runner.start({id:'work3-lda',label:'主题建模',button:btn,pausable:false});
  if(!task || task.aborted || (taskHandle && Runner.current!==taskHandle))return false;
  const inputsCurrent=()=>isCurrent() && inputStamp===JSON.stringify([Work3.collectDocsLabeled(),m.ldaParams]);
  Work3.invalidateLda();
  autosave();
  try{
    let result;
    if(useBackend){
      result=await Backend.lda(docs, params,{signal:task.controller.signal});
    }else{
      result=await Work3.llmLdaSim(docs, params.k,task.controller.signal);
    }
    if(task.aborted || !isCurrent())return false;
    if(!inputsCurrent()){showToast('语料或建模参数已变化，未应用旧结果；请重新运行建模');return false;}
    if(!result || typeof result!=='object')throw new Error('主题建模未返回有效结果');
    m._simulated = !useBackend;
    if(result.error){
      Work3.invalidateLda();
      m.ldaError=result.error;
    } else{
      m.ldaError=null;
      m.stats=result.stats;
      m.topics=Work3.markEvidenceSources(result.topics,labeled);
      m.wordFreqTop=result.word_freq_top;
      m.corpusComposition = { real: labeled.length - simUsed, simulated: simUsed, total: docs.length };
    }
    autosave();
    return !result.error;
  }catch(e){
    if(task.aborted || e?.name==='AbortError' || !inputsCurrent())return false;
    Work3.invalidateLda();
    m.ldaError=e.message;
    autosave();
    return false;
  }
  finally{if(ownsTask && Runner.current===task)Runner.finish();}
};

Work3.llmLdaSim = async function(docs, k, signal){
  const sys=`你是 LDA 主题建模模拟器。对给定的 ${docs.length} 条文档，模拟出 ${k} 个主题。输出 JSON: {"stats":{"raw_count":${docs.length},"valid_count":${docs.length},"total_words":0,"vocab_size":0,"coherence":0.5},"topics":[{"id":0,"label":"","share":20,"keywords":[{"word":"","weight":0.02}],"representative_docs":[""]}],"word_freq_top":[{"word":"","count":10}]}`;
  const sample=docs.slice(0,30).map((d,i)=>`${i+1}. ${d.slice(0,150)}`).join('\n');
  const r=await API.callJson([{role:'system',content:sys},{role:'user',content:sample}],{signal});
  if(!r) throw new Error('LLM 模拟返回空');
  r.topics=(r.topics||[]).slice(0,k).map((t,i)=>({id:i,label:t.label||'',share:t.share||Math.round(100/k),keywords:(t.keywords||[]).slice(0,12),representative_docs:(t.representative_docs||[]).slice(0,3)}));
  r.word_freq_top=r.word_freq_top||[];
  return r;
};

/* 「AI 起草痛点地图」2 单元流水线：A 确保主题（有则跳过）→ B 痛点地图（主题名内联生成） */
Work3.painPrompt = function(withTopics){
  const m=state.work3.mining;
  const c=state.work3.context;
  const topicsInfo = m.topics.map(t=>({id:t.id,label:t.label,keywords:t.keywords.map(k=>k.word),docs:t.representative_docs}));
  const scenariosList = state.work3.scenarios.map(s=>({id:s.id,name:s.name}));
  const parts = [];
  parts.push('你是用户研究专家。基于 LDA 主题与原始语料，提炼 6-10 条痛点/痒点。区分"痛点"（必须解决）和"痒点"（加分项）。');
  if(!withTopics) parts.push('语料尚未建模：请先模拟 '+state.work3.mining.ldaParams.k+' 个主题（含关键词），再为每个主题命名（4-8 字中文），最后输出痛点地图。');
  else parts.push('同时为尚未命名的主题（label 为空）生成 4-8 字中文名。');
  parts.push('每条痛点关联一个场景 id（可为空字符串）。');
  parts.push('痛点必须来自用户的负面体验或未满足的需求；evidence 优先摘录负面/抱怨语料的原文，样例前缀 [真实]/[模拟] 表示来源，摘录时保持来源一致。');
  parts.push('输出 JSON: {"topics":[{"id":0,"label":""}],"pains":[{"pain":"","evidence":"原文摘录","frequency":"高|中|低","linkedNeeds":[""],"linkedTopicId":0,"type":"痛点|痒点","scenarioId":""}]}');
  const labeled = Work3.collectDocsLabeled();
  const simCount = labeled.filter(x=>x.source==='模拟').length;
  const sample = labeled.slice(0,30).map((x,i)=>`${i+1}. [${x.source}] ${x.text.slice(0,200)}`).join('\n');
  const user = `SBU:${state.work1.sbu.name}\n目标市场:${c.targetMarket}\n场景候选:${JSON.stringify(scenariosList)}\nLDA 主题:${JSON.stringify(topicsInfo,null,2)}\n\n语料构成：真实 ${labeled.length-simCount} 条 + 模拟 ${simCount} 条${simCount?'（画像生成）':''}\n\n语料样例:\n${sample || '（当前无语料，请基于画像与场景模拟典型用户发言）'}`;
  return { system: parts.join('\n'), user };
};

Work3.runPainPipeline = async function(btn, container, cfg){
  const m=state.work3.mining;
  const useManual = state.settings.manualMode || !API.config().apiKey;
  // 手动模式：有主题 → 痛点地图提示词；无 → 合并提示词（模拟+命名+痛点一次输出）
  if(useManual){
    const p = Work3.painPrompt(m.topics.length>0);
    const full = p.system + '\n\n' + p.user;
    API.manualBox(container, full, (parsed)=>{
      if(parsed) Work3.applyPainResult(parsed);
    }, {title:'AI 起草痛点地图'});
    return;
  }
  // 2026-08-29 重新生成语义：已生成 → 直接替换痛点地图（不确认）；主题保留为建模输入
  const task=Runner.start({id:'work3-pain', label:'AI 起草痛点地图', button:btn, total:2, pausable:true});
  if(!task) return;
  try{
    // 单元 A：确保主题（已有则跳过；否则真跑 /api/lda，后端未连接用 LLM 模拟）
    if(!m.topics.length){
      const docs = Work3.collectDocs();
      if(docs.length<3){ Runner.finish(); showToast('语料不足 3 条：请提交真实语料，或先生成模拟语料补足'); return; }
      const ok = await Work3.runLDA(null,false,task);
      if(!ok || task.aborted){ if(!task.aborted) showToast('主题建模失败'); Runner.finish(); Work3.rerender('mining'); return; }
    }
    task.done=1; Runner.renderUI();
    await Runner.checkpoint();
    // 单元 B：痛点地图（主题命名内联进本次调用）
    const p = Work3.painPrompt(m.topics.length>0);
    const messages = AiContext.buildPrompt({
      workId:'work3', sections:(cfg?.sections||['sbu','personas','scenarios']),
      system:p.system, instruction:p.user, fewShot:cfg?.fewShot
    });
    const r = await API.callJson(messages, {signal:Runner.signal()});
    if(task.aborted) return;
    Work3.applyPainResult(r);
    task.done=2; Runner.renderUI();
    showToast('痛点地图已起草');
  }catch(e){
    if(!(task.aborted || (e&&e.name==='AbortError'))){
      showToast('痛点地图失败: '+e.message);
      // 降级手动箱
      Runner.finish();
      const p = Work3.painPrompt(m.topics.length>0);
      API.manualBox(container, p.system + '\n\n' + p.user, (parsed)=>{ if(parsed) Work3.applyPainResult(parsed); }, {title:'AI 起草痛点地图（手动）'});
      return;
    }
  }finally{
    Runner.finish();
    Work3.rerender('mining');
  }
};

Work3.applyPainResult = function(r){
  const m=state.work3.mining;
  if(!r) return;
  // 主题命名回填（内联生成）
  (r.topics||[]).forEach(nt=>{
    const t=m.topics.find(x=>x.id===nt.id);
    if(t && nt.label) t.label=nt.label;
  });
  // 模拟主题（无建模时的整包输出）
  if(!m.topics.length && Array.isArray(r.topics) && r.topics.length){
    m.topics = r.topics.map((t,i)=>({id:t.id??i,label:t.label||('主题 '+(i+1)),share:t.share||Math.round(100/r.topics.length),keywords:(t.keywords||[]).map(k=>typeof k==='string'?{word:k,weight:0.05}:k),representative_docs:t.representative_docs||[]}));
  }
  if(r.pains){
    state.work3._painMapGenerated = true;
    m.painMap = r.pains.map(p=>({id:uid('pain'),pain:p.pain||'',evidence:p.evidence||'',frequency:p.frequency||'中',linkedNeeds:p.linkedNeeds||[],linkedTopicId:p.linkedTopicId,type:p.type||'痛点',scenarioId: state.work3.scenarios.some(s=>s.id===p.scenarioId)? p.scenarioId : ''}));
  }
  autosave();
};

/* ---------- 3. 备选卖点 ---------- */
/* 痛点绑定归一（2026-09-01 grilling 决策 2-B，AI 新生成与存量自愈共用）：
   pain 字段是幻觉 id（形如 pain_xxx 且不在地图）→ 清空（无信息量）；
   painId 命中地图 → pain 以地图原文为准（不信任 AI 转述），evidence 为空时带入痛点证据；
   绑不上 → pain 原样保留（低置信绝不自动绑——绑错痛点比空着更糟）。 */
Work3.resolvePainBinding = function(c){
  let pain=(c.pain||'').trim();
  if(/^pain_[a-z0-9]+$/i.test(pain) && !Work3.painById(pain)) pain='';
  const painId=(c.painId && Work3.painById(c.painId)) ? c.painId : Work3.resolvePainId(pain, true);
  const p=painId?Work3.painById(painId):null;
  if(p) pain=p.pain;
  let evidence=(c.evidence||'').trim();
  if(!evidence && p && (p.evidence||'').trim()) evidence=p.evidence;
  return {painId, pain, evidence};
};

/* 存量候选痛点绑定自愈（决策 1-B，幂等）：已正确绑定的行不动；其余行走
   resolvePainBinding（幻觉 id 清空 / 精确·包含高置信重绑 / 证据带入）。
   绝不碰 desirabilityScores/selected/scenarioId/description。 */
Work3.healCandidatesPain = function(){
  let changed=false;
  (state.work3.candidates||[]).forEach(c=>{
    if(c.painId && Work3.painById(c.painId)) return;   // 已正确绑定，不动
    const before={painId:c.painId||'', pain:c.pain||'', evidence:c.evidence||''};
    const b=Work3.resolvePainBinding(c);
    if(b.painId!==before.painId || b.pain!==before.pain || b.evidence!==before.evidence){
      c.painId=b.painId; c.pain=b.pain; c.evidence=b.evidence; changed=true;
    }
  });
  if(changed) autosave();
  return changed;
};

Work3.render.candidates = function(sec){
  const plate = sec.querySelector('.plate');
  Work3.healCandidatesPain();
  const cs=state.work3.candidates;

  // 主按键：AI 起草备选卖点（1 单元）
  const {box} = API.aiCtxBox({
    workId:'work3', needs:['sbu','personas','scenarios','painMap','valueFramework'], fewShotKey:'work3.candidates',
    label: cs.some(c=>(c.name||'').trim()) ? '重新生成备选卖点' : 'AI 起草备选卖点',
    system:'你是产品策略专家。基于痛点地图生成 8-12 个备选卖点。每个卖点必须绑定一个痛点（painId 取自下方痛点地图列表，不得编造）；证据可沿用该痛点的 evidence，或给出语料摘录/量化统计。关联场景（可为空字符串）。',
    instruction:()=>`SBU:${state.work1.sbu.name}\n目标市场:${state.work3.context.targetMarket}\n价值框架:${state.work3.context.valueFramework.join('/')}\n场景:${JSON.stringify(state.work3.scenarios.map(s=>({id:s.id,name:s.name})))}\n痛点地图:\n${state.work3.mining.painMap.map(p=>'- ['+p.id+'] '+p.pain+' ('+p.type+'): '+p.evidence).join('\n')}\n输出: {"candidates":[{"name":"","painId":"<上方痛点地图的 id，无法对应时留空>","pain":"<逐字复制 painId 对应的痛点地图文本，不得改写、不得填 id>","description":"","evidence":"","scenarioId":""}]}`,
    onResult:(r,raw,mode)=>{
      if(!r?.candidates?.length){ showToast('AI 未返回候选卖点，已保留原值'); return; }
      // 2026-08-29 重新生成语义：已生成 → 直接整组替换（不确认）
      // 2026-09-01：绑定归一走 resolvePainBinding（幻觉 id 清空、painId 命中以地图原文为准）
      state.work3.candidates = r.candidates.map(c=>{
        const b=Work3.resolvePainBinding(c);
        return {
          id:uid('c'), name:(c.name||'').trim(), pain:b.pain, painId:b.painId,
          description:(c.description||'').trim(), evidence:b.evidence,
          source:'ai', scenarioId: state.work3.scenarios.some(s=>s.id===c.scenarioId)? c.scenarioId : '',
          selected:false, desirabilityScores:{}, extraDims: {}
        };
      });
      autosave(); Work3.rerender('candidates');
    }
  });
  plate.appendChild(box);

  plate.appendChild(el('p',{class:'hint',style:{margin:'8px 0'}},
    '关联痛点：AI 起草时自动绑定，可下拉修改，也可自定义。支撑证据：关联痛点后自动带入该痛点证据，可改为语料摘录（[真实]/[模拟]）、量化统计（N 篇评论提及）或可验证依据；确实没有就写「内部策略，无评论」。'));

  // 卖点表（痛点按 painId 关联）
  const table=el('div',{class:'table-wrap'});
  const t=el('table',{class:'data'});
  t.innerHTML='<thead><tr><th style="width:16%">卖点（≤15字）</th><th style="width:16%">关联痛点</th><th>方案描述（≤50字）</th><th style="width:18%">支撑证据</th><th style="width:13%">场景</th><th style="width:44px"></th></tr></thead>';
  const tb=el('tbody');
  cs.forEach((c,i)=>{
    const tr=el('tr');
    tr.appendChild(el('td',{},el('input',{value:c.name,oninput:e=>{c.name=e.target.value;autosave()}})));
    const painSel=el('select',{onchange:e=>{
      const v=e.target.value;
      if(v==='__custom'){ c.painId=''; }          // 自定义：保留 c.pain 由输入框编辑
      else if(v){
        const p=Work3.painById(v);
        c.painId=v; c.pain=p?p.pain:c.pain;
        if(!(c.evidence||'').trim() && p && (p.evidence||'').trim()) c.evidence=p.evidence;  // 自动带入证据
      } else { c.painId=''; if(!c.pain) c.pain=''; }
      autosave(); Work3.rerender('candidates');
    }});
    const selVal=Work3.candidatePainValue(c);
    painSel.appendChild(el('option',{value:''},'—'));
    state.work3.mining.painMap.forEach(p=>{const o=el('option',{value:p.id},p.pain+(p.type?' ('+p.type+')':''));if(selVal===p.id)o.selected=true;painSel.appendChild(o);});
    const customOpt=el('option',{value:'__custom'},'自定义…');
    if(selVal==='__custom') customOpt.selected=true;   // 自定义态必须在下拉可见，不能落回「—」
    painSel.appendChild(customOpt);
    // 2026-09-01 修复：td 上直接设 display:flex 会覆盖 table-cell，整表列格错位、
    // 痛点列被挤空——flex 移到内层 div，td 保持表格单元。
    const painCell=el('td');
    const painWrap=el('div',{style:{display:'flex',gap:'4px','align-items':'center'}});
    painWrap.appendChild(painSel);
    if(selVal==='__custom'){
      painWrap.appendChild(el('input',{value:c.pain||'',placeholder:'自定义痛点（≤20字）',style:{flex:1,minWidth:'90px'},
        oninput:e=>{c.pain=e.target.value;c.painId='';autosave()}}));
    }
    painCell.appendChild(painWrap);
    tr.appendChild(painCell);
    tr.appendChild(el('td',{},el('textarea',{rows:2,oninput:e=>{c.description=e.target.value;autosave()}},c.description)));
    tr.appendChild(el('td',{},el('input',{value:c.evidence||'',placeholder:'语料摘录 / N 篇评论提及 / 可验证依据',oninput:e=>{c.evidence=e.target.value;autosave()}})));
    tr.appendChild(el('td',{},Work3.scenarioSelect(c.scenarioId, v=>{c.scenarioId=v;autosave();})));
    tr.appendChild(el('td',{},el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work3.removeCandidate(i,e.currentTarget)},'备选卖点',()=>c.name,i,()=>state.work3.candidates,x=>x.name),'×')));
    tb.appendChild(tr);
  });
  t.appendChild(tb);table.appendChild(t);plate.appendChild(table);
  plate.appendChild(el('button',{onclick:()=>{cs.push({id:uid('c'),name:'',pain:'',painId:'',description:'',evidence:'',source:'user',scenarioId:'',selected:false,desirabilityScores:{},extraDims:{}});autosave();Work3.rerender('candidates')}},'+ 添加卖点'));
};

/* ---------- 4. 评分与矩阵 ---------- */
/* 评分求值保持只读：人工/AI 维度分优先，缺项才取当前 persona 子分均值。
   旧 src_*='personas' 字段是历史缓存，不作为直接评分，以免画像删除后继续读旧均值。 */
Work3.scoreValue = function(value){
  if(value==null || value==='' || (typeof value==='string' && !value.trim()))return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
};
Work3.desirabilityDimensionValue = function(c,d){
  const direct=c['src_'+d.key]==='personas'?null:Work3.scoreValue(c[d.key]);
  if(direct!=null)return direct;
  const values=Object.values(c.desirabilityScores||{}).map(sc=>Work3.scoreValue(sc?.[d.key])).filter(v=>v!=null);
  return values.length?mean(values):null;
};
Work3.ensureDesirabilityAggregates = function(){
  return state.work3.candidates.map(c=>{
    const view={...c};
    state.work3.dimensions.desirability.forEach(d=>{view[d.key]=Work3.desirabilityDimensionValue(c,d);});
    return view;
  });
};

Work3.computeMatrix = function(){
  const cs=state.work3.candidates;
  const ddims=state.work3.dimensions.desirability;
  const idims=state.work3.dimensions.implementability;
  return cs.map(c=>{
    let des=0;
    // 2026-09-01 wayfinder map：W5 复盘覆盖分优先（直接写共享 state，W3 同步生效）。
    if(Work3.scoreValue(c.reviewDes)!=null){
      des = clamp(Work3.scoreValue(c.reviewDes), 0, 10);
    } else {
      const vals=ddims.map(d=>Work3.desirabilityDimensionValue(c,d)).filter(v=>v!=null);
      des=vals.length?mean(vals):0;
    }
    const ivals=idims.map(d=>Work3.scoreValue(c[d.key])).filter(v=>v!=null);
    const imp = Work3.scoreValue(c.reviewImp)!=null
      ? clamp(Work3.scoreValue(c.reviewImp), 0, 10)
      : (ivals.length?mean(ivals):0);
    return {...c, x:imp, y:des};
  });
};
Work3.isInSector = function(x,y){
  const m=state.work3.matrix;
  if(!m.showSector) return false;
  // 2026-09-01 wayfinder map：扇面 = 均衡带（直线 y=x±w 夹出的常宽带）。
  const w = (m.sectorWidth == null) ? 1.5 : Number(m.sectorWidth);
  return Math.abs(y-x) <= w;
};

// 有效切分线：留空（null）→ 当前候选的中位数；手动值优先。供选择、排名表、引导共用。
Work3.effectiveCuts = function(){
  const pts = Work3.computeMatrix().filter(p=>(p.name||'').trim());
  const m = state.work3.matrix || {};
  return {
    xCut: m.xCut == null ? median(pts.map(p=>p.x)) : Number(m.xCut),
    yCut: m.yCut == null ? median(pts.map(p=>p.y)) : Number(m.yCut)
  };
};

// 「如何进入最优」补短板建议：先补到切分线，再补较低维度至均衡带。返回 {ok, text}。
Work3.entrySuggestion = function(x, y){
  const cuts = Work3.effectiveCuts();
  const w = (state.work3.matrix.sectorWidth == null) ? 1.5 : Number(state.work3.matrix.sectorWidth);
  const nx0 = Math.max(x, cuts.xCut), ny0 = Math.max(y, cuts.yCut);
  let nx = nx0, ny = ny0;
  if(ny0 - nx0 > w) nx = ny0 - w;
  else if(nx0 - ny0 > w) ny = nx0 - w;
  const parts = [];
  if(nx - x > 0.001) parts.push('可实施性 '+x.toFixed(1)+'→'+nx.toFixed(1));
  if(ny - y > 0.001) parts.push('合意性 '+y.toFixed(1)+'→'+ny.toFixed(1));
  if(!parts.length) return { ok:true, text:'已最优' };
  return { ok:false, text: parts.join('；') };
};

Work3.render.matrix = function(sec){
  const plate = sec.querySelector('.plate');
  const cs=state.work3.candidates;
  if(!cs.filter(c=>(c.name||'').trim()).length){ plate.appendChild(el('div',{class:'warning'},'请先在「备选卖点」添加卖点。')); return; }

  // 主按键：AI 起草双维评分（2 单元：合意性 → 可实施性）
  const aiBox = el('div',{class:'ai-box'});
  const mid = el('div',{class:'ai-box-mid'});
  if(!state.work3.context.hasSurvey){
    mid.appendChild(el('p',{class:'hint',style:'margin:0 0 8px'},'Work 1 未完成合成调研，合意性将由 AI 直接评分（无逐 persona 子分）。'));
  }
  const scored = state.work3.candidates.some(c=>
    state.work3.dimensions.desirability.some(d=>c[d.key]!=null) ||
    state.work3.dimensions.implementability.some(d=>c[d.key]!=null) ||
    Object.keys(c.desirabilityScores||{}).length>0);
  const scoreBtn = el('button',{class:'primary'}, scored ? '重新生成双维评分' : 'AI 起草双维评分');
  scoreBtn._regenerate = scored;
  mid.appendChild(scoreBtn);
  const handle = (typeof AiContext!=='undefined')
    ? AiContext.mountSettings(mid,{workId:'work3', needs:['sbu','personas','differentiators'], fewShotKey:'work3.dims',
        preview:()=>({system:'逐维打 0-10 分', instruction:'合意性 → 可实施性'})})
    : {current:()=>({sections:['sbu','personas','differentiators'], fewShot:'work3.dims'})};
  scoreBtn.addEventListener('click', ()=>Work3.runDoubleScoring(scoreBtn, mid, handle.current()));
  aiBox.appendChild(mid);
  plate.appendChild(aiBox);

  // 评分表（可折叠明细）
  const det=el('details');
  det.appendChild(el('summary',{class:'hint'},'展开/收起评分子项'));
  const ddims=state.work3.dimensions.desirability, idims=state.work3.dimensions.implementability;
  const table=el('div',{class:'table-wrap'});
  const t=el('table',{class:'data'});
  const head=el('thead'),hr=el('tr');
  hr.appendChild(el('th',{},'卖点'));
  if(state.work3.context.hasSurvey) hr.appendChild(el('th',{},'逐 persona 子分'));
  [...ddims,...idims].forEach(d=>hr.appendChild(el('th',{title:d.definition},d.label)));
  head.appendChild(hr); t.appendChild(head);
  const tb=el('tbody');
  cs.forEach(c=>{
    const tr=el('tr');
    tr.appendChild(el('td',{style:{'font-style':'normal'}},c.name));
    if(state.work3.context.hasSurvey){
      const td=el('td',{class:'mono',style:{'font-size':'11px'}});
      const pMeans=state.work3.context.personas.map(p=>{
        const sc=c.desirabilityScores?.[p.id];
        if(!sc) return p.name.slice(0,2)+':—';
        const values=ddims.map(d=>Work3.scoreValue(sc[d.key])).filter(v=>v!=null);
        return p.name.slice(0,2)+':'+(values.length?mean(values).toFixed(1):'—');
      });
      td.textContent=pMeans.join(' ');
      tr.appendChild(td);
    }
    [...ddims,...idims].forEach(d=>{
      const v=ddims.includes(d)?Work3.desirabilityDimensionValue(c,d):Work3.scoreValue(c[d.key]);
      const src=c['src_'+d.key];
      const td=el('td',{class:'score-cell'});
      td.appendChild(el('input',{type:'number',min:0,max:10,step:0.1,value:v??'',oninput:e=>{c[d.key]=parseFloat(e.target.value);c['src_'+d.key]='user';autosave();}}));
      if(src==='ai'){const dot=el('span',{class:'ai-mark'});td.appendChild(dot);}
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  t.appendChild(tb); table.appendChild(t); det.appendChild(table); plate.appendChild(det);

  // 评分维度管理（6 维默认，可增删改名，每侧至少保留 1 个）
  const dimDet = el('details',{style:'margin:10px 0'});
  dimDet.appendChild(el('summary',{class:'hint',style:'cursor:pointer'},'评分维度管理'));
  [['desirability','合意性维度'],['implementability','可实施性维度']].forEach(([axis,lb])=>{
    dimDet.appendChild(el('div',{class:'hint',style:'margin-top:8px'},lb));
    state.work3.dimensions[axis].forEach((d,i)=>{
      dimDet.appendChild(el('div',{style:{display:'flex',gap:'8px',marginBottom:'4px'}},
        el('input',{value:d.label,style:{width:'120px'},oninput:e=>{d.label=e.target.value;autosave()}}),
        el('input',{value:d.definition,style:{flex:1},oninput:e=>{d.definition=e.target.value;autosave()}}),
        el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work3.removeDimension(axis,i,e.currentTarget)},'评分维度',()=>d.label,i,()=>state.work3.dimensions[axis],x=>x.label),'×')));
    });
    dimDet.appendChild(el('button',{class:'small ghost',onclick:()=>{state.work3.dimensions[axis].push({key:'dim_'+uid('d'),label:'新维度',definition:''});autosave();Work3.rerender('matrix')}},'+ 维度'));
  });
  plate.appendChild(dimDet);

  // 矩阵参数 + 散点 + 扇面 + 排名表（同旧版，排名表新增「场景」列）
  plate.appendChild(el('hr',{class:'rule'}));
  const params=el('div',{class:'grid3'},
    UI.field('显示扇面', (()=>{
      const c=el('input',{type:'checkbox',checked:state.work3.matrix.showSector,onchange:e=>{state.work3.matrix.showSector=e.target.checked;autosave();Work3.rerender('matrix')}});
      c.style.width='auto'; return c;
    })()),
    UI.field('带宽 w ('+state.work3.matrix.sectorWidth+')',
      el('input',{type:'range',min:0.5,max:3,step:0.1,value:state.work3.matrix.sectorWidth,onchange:e=>{state.work3.matrix.sectorWidth=parseFloat(e.target.value);autosave();Work3.rerender('matrix')}})),
    el('p',{class:'hint',style:{margin:0}}, '最优 = 第一象限（切分线内）∩ 均衡带 |合意性−可实施性| ≤ w')
  );
  plate.appendChild(params);

  const pts=Work3.computeMatrix().filter(p=>(p.name||'').trim());
  const cuts=Work3.effectiveCuts();
  const inSector=pts.filter(p=>Work3.isInSector(p.x,p.y)).map(p=>p.id);
  const manual=new Set(state.work3.matrix.manualSelected||[]);
  // 2026-09-01 wayfinder map：最优 = 第一象限（切分线）∩ 扇面（均衡带）；
  // 关闭扇面 = 纯第一象限。切分线永远是同一对（null→中位数）。
  pts.forEach(p=>{
    if(!manual.has(p.id)){
      p.selected = state.work3.matrix.showSector
        ? (inSector.includes(p.id) && p.x>=cuts.xCut && p.y>=cuts.yCut)
        : (p.x>=cuts.xCut && p.y>=cuts.yCut);
    } else {
      p.selected = !!p.selected;
    }
  });
  state.work3.proposition.coreValueIds = pts.filter(p=>p.selected).map(p=>p.id);
  // BIZ01：自动派生结果写回真候选——mvo 闸门/主张步守卫/跨坊 CTA 读的是
  // candidates[].selected；手动确认过的（manualSelected 内）保留原值不动。
  const autoSel = new Set(state.work3.proposition.coreValueIds);
  (state.work3.candidates||[]).forEach(c=>{
    if(!manual.has(c.id)) c.selected = autoSel.has(c.id);
  });

  const scatterPlate=el('section',{class:'plate'},
    el('span',{class:'plate-label'},'F8 · PLUMB SCATTER · 客户合意性 × 企业可实施性'));
  renderMatrix({
    container:scatterPlate,
    points:pts.map(p=>({id:p.id,label:p.name+(Work3.scenarioName(p.scenarioId)?' · '+Work3.scenarioName(p.scenarioId):''),x:p.x,y:p.y})),
    xLabel:'企业可实施性', yLabel:'客户合意性',
    xCut:state.work3.matrix.xCut, yCut:state.work3.matrix.yCut,
    showSector:state.work3.matrix.showSector,
    sectorWidth:state.work3.matrix.sectorWidth,
    selectedId:null,
    qHighHigh:'明星卖点',qHighYLowX:'愿景卖点',qlowYHighX:'产能卖点',qLowLow:'淘汰卖点',
    hover:p=>{
      const q=p.x>=cuts.xCut&&p.y>=cuts.yCut?'明星':p.x<cuts.xCut&&p.y>=cuts.yCut?'愿景':p.x>=cuts.xCut&&p.y<cuts.yCut?'产能':'淘汰';
      return p.label+'｜象限：'+q+'｜'+Work3.entrySuggestion(p.x,p.y).text;
    },
    onSelect:id=>{
      const c=state.work3.candidates.find(x=>x.id===id);
      if(!c) return;
      c.selected=!c.selected;
      if(!manual.has(id)) manual.add(id);
      state.work3.matrix.manualSelected=[...manual];
      autosave(); Work3.rerender('matrix'); App.updateSummary();
    }
  });
  // 2026-09-01 修复：scatterPlate 此前从未挂载，扇面+矩阵图全画进孤儿节点（用户看不到）。
  plate.appendChild(scatterPlate);

  // 排名表（新增场景列）
  plate.appendChild(el('h5',{},'卖点排名'));
  const table2=el('div',{class:'table-wrap'});
  const t2=el('table',{class:'data'});
  t2.innerHTML='<thead><tr><th>#</th><th>卖点</th><th>场景</th><th>合意性</th><th>可实施性</th><th>象限</th><th>扇面</th><th>入选</th><th>如何进入最优</th></tr></thead>';
  const tb2=el('tbody');
  const xCut=cuts.xCut, yCut=cuts.yCut;
  [...pts].sort((a,b)=>(b.x+b.y)-(a.x+a.y)).forEach((p,i)=>{
    const q=p.x>=xCut&&p.y>=yCut?'明星':p.x<xCut&&p.y>=yCut?'愿景':p.x>=xCut&&p.y<yCut?'产能':'淘汰';
    const inside=Work3.isInSector(p.x,p.y);
    const sug=Work3.entrySuggestion(p.x,p.y);
    tb2.appendChild(el('tr',{},
      el('td',{},String(i+1)),
      el('td',{style:{'font-style':'normal'}},p.name),
      el('td',{class:'hint',style:'text-transform:none;letter-spacing:0'},Work3.scenarioName(p.scenarioId)||'—'),
      el('td',{class:'mono'},p.y.toFixed(2)),
      el('td',{class:'mono'},p.x.toFixed(2)),
      el('td',{},el('span',{class:'tag '+(q==='明星'?'maroon':'')},q)),
      el('td',{},state.work3.matrix.showSector ? (inside?el('span',{class:'tag soft'},'扇面内'):el('span',{class:'tag'},'外')) : el('span',{class:'muted'},'—')),
      el('td',{}, (()=>{
        const cb=el('input',{type:'checkbox',checked:!!p.selected});
        cb.style.width='auto';
        cb.addEventListener('change',()=>{
          const c=state.work3.candidates.find(x=>x.id===p.id); c.selected=cb.checked;
          if(!manual.has(p.id)) manual.add(p.id);
          state.work3.matrix.manualSelected=[...manual];
          autosave(); Work3.rerender('matrix');
        });
        return cb;
      })())
      ,
      el('td',{class:'hint',style:{'text-transform':'none','letter-spacing':'0'}}, sug.text)
    ));
  });
  t2.appendChild(tb2); table2.appendChild(t2); plate.appendChild(table2);

  // 迁移路径（条件性次级按键：仅当存在扇面外卖点）
  const outside=pts.filter(p=>!Work3.isInSector(p.x,p.y));
  if(outside.length){
    plate.appendChild(el('hr',{class:'rule'}));
    plate.appendChild(el('h5',{},'迁移路径（扇面外卖点）'));
    const mAi=el('div',{class:'ai-box'});
    const mBtn=el('button',{class:'primary',onclick:()=>Work3.generateMigration(mBtn,mAi,outside)},'AI 起草迁移路径');
    mAi.appendChild(mBtn); plate.appendChild(mAi);
    if(state.work3.migration.analyses.length){
      state.work3.migration.analyses.forEach(a=>{
        const c=state.work3.candidates.find(x=>x.id===a.candidateId);
        plate.appendChild(el('div',{class:'card',style:{'margin-bottom':'12px'}},
          el('div',{style:{'font-style':'normal','font-size':'18px','color':'var(--color-accent)'}}, c?.name||'已删除卖点'),
          el('p',{}, a.diagnosis),
          el('div',{}, (a.actions||[]).map((x,i)=>el('div',{style:{padding:'4px 0',borderBottom:'1px solid var(--color-rule)'}}, (i+1)+'. '+x))),
          a.targetScores && el('p',{class:'hint'}, '目标分数：合意性 '+(a.targetScores.desirability||'—')+' / 可实施性 '+(a.targetScores.implementability||'—'))
        ));
      });
    }
  }
};

/* 「AI 起草双维评分」：单元 A 合意性 → 单元 B 可实施性；
   _scoreDone 记录已完成细粒度单元，断点续跑只补缺，人工编辑保留。 */
Work3.runDoubleScoring = async function(button, container, cfg){
  const useManual = state.settings.manualMode || !API.config().apiKey;
  if(useManual){
    // 手动模式：两个粗粒度提示词（合意性 / 可实施性），逐单元复制粘贴
    const dimsD=state.work3.dimensions.desirability, dimsI=state.work3.dimensions.implementability;
    const cs=state.work3.candidates.filter(c=>(c.name||'').trim());
    const list=cs.map(c=>'- ['+c.id+'] '+c.name+'：'+(c.description||'')).join('\n');
    const units=[
      {key:'ms:d',label:'合意性评分',jsonMode:true,
        buildPrompt:()=>[{role:'system',content:'你是目标客户。对每个卖点在 '+dimsD.map(d=>d.label+'('+d.key+')').join('、')+' 维度打 0-10 分。输出 JSON: {"scores":{"<candidateId>":{"'+dimsD.map(d=>d.key).join('":0,"')+'":0}}}'},
          {role:'user',content:'SBU:'+state.work1.sbu.name+'\n卖点:\n'+list}],
        onResult:r=>{ if(!r?.scores){ showToast('AI 未返回评分，已保留原值'); return; } cs.forEach(c=>{ const sc=r.scores[c.id]; if(!sc) return; dimsD.forEach(d=>{c[d.key]=clamp(Number(sc[d.key])||0,0,10); c['src_'+d.key]='ai';}); c.desirabilitySource='ai'; }); autosave(); }},
      {key:'ms:i',label:'可实施性评分',jsonMode:true,
        buildPrompt:()=>[{role:'system',content:'你是企业运营顾问。对每个卖点在 '+dimsI.map(d=>d.label+'('+d.key+')').join('、')+' 维度打 0-10 分。输出 JSON: {"scores":{"<candidateId>":{"'+dimsI.map(d=>d.key).join('":0,"')+'":0}}}'},
          {role:'user',content:'SBU:'+state.work1.sbu.name+'\n卖点:\n'+list}],
        onResult:r=>{ if(!r?.scores){ showToast('AI 未返回评分，已保留原值'); return; } cs.forEach(c=>{ const sc=r.scores[c.id]; if(!sc) return; dimsI.forEach(d=>{c[d.key]=clamp(Number(sc[d.key])||0,0,10); c['src_'+d.key]='ai';}); }); autosave(); }}
    ];
    const done=new Set();
    API._manualPipeline(container,'双维评分',units,done,(k)=>done.add(k));
    return;
  }
  // 2026-08-29 重新生成语义：已评分 → 清断点完整重跑（直接覆盖，不确认）
  const hasScoredNow = state.work3.candidates.some(c=>state.work3.dimensions.desirability.some(d=>c[d.key]!=null) ||
                                    state.work3.dimensions.implementability.some(d=>c[d.key]!=null) ||
                                    Object.keys(c.desirabilityScores||{}).length>0);
  const regenerating=!!((button && button._regenerate) || hasScoredNow);
  if(regenerating){
    state.work3._scoreDone=[];
  }
  const task=Runner.start({id:'work3-double-score', label:'AI 起草双维评分', button,
    total:Work3._scorePending(), pausable:true});
  if(!task) return;
  try{
    await Work3._scoreAxis('desirability', task,regenerating);
    if(task.aborted) return;
    await Runner.checkpoint();
    await Work3._scoreAxis('implementability', task);
    if(task.aborted) return;
    state.work3._scoreDone=[];  // 全部完成，清断点
    showToast('双维评分完成');
  }catch(e){
    if(!(task.aborted || (e&&e.name==='AbortError'))) showToast('评分失败: '+e.message);
  }finally{
    Runner.finish();
    Work3.rerender('matrix');
  }
};

/* 本次运行待补的评分调用数（断点已完成的跳过）——2026-09-01 进度按每次 LLM 调用计一格 */
Work3._scorePending = function(){
  const cs=state.work3.candidates.filter(c=>(c.name||'').trim()).length;
  const ps=(state.work3.context.personas||[]).length;
  const survey=state.work3.context.hasSurvey && ps>0;
  const total=(survey?ps*cs:cs)+cs;  // d 轴 + i 轴
  return Math.max(total - Math.min((state.work3._scoreDone||[]).length, total), 1);
};

/* 单轴细粒度评分循环（复用 _scoreDone 断点） */
Work3._scoreAxis = async function(axis, task,replaceDirect=false){
  const cs=state.work3.candidates.filter(c=>(c.name||'').trim());
  const personas=state.work3.context.personas;
  const hasSurvey=state.work3.context.hasSurvey;
  if(!Array.isArray(state.work3._scoreDone)) state.work3._scoreDone=[];
  const doneSet=new Set(state.work3._scoreDone);
  const prefix = axis==='desirability'?'d':'i';
  const dims=state.work3.dimensions[axis];
  const callOne = async (sys, user)=>{
    const messages = [{role:'system',content:sys},{role:'user',content:user}];
    return API.callJson(messages,{signal:task.controller.signal});
  };
  if(axis==='desirability' && hasSurvey && personas.length){
    for(const p of personas){
      for(const c of cs){
        if(task.aborted) return;
        const key=prefix+':'+p.id+':'+c.id;
        if(doneSet.has(key)) continue;
        const r=await callOne(
          `你是${p.name}。${(Array.isArray(p.painPoints)?p.painPoints.join('；'):p.painPoints)||''}。对给定卖点在 ${dims.map(d=>d.label+'('+d.key+')').join('、')} 维度打 0-10 分。输出 JSON: {${dims.map(d=>'"'+d.key+'":0').join(',')}}`,
          `卖点:${c.name}\n方案:${c.description}\n证据:${c.evidence}`);
        if(r){
          c.desirabilityScores=c.desirabilityScores||{};
          c.desirabilityScores[p.id]={};
          dims.forEach(d=>c.desirabilityScores[p.id][d.key]=clamp(Number(r[d.key])||0,0,10));
          // 显式重新生成取得新子分后，移除上一轮直接维度结果；失败时原结果仍可用。
          if(replaceDirect)dims.forEach(d=>{delete c[d.key];delete c['src_'+d.key];});
          c.desirabilitySource='personas';
        }
        doneSet.add(key); state.work3._scoreDone=[...doneSet]; autosave(); Runner.tick(1);
        try{ await Runner.checkpoint(); }catch(e){ return; }
      }
    }
    // display/MVO/矩阵在读取时求 persona 均值，不将聚合结果回写维度字段。
    return;
  }
  // AI 直评（无调研）或可实施性（企业视角）
  for(const c of cs){
    if(task.aborted) return;
    const key=prefix+':'+c.id;
    if(doneSet.has(key)) continue;
    const sys = axis==='desirability'
      ? `你是目标客户。对卖点在 ${dims.map(d=>d.label+'('+d.key+')').join('、')} 维度打 0-10 分。输出 JSON: {${dims.map(d=>'"'+d.key+'":0').join(',')}}`
      : `你是企业运营顾问。对卖点在 ${dims.map(d=>d.label+'('+d.key+')').join('、')} 维度打 0-10 分。输出 JSON: {${dims.map(d=>'"'+d.key+'":0').join(',')}}`;
    const user = axis==='desirability'
      ? `SBU:${state.work1.sbu.name}\n卖点:${c.name}\n方案:${c.description}\n证据:${c.evidence}`
      : `SBU:${state.work1.sbu.name} 品类${state.work1.sbu.category}\n卖点:${c.name}\n方案:${c.description}\n证据:${c.evidence}`;
    const r=await callOne(sys, user);
    if(r){
      dims.forEach(d=>{c[d.key]=clamp(Number(r[d.key])||0,0,10); c['src_'+d.key]='ai';});
      if(axis==='desirability') c.desirabilitySource='ai';
    }
    doneSet.add(key); state.work3._scoreDone=[...doneSet]; autosave(); Runner.tick(1);
    try{ await Runner.checkpoint(); }catch(e){ return; }
  }
};

Work3.generateMigration = function(btn, container, outside){
  const m=state.work3.matrix;
  API.aiButton({
    button:btn, container,
    buildPrompt:()=>{
      const sys='你是品牌战略顾问。为扇面外卖点生成迁移路径。输出 JSON: {"analyses":[{"candidateId":"","diagnosis":"","actions":[""],"targetScores":{"desirability":0,"implementability":0}}]}';
      const user=`SBU:${state.work1.sbu.name}\n目标市场:${state.work3.context.targetMarket}\n扇面标准: 最优 = 第一象限（切分线内）∩ 均衡带 |合意性−可实施性| ≤ ${m.sectorWidth}\n\n扇面外卖点:\n${outside.map(p=>`- [${p.id}] ${p.name}: 合意性 ${p.y.toFixed(2)}, 可实施性 ${p.x.toFixed(2)}, 方案:${p.description}`).join('\n')}`;
      return (typeof AiContext!=='undefined')
        ? AiContext.buildPrompt({workId:'work3', sections:['sbu','differentiators'], system:sys, instruction:user})
        : [{role:'system',content:sys},{role:'user',content:user}];
    },
    onResult:r=>{
      if(!r?.analyses){ showToast('AI 未返回迁移分析，已保留原值'); return; }
      state.work3.migration.analyses=r.analyses;
      autosave(); Work3.rerender('matrix');
    }
  });
};

/* ---------- 5. 主张与定位 ---------- */
Work3.render.proposition = function(sec){
  const plate = sec.querySelector('.plate');
  const p=state.work3.proposition;
  // 显示顺序 = coreValueIds（主辅），不在顺序表里的（扇面直选）排在末尾——否则拖拽后数据变了界面不动
  const selected=state.work3.candidates
    .filter(c=>p.coreValueIds.includes(c.id) || c.selected)
    .sort((a,b)=>{ const ia=p.coreValueIds.indexOf(a.id), ib=p.coreValueIds.indexOf(b.id); return (ia<0?9999:ia)-(ib<0?9999:ib); });

  plate.appendChild(el('h4',{},'入选核心卖点（拖拽排序 = 主辅）'));
  if(!selected.length) plate.appendChild(el('div',{class:'warning'},'尚未在矩阵中选择卖点。'));
  else{
    const list=el('div',{});
    selected.forEach((c,idx)=>{
      // draggable 是枚举属性：必须传字符串 'true'，el() 的布尔分支会生成 draggable=""（无效值→auto→不可拖）
      const card=el('div',{class:'card',draggable:'true',style:'margin-bottom:8px;cursor:grab;padding:10px 14px'});
      card.appendChild(el('div',{style:{display:'flex',gap:'10px',alignItems:'center'}},
        el('span',{class:'mono',style:'font-size:11px;color:var(--color-ink-2)'}, '#'+(idx+1)),
        el('div',{style:{flex:1}},
          el('div',{style:{fontFamily:'var(--font-display)',fontStyle:'normal',fontSize:'16px'}}, c.name),
          el('div',{class:'hint'}, (c.description||'').slice(0,60)))));
      card.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain', c.id); });
      card.addEventListener('dragover',e=>e.preventDefault());
      card.addEventListener('drop',e=>{
        e.preventDefault();
        const dragId=e.dataTransfer.getData('text/plain');
        if(!dragId||dragId===c.id) return;
        const ids=p.coreValueIds.slice();
        // 确保两者都在顺序表里（扇面自动同步的可能不在）
        selected.forEach(s=>{ if(!ids.includes(s.id)) ids.push(s.id); });
        const from=ids.indexOf(dragId), to=ids.indexOf(c.id);
        if(from<0||to<0) return;
        ids.splice(from,1);
        // 插到目标之前（删除后重新取目标下标，方向无关）
        ids.splice(ids.indexOf(c.id),0,dragId);
        p.coreValueIds=ids; autosave(); Work3.rerender('proposition');
      });
      list.appendChild(card);
    });
    plate.appendChild(list);
  }

  // 主按键：AI 起草主张与定位（2 单元：价值主张 → 定位句建议）
  const aiBox = el('div',{class:'ai-box'});
  const mid = el('div',{class:'ai-box-mid'});
  // 已生成过 → 按钮变「重新生成」，点击直接覆盖上一次结果（不追加、不确认）
  const generated = (p.alternatives||[]).length>0;
  const propBtn = el('button',{class:'primary'}, generated?'重新生成主张与定位':'AI 起草主张与定位');
  mid.appendChild(propBtn);
  const handle = (typeof AiContext!=='undefined')
    ? AiContext.mountSettings(mid,{workId:'work3', needs:['sbu','personas','differentiators','scenarios','painMap'], fewShotKey:'work3.alternatives',
        preview:()=>({system:'3 个备选主张 → 定位句四要素', instruction:'点击后按单元顺序执行'})})
    : {current:()=>({sections:['sbu','personas','differentiators'], fewShot:'work3.alternatives'})};
  propBtn.addEventListener('click', ()=>{
    if(!Work3.guardProposition()) return;
    const cfg=handle.current();
    const selTxt=()=>selected.map(c=>c.name+'('+(c.description||'')+')').join('；');
    if(generated) state.work3._pipeProp=[];   // 重新生成：清断点，两个单元完整重跑
    const units=[
      {key:'prop:alt',label:'价值主张备选',jsonMode:true,
        buildPrompt:()=>AiContext.buildPrompt({workId:'work3',sections:cfg.sections,
          system:'你是品牌战略顾问。生成 3 个差异化价值主张，每个 20-40 字，说清"为谁、提供什么、有何不同"。',
          instruction:'SBU:'+state.work1.sbu.name+'\n目标市场:'+(state.work3.context.targetMarket||'')+ '\n入选卖点:'+selTxt()+
            '\n画像:'+state.work3.context.personas.map(x=>x.name+':'+((Array.isArray(x.painPoints)?x.painPoints.join('；'):x.painPoints)||'')).join('；')+
            '\n输出: {"alternatives":[{"text":""}]}',
          fewShot:cfg.fewShot}),
        // 覆盖语义：整组替换（首次为空数组等同追加；重生成不叠加旧候选）
        onResult:r=>{ if(!r?.alternatives){ showToast('AI 未返回备选方案，已保留原值'); return; } p.alternatives=r.alternatives.map(a=>({id:uid('alt'),text:a.text||''})); autosave(); }},
      {key:'prop:pos',label:'定位句建议',jsonMode:true,
        buildPrompt:()=>AiContext.buildPrompt({workId:'work3',sections:cfg.sections,
          system:'你是品牌定位顾问。按四要素（品类/目标客群/差异化卖点/可量化利益）给定位句填空建议。',
          instruction:'SBU:'+state.work1.sbu.name+'\n价值主张候选:'+(p.alternatives.map(a=>a.text).join('；')||selTxt())+
            '\n输出: {"positioning":{"brand":"","audience":"","coreValue":"","category":""}}',
          fewShot:'work3.positioning'}),
        onResult:r=>{ if(!r?.positioning){ showToast('AI 未返回定位句，已保留原值'); return; } ['brand','audience','coreValue','category'].forEach(k=>{ if(r.positioning[k]) p.positioning[k]=r.positioning[k]; }); autosave(); }}
    ];
    API.aiPipeline({button:propBtn, container:mid, label:'AI 起草主张与定位', units,
      store:{get(){return state.work3._pipeProp||[];}, set(v){state.work3._pipeProp=v;}},
      onDone:()=>Work3.rerender('proposition')});
  });
  aiBox.appendChild(mid);
  plate.appendChild(aiBox);

  // 价值主张备选（用户选定）
  plate.appendChild(el('h4',{},'价值主张备选'));
  const altBox=el('div',{});
  p.alternatives.forEach((a,i)=>{
    altBox.appendChild(el('div',{class:'card'+(a.text===p.chosenValueText?' selected':''),style:'margin-bottom:8px'},
      el('div',{style:{display:'flex','justify-content':'space-between','align-items':'flex-start',gap:'10px'}},
        el('textarea',{rows:2,oninput:e=>{
          // 选定指针按值跟随：改名的是已选定候选时同步 chosenValueText，避免悬空
          const wasChosen = !!p.chosenValueText && a.text===p.chosenValueText;
          a.text=e.target.value;
          if(wasChosen){ p.chosenValueText=e.target.value; App.updateSummary(); }
          autosave();
        }},a.text),
        el('div',{},
          el('button',{class:'small primary',onclick:()=>{p.chosenValueText=a.text;autosave();Work3.rerender('proposition');App.updateSummary()}},'选定'),
          el('button',Interaction.deleteButton({class:'small ghost',onclick:e=>Work3.removeAlternative(i,e.currentTarget)},'价值主张候选',()=>a.text,i,()=>p.alternatives,x=>x.text),'删除'))
    )));
  });
  plate.appendChild(altBox);

  // 定位句（填空式 + 实时预览）
  plate.appendChild(el('hr',{class:'rule'}));
  plate.appendChild(el('h4',{},'定位句（四要素填空）'));
  p.positioning.brand=p.positioning.brand||state.work1.sbu.name;
  plate.appendChild(el('div',{class:'grid2'},
    UI.field('品牌', el('input',{value:p.positioning.brand,oninput:e=>{p.positioning.brand=e.target.value;autosave();Work3.updatePositioning()}})),
    UI.field('品类', el('input',{value:p.positioning.category,oninput:e=>{p.positioning.category=e.target.value;autosave();Work3.updatePositioning()}}))
  ));
  plate.appendChild(UI.field('目标客群', el('input',{value:p.positioning.audience,oninput:e=>{p.positioning.audience=e.target.value;autosave();Work3.updatePositioning()}})));
  plate.appendChild(UI.field('核心价值（差异化卖点 + 可量化利益）', el('textarea',{rows:2,oninput:e=>{p.positioning.coreValue=e.target.value;autosave();Work3.updatePositioning()}},p.positioning.coreValue)));
  // 价值链重心（来自 Work1 微笑曲线收口）—— 定位的既定前提，只读引用
  const vcRef = (()=>{
    try{
      const env = state.work1.environment;
      const t = (env && env.ourCapabilities && env.ourCapabilities.smileCurve) || (typeof Work1!=='undefined' && Work1.smileConclusion ? Work1.smileConclusion() : '');
      return String(t||'').trim();
    }catch(e){ return ''; }
  })();
  if(vcRef){
    plate.appendChild(el('div',{class:'callout',style:'margin-top:10px'},
      el('span',{class:'callout-title'},'价值链重心 · 来自 Work1 微笑曲线'),
      el('p',{style:'margin:6px 0 0;line-height:1.7'}, vcRef)));
  }
  plate.appendChild(el('div',{class:'callout'},
    el('span',{class:'callout-title'},'定位句预览'),
    el('p',{id:'posPreview',style:{'font-family':'var(--font-display)','font-style':'normal','font-size':'20px'}}, '')
  ));
  plate.appendChild(el('p',{class:'hint'},'示例：比亚迪海狮 05EV 是为城市通勤家庭提供 5 分钟快充 + 405km 续航的高性价比纯电小型 SUV。'));
  Work3.updatePositioning();

  // 灵魂三问自检（课程 3.3.2，只读提示卡）
  plate.appendChild(el('div',{class:'callout',style:'margin-top:14px'},
    el('span',{class:'callout-title'},'灵魂三问自检'),
    el('p',{style:'margin:6px 0 0;line-height:1.8'},
      '这个价值主张长期成立吗？对客户真的有利吗？经得起社会拷问吗？（伦理 / 文化禁忌 / 长期影响）')));
};
Work3.guardProposition = function(){
  const selected=state.work3.candidates.filter(c=>c.selected);
  if(!selected.length){ showToast('请先在矩阵中选择入选卖点'); return false; }
  return true;
};
Work3.updatePositioning = function(){
  const p=state.work3.proposition.positioning;
  const sentence=`${p.brand||'〔品牌〕'} 是为 ${p.audience||'〔目标客群〕'} 提供 ${p.coreValue||'〔核心价值〕'} 的 ${p.category||'〔品类〕'}。`;
  // BIZ15：只有句子真的变了才写 state + autosave。本函数会被渲染路径
  // （Work3.render.proposition）无条件调用——若每次都 autosave，则每次刷新
  // 都置 dirty（"未保存"），即使数据没有任何变化。
  if(state.work3.proposition.positioningStatement !== sentence){
    state.work3.proposition.positioningStatement=sentence;
    autosave();
  }
  const el2=document.getElementById('posPreview');
  if(el2) el2.textContent=sentence;
};

/* ---------- 6. 人格与 Slogan ---------- */
Work3.render.identity = function(sec){
  const plate = sec.querySelector('.plate');
  const id=state.work3.identity;

  // 主按键：AI 起草人格与 Slogan（2 单元：人格 → Slogan）
  const aiBox = el('div',{class:'ai-box'});
  const mid = el('div',{class:'ai-box-mid'});
  const idGenerated = !!((state.work3.identity.mbti||'') || (state.work3.identity.personalityTraits||[]).length || (state.work3.identity.sloganOptions||[]).length);
  const idBtn = el('button',{class:'primary'}, idGenerated ? '重新生成人格与 Slogan' : 'AI 起草人格与 Slogan');
  mid.appendChild(idBtn);
  const handle = (typeof AiContext!=='undefined')
    ? AiContext.mountSettings(mid,{workId:'work3', needs:['sbu','positioning','differentiators'], fewShotKey:'work3.identity',
        preview:()=>({system:'MBTI + 特质 → 5 个 slogan', instruction:'点击后按单元顺序执行'})})
    : {current:()=>({sections:['sbu','positioning'], fewShot:'work3.identity'})};
  idBtn.addEventListener('click', ()=>{
    const cfg=handle.current();
    const p=state.work3.proposition;
    if(idGenerated) state.work3._pipeIdentity=[];   // 重新生成：清断点完整重跑
    const units=[
      {key:'id:persona',label:'品牌人格',jsonMode:true,
        buildPrompt:()=>AiContext.buildPrompt({workId:'work3',sections:cfg.sections,
          system:'你是品牌人格顾问。根据价值主张与目标客群，推荐一个 MBTI 类型与 3-5 个人格特质关键词。',
          instruction:'SBU:'+state.work1.sbu.name+'\n价值主张:'+(p.chosenValueText||'')+'\n目标客群:'+(p.positioning.audience||'')+
            '\n输出: {"mbti":"","traits":[""]}',
          fewShot:cfg.fewShot}),
        onResult:r=>{ if(!r)return; if(r.mbti) id.mbti=r.mbti; if(Array.isArray(r.traits)) id.personalityTraits=r.traits; autosave(); }},
      {key:'id:slogan',label:'Slogan',jsonMode:true,
        buildPrompt:()=>AiContext.buildPrompt({workId:'work3',sections:cfg.sections,
          system:'你是品牌文案。创作 5 个中文 12 字内的 slogan，含情感驱动词。',
          instruction:'品牌:'+(p.positioning.brand||state.work1.sbu.name)+'\n价值主张:'+(p.chosenValueText||'')+'\n人格:'+(id.mbti||'')+' '+(id.personalityTraits||[]).join('/')+
            '\n输出: {"slogans":[""]}',
          fewShot:'work3.slogans'}),
        // 2026-08-29 重新生成语义：整组替换（不追加叠加）；chosenSlogan 失效则清空
        onResult:r=>{ if(!r?.slogans){ showToast('AI 未返回 Slogan 候选，已保留原值'); return; } id.sloganOptions=r.slogans.slice(); if(id.chosenSlogan && !id.sloganOptions.includes(id.chosenSlogan)) id.chosenSlogan=''; autosave(); }}
    ];
    API.aiPipeline({button:idBtn, container:mid, label:'AI 起草人格与 Slogan', units,
      store:{get(){return state.work3._pipeIdentity||[];}, set(v){state.work3._pipeIdentity=v;}},
      onDone:()=>Work3.rerender('identity')});
  });
  aiBox.appendChild(mid);
  plate.appendChild(aiBox);

  // 人格
  plate.appendChild(el('h4',{},'品牌人格'));
  plate.appendChild(UI.field('MBTI 类型', el('input',{value:id.mbti,oninput:e=>{id.mbti=e.target.value;autosave()}})));
  const traits=UI.tagsInput(()=>id.personalityTraits||[], '输入后回车添加', next=>{id.personalityTraits=next;autosave();});
  traits.el.querySelector('input').addEventListener('blur',()=>{id.personalityTraits=traits.get();autosave()});
  plate.appendChild(UI.field('人格特质关键词', traits.el));

  // Slogan
  plate.appendChild(el('h4',{},'Slogan'));
  const slogBox=el('div',{});
  id.sloganOptions.forEach((s,i)=>{
    slogBox.appendChild(el('div',{class:'card'+(s===id.chosenSlogan?' selected':''),style:'margin-bottom:8px'},
      el('div',{style:{display:'flex','justify-content':'space-between','align-items':'center'}},
        el('input',{value:s,oninput:e=>{
          // 选定指针按值跟随：改名已选定项时同步 chosenSlogan，避免悬空
          const wasChosen = !!id.chosenSlogan && id.chosenSlogan===id.sloganOptions[i];
          id.sloganOptions[i]=e.target.value;
          if(wasChosen){ id.chosenSlogan=e.target.value; App.updateSummary(); }
          autosave();
        }}),
        el('div',{},
          el('button',{class:'small primary',onclick:()=>{id.chosenSlogan=id.sloganOptions[i];autosave();Work3.rerender('identity');App.updateSummary()}},'选定'),
          el('button',Interaction.deleteButton({class:'small ghost',onclick:e=>Work3.removeSlogan(i,e.currentTarget)},'Slogan',()=>id.sloganOptions[i],i,()=>id.sloganOptions,s=>s),'删除'))
    )));
  });
  plate.appendChild(slogBox);
  plate.appendChild(el('div',{class:'callout',style:'margin-top:14px'},
    el('span',{class:'callout-title'},'边界'),
    el('p',{style:'margin:6px 0 0'},'不做：logo 设计 / 视觉识别系统 / 色彩规范 / 汇报 PPT。本工具只输出文字方向，供 Midjourney / 设计师使用。')));
};

/* ---------- 导出 ---------- */
Work3.exportMd = function(){
  const d=state.work3;
  let out=`\n## III. 价值主张与定位\n\n### 1. 目标市场\n${d.context.targetMarket||'未选'}${d.context.targetMarketReason?'\n> '+d.context.targetMarketReason:''}\n`;
  if((d.context.tier2||[]).length) out+='观察市场：'+d.context.tier2.map(t=>t.name).join('、')+'\n';
  out+='\n### 2. 场景细分\n';
  if(d.scenarios.length){
    d.scenarios.forEach(s=>{
      const ns=s.needStrength||{};
      out+='- **'+(s.name||'未命名')+'**'+(s.selected?'（主战场）':'')+'：'+(s.description||'')+'；需求强度 痛'+(ns.pain||0)+'/愿'+(ns.willingness||0)+'/频'+(ns.frequency||0)+'\n';
    });
  } else out+='（未细分）\n';
  const counts=Work3.corpusCounts();
  out+=`\n**语料来源库存**：本地真实 ${counts.localReal} 条 + 模拟 ${counts.simulated} 条（${Work3.simulatedStatus()}）。\n`;
  out+=`Work1 上游真实来源按勾选纳入：开放题 ${counts.openUsed}/${counts.openAvailable} 条、主题 ${counts.themesUsed}/${counts.themesAvailable} 条。当前实际纳入真实 ${counts.realUsed} 条 + 模拟 ${counts.simulatedUsed} 条，共 ${counts.total} 条。\n`;
  if(d.mining.topics.length){
    out+=`\n### 3. LDA 主题模型\n`;
    if(d.mining._simulated) out+=`- 建模方式：LLM 模拟\n`;
    const comp = d.mining.corpusComposition;
    if(comp)out+='- '+Work3.compositionText(comp)+'\n';
    else out+='- 语料构成：本次建模来源数量未记录，请重新运行 LDA 以更新。\n';
    out+=`- 文档数：${d.mining.stats?.valid_count}\n- Coherence：${d.mining.stats?.coherence}\n\n`;
    Work3.markEvidenceSources(d.mining.topics,Work3.collectDocsLabeled()).forEach(t=>{
      out+=`- **${t.label||'主题'+(t.id+1)}** (${t.share}%): ${t.keywords.slice(0,8).map(k=>k.word).join('、')}\n`;
      (t.representative_docs||[]).forEach(doc=>{out+='  - 代表文档：'+doc+'\n';});
    });
  }
  if(d.mining.painMap.length){
    out+='\n### 4. 痛点地图\n';
    d.mining.painMap.forEach(p=>out+=`- [${p.type}] **${p.pain}** (${p.frequency}) — ${p.evidence}${Work3.scenarioName(p.scenarioId)?'【'+Work3.scenarioName(p.scenarioId)+'】':''}\n`);
  }
  out+='\n### 5. 卖点矩阵\n';
  Work3.computeMatrix().filter(c=>(c.name||'').trim()).sort((a,b)=>(b.x+b.y)-(a.x+a.y)).forEach(c=>{
    out+=`- **${c.name}**${Work3.scenarioName(c.scenarioId)?'【'+Work3.scenarioName(c.scenarioId)+'】':''}：合意性 ${c.y.toFixed(2)} / 可实施性 ${c.x.toFixed(2)} ${c.selected?'*':''}\n`;
  });
  out+=`\n### 6. 价值主张\n> ${d.proposition.chosenValueText||'未选定'}\n\n**定位句**：${d.proposition.positioningStatement}\n\n### 7. 品牌人格与 Slogan\n**人格**：${d.identity.mbti} ${(d.identity.personalityTraits||[]).join('/')}\n\n**Slogan**：${d.identity.chosenSlogan||'未选定'}\n`;
  return out;
};

// 2026-09-01 候选 4：迁移注册契约
Work3.workKey = 'work3';
Work3.migrations = [Work3.migrateWork3];
