/* ============================================================
   WORKSHOP 2 — 目标市场选择（3 tab · schemaVersion 2）
   Steps: framework / evaluate / decision
   对齐课程 2.3 三活动：构建评估体系 / 评估候选市场 / 矩阵选市场。
   Delphi = Hybrid 2（论文 AI-Human Hybrids for Marketing Research, JM 2025）：
   1 call 招聘 + 5 call 深 persona（RAG + few-shot）+ user 主持 + 可选 1 call 收敛。
   所有 AI 按钮走 docs/lib/ai_context.js 的最小上下文包 + 「消息设置」。
   ============================================================ */
Work2.steps = [
  {id:'framework', label:'1. 构建评估体系'},
  {id:'evaluate', label:'2. 评估候选市场'},
  {id:'decision', label:'3. 矩阵 + 三档决策'}
];
// 每步的下游步骤；末步（decision）无下游，出口走跨坊 CTA（2026-08-28 统一步间 CTA）
Work2.NEXT_STEPS = { framework:'evaluate', evaluate:'decision' };

/* 4×2 模板硬上限：每轴 4 个一级，每个一级下 2 个二级。手动新增与 AI 补齐都不得超过。 */
Work2.MAX_CATS = 4;
Work2.MAX_INDS = 2;
/* 4×2 默认指标模板（默认可覆写）。一级默认权重 0.25，二级 = 0.5（一级内归一化）。 */
Work2.INDICATOR_TEMPLATE = {
  attractiveness: [
    ['经济', ['市场规模 / 中高端容量', '经济景气度 / 消费意愿']],
    ['政治法律', ['出海政策 / 贸易摩擦', '认证要求 / 合规成本']],
    ['社会文化', ['目标客群需求强度', 'Hofstede 文化维度匹配度']],
    ['风险', ['汇率 / 回款', '物流时效 / 库存']]
  ],
  competitiveness: [
    ['市场信息', ['需求数据可获取性', '竞品数据可监测性']],
    ['营销渠道', ['电商平台成熟度', 'KOL / 合作渠道']],
    ['认证合规', ['既有认证可复用度', '法律服务可获取性']],
    ['产品品牌', ['客户基础可迁移性', 'C 端品牌能力起点']]
  ]
};
Work2.defaultTemplate = function(axis){
  return Work2.INDICATOR_TEMPLATE[axis].map(([name, inds])=>({
    id: uid('cat'), name, weight: 0.25,
    indicators: inds.map(n=>({id:uid('ind'), name:n, rubric:{high:'',mid:'',low:''}, weight:0.5, support:0, source:'template'}))
  }));
};

Work2.afterRemoval = function(step){
  autosave();Work2.rerender(step);
  if(typeof App!=='undefined' && typeof App.updateSummary==='function')App.updateSummary();
};
Work2.focusAction = function(step,label,accessibleLabel){
  const sec=document.querySelector('#steps2 .step[data-step="'+step+'"]');
  if(!sec)return;
  const target=Array.from(sec.querySelectorAll('button')).find(b=>accessibleLabel?b.getAttribute('aria-label')===accessibleLabel:b.textContent.trim()===label)||sec.querySelector('h2,h3');
  if(target){if(target.tagName!=='BUTTON')target.setAttribute('tabindex','-1');target.focus?.();}
};
Work2.clearIndicatorReferences = function(ids){
  const d=state.work2.delphi;
  Object.values(state.work2.scoring||{}).forEach(row=>ids.forEach(id=>{delete row[id];}));
  (d.personas||[]).forEach(p=>['attractiveness','competitiveness'].forEach(axis=>{
    ids.forEach(id=>{if(p.ratings?.[axis])delete p.ratings[axis][id];});
  }));
  Work2.invalidateDelphi(false);
  if(state.work2.decision)state.work2.decision.cutsChanged=true;
};
Work2.invalidateDelphi = function(resetPersonas){
  const d=state.work2.delphi;
  if(resetPersonas)d.personas=[];
  d.finalWeights=null;d.summary='';d.phase=null;d.drifted=false;
  d.status=(d.personas||[]).length?'hosted':((d.recruitment?.perspectives||[]).length?'recruiting':'idle');
  // 旧版本的 Delphi 产物也不再保留失效的指标/视角引用。
  d.panel=[];['round1','round2','synthesis','finalSynthesis','weights'].forEach(k=>{d[k]=null;});
};
/* 一级删除包含其全部二级指标，评分和赋权引用随对象实际清理。 */
Work2.catImpact = function(cat){
  const inds = cat.indicators||[];
  let scored = 0;
  Object.values(state.work2.scoring||{}).forEach(row=>{
    inds.forEach(i=>{ if(row[i.id] && row[i.id].score!=null) scored++; });
  });
  const weighted=(state.work2.delphi.personas||[]).filter(p=>inds.some(i=>
    ['attractiveness','competitiveness'].some(axis=>Object.prototype.hasOwnProperty.call(p.ratings?.[axis]||{},i.id)))).length;
  return {indCount: inds.length, scored, weighted};
};
Work2.catDeleteMsg = function(cat, axisLabel, leftAfter){
  const {indCount, scored, weighted} = Work2.catImpact(cat);
  const bits = ['删除「'+axisLabel+'」下的一级维度「'+(cat.name||'未命名')+'」？',
    '连带删除 '+indCount+' 个二级指标及其高/中/低锚点。'];
  if(scored) bits.push('已打的 '+scored+' 格评分会删除，矩阵按剩余指标重新计算。');
  bits.push(weighted+' 位 persona 的相关赋权引用会清除，旧收敛记录和总结失效；剩余指标与其存储权重保留，需重新收敛。');
  if(!leftAfter) bits.push('这是本轴最后一个一级维度——删完本轴为空，评分表与矩阵无轴可比。');
  bits.push('此操作不可撤销；「恢复默认 4×2 模板」只重建模板文案，你写过的锚点与评分不会回来。');
  return bits.join('\n');
};
Work2.removeCategory = function(axis,index,trigger){
  const categories=state.work2[axis].categories||[],cat=categories[index];if(!cat)return Promise.resolve(false);
  const axisLabel=axis==='attractiveness'?'市场吸引力':'业务竞争力',ids=(cat.indicators||[]).map(i=>i.id);
  return Interaction.removeItem({list:()=>state.work2[axis].categories,index,type:'一级维度',name:cat.name,trigger,
    impact:Work2.catDeleteMsg(cat,axisLabel,categories.length-1),
    onChange:()=>{Work2.clearIndicatorReferences(ids);Work2.afterRemoval('framework');}});
};
Work2.removeIndicator = function(axis,catId,index,trigger){
  const cat=state.work2[axis].categories.find(c=>c.id===catId),ind=cat?.indicators?.[index];if(!ind)return Promise.resolve(false);
  const impact=Work2.catImpact({indicators:[ind]}),axisLabel=axis==='attractiveness'?'市场吸引力':'业务竞争力';
  return Interaction.removeItem({list:()=>state.work2[axis].categories.find(c=>c.id===catId)?.indicators,index,type:'二级指标',name:ind.name,trigger,
    impact:'所属轴为「'+axisLabel+'」，将删除该指标的高/中/低锚点、二级权重及 '+impact.scored+' 格已打评分。'+
      impact.weighted+' 位 persona 的该指标赋权引用会清除，旧收敛记录和总结失效；其它指标、锚点、评分和存储权重保留，矩阵按剩余指标重新计算，需重新收敛。',
    onChange:()=>{Work2.clearIndicatorReferences([ind.id]);Work2.afterRemoval('framework');}});
};
Work2.removeRetained = function(index,trigger){
  const m=state.work2.retained[index];if(!m)return Promise.resolve(false);
  const d=state.work2.decision,scoreCount=Object.values(state.work2.scoring?.[m.id]||{}).filter(c=>c.score!=null).length;
  const sharedExplanation=state.work2.retained.some(x=>x.id!==m.id&&x.name===m.name);
  const tiers=[d.tier1?.marketId===m.id?'主战场':'',(d.tier2?.marketIds||[]).includes(m.id)?'观察期':'',(d.tier3?.marketIds||[]).includes(m.id)?'放弃档':''].filter(Boolean);
  return Interaction.removeItem({list:()=>state.work2.retained,index,type:'保留市场',name:m.name,trigger,
    impact:'该市场详情和 '+scoreCount+' 格评分会删除；'+(sharedExplanation?'同名保留市场共享的矩阵解释会保留。':'该市场的矩阵解释会删除。')+
      (tiers.length?tiers.join('、')+'中的该市场关联会清除。':'该市场的三档引用会清除。')+
      '矩阵和排名按剩余市场重新计算；候选市场及其它保留市场的评分、决策内容保留。',
    onChange:()=>{
      if(state.work2.scoring)delete state.work2.scoring[m.id];
      if(!state.work2.retained.some(x=>x.name===m.name)&&d.explanations)delete d.explanations[m.name];
      Work2.pruneStaleTiers();d.cutsChanged=true;Work2.afterRemoval('framework');
    }});
};
Work2.removeCriterion = function(index,trigger){
  const c=state.work2.screening.criteria[index];if(!c)return Promise.resolve(false);
  const retained=state.work2.retained.length,derived=retained>0||(state.work2._pipeDone||[]).includes('fw:retained');
  return Interaction.removeItem({list:()=>state.work2.screening.criteria,index,type:'筛选标准',name:c.name,trigger,
    impact:derived?'该标准及其数据源会删除；'+retained+' 个已保留市场的筛选依据需要复核。保留市场、评分和三档决策会保留，已完成的应用筛选记录会清除。':'',
    onChange:()=>{if(derived)state.work2._pipeDone=(state.work2._pipeDone||[]).filter(key=>key!=='fw:retained');Work2.afterRemoval('framework');}});
};
Work2.removePerspective = function(index,trigger){
  const d=state.work2.delphi,p=d.recruitment.perspectives[index];if(!p)return Promise.resolve(false);
  const matches=(d.personas||[]).filter(x=>x.perspectiveName===p.name).length;
  const derived=matches>0||d.finalWeights!=null||!!d.summary||d.status==='done'||d.phase!=null;
  return Interaction.removeItem({list:()=>state.work2.delphi.recruitment.perspectives,index,type:'招聘视角',name:p.name,trigger,
    impact:derived?'该视角及其 '+matches+' 条同名 persona 赋权记录会删除；旧收敛记录、总结及断点会清除。其它视角和赋权保留；当前指标的存储权重和市场评分保留，需重新收敛。':'',
    onChange:()=>{
      if(derived){d.personas=(d.personas||[]).filter(x=>x.perspectiveName!==p.name);Work2.invalidateDelphi(false);}
      Work2.afterRemoval('framework');
    }});
};
Work2.restartRecruitment = async function(trigger){
  if(state.meta?.isDemo||state.meta?.demoCase)return false;
  const workspace=state,d=state.work2.delphi;
  if(!await Interaction.confirm({title:'清空招聘与赋权记录？',confirmLabel:'清空并重新招聘',trigger,
    message:'将清空 '+d.recruitment.perspectives.length+' 个招聘视角和 '+(d.personas||[]).length+' 条 persona 赋权记录，以及旧收敛记录、总结和断点。当前两级指标、存储权重及市场评分保留，后续需重新招聘、赋权和收敛。此操作不可撤销。'}))return false;
  if(state!==workspace||state.meta?.isDemo||state.meta?.demoCase)return false;
  d.recruitment.perspectives=[];Work2.invalidateDelphi(true);Work2.afterRemoval('framework');Work2.focusAction('framework','AI 招聘：该听哪 5 个视角');return true;
};
// 整轴换回默认模板：指标 id 全变 → persona 赋权与收敛权重失去指向，按「指标变了就重置」
// 处理（同 AI 推导指标体系）。另一轴的一级/二级指标与存储权重不动。
Work2.restoreAxisTemplate = async function(axis,trigger){
  if(state.meta?.isDemo||state.meta?.demoCase)return false;
  const workspace=state;
  const axisLabel = axis==='attractiveness'?'市场吸引力':'业务竞争力';
  const cur = state.work2[axis].categories||[];
  const filled = cur.length,ids=cur.flatMap(c=>(c.indicators||[]).map(i=>i.id));
  const impact=Work2.catImpact({indicators:cur.flatMap(c=>c.indicators||[])});
  const msg = ['把「'+axisLabel+'」整轴换回默认 4×2 模板？',
    filled ? '当前 '+filled+' 个一级维度会被整体替换：你写过的锚点、手改的一级/二级权重与已打的分都不会回来。'
           : '本轴现在是空的，恢复后可直接改名、补锚点。',
    '本轴 '+ids.length+' 个二级指标和 '+impact.scored+' 格已打评分会删除；模板不会恢复被删除的自填内容。',
    '权重需要重定：persona 赋权、收敛记录、总结和断点会重置为未运行。另一轴的指标、锚点、存储权重与评分保留。此操作不可撤销。'].join('\n');
  if(!await Interaction.confirm({title:'恢复「'+axisLabel+'」默认模板？',message:msg,confirmLabel:'恢复默认模板',trigger})) return false;
  if(state!==workspace||state.meta?.isDemo||state.meta?.demoCase)return false;
  state.work2[axis].categories = Work2.defaultTemplate(axis);
  Work2.clearIndicatorReferences(ids);Work2.invalidateDelphi(true);state.work2.delphi.status='idle';
  Work2.afterRemoval('framework');Work2.focusAction('framework','恢复默认 4×2 模板','恢复'+axisLabel+'默认模板');
  showToast('已恢复「'+axisLabel+'」默认 4×2 模板');
  return true;
};

/* AI 只补缺失的一级维度（2026-09-11）。与「重新推导评估体系」的关键区别：
   那条是 4 单元流水线整组重跑，会换掉保留市场并 scoring={} 清空全部评分；
   这里只往本轴追加缺的一级，已有一级/二级/锚点/id 全不动，所以已打的评分
   不会孤儿化，矩阵与评分表照旧可用。 */
Work2.missingTemplateCats = function(axis){
  const cur = (state.work2[axis].categories||[]).map(c=>(c.name||'').trim()).filter(Boolean);
  // 双向包含匹配：用户把「风险」改名成「竞争与合规风险」也算在，不重复补
  return Work2.INDICATOR_TEMPLATE[axis].filter(([name])=>
    !cur.some(cn => cn.includes(name) || name.includes(cn)));
};
Work2.fillMissingCats = function(axis, button, container){
  const axisLabel = axis==='attractiveness'?'市场吸引力':'业务竞争力';
  const missing = Work2.missingTemplateCats(axis);
  if(!missing.length){
    showToast('「'+axisLabel+'」的 4 个一级维度都在（'+Work2.INDICATOR_TEMPLATE[axis].map(t=>t[0]).join(' / ')+'），无需补齐');
    return;
  }
  // 有模板缺失但名额已满（用户用自定义一级占了位）：不能再补，先删
  if((state.work2[axis].categories||[]).length >= Work2.MAX_CATS){
    showToast('「'+axisLabel+'」已有 '+Work2.MAX_CATS+' 个一级维度（每轴上限 '+Work2.MAX_CATS+' 个）；要补模板维度，请先删掉不用的一级');
    return;
  }
  // 剩余名额内的缺失项才要（已有自定义一级占位时，缺失数可能大于名额）
  const names = missing.slice(0, Work2.MAX_CATS - (state.work2[axis].categories||[]).length).map(t=>t[0]);
  // 不弹 confirm（AGENTS.md：AI 生成类按钮直接跑）——本按钮只追加不覆盖，按钮文案已点名要补哪个；
  // 也永远进不了「已生成 → 重新生成」态：补齐成功后本轴不缺，按钮就不再渲染。
  const have = () => (state.work2[axis].categories||[]).map(c=>(c.name||'').trim()).filter(Boolean).join(' / ') || '（空）';
  const sys = '你是营销研究方法专家。为海外市场选择的「'+axisLabel+'」轴补齐缺失的一级维度，每个一级给 2 个二级指标与高/中/低评分锚点。只输出要求补齐的那几个一级维度，已存在的不要输出。';
  const ins = () => '业务单元：'+(state.work1.sbu?.name||'')
    + '\n本轴已有的一级维度（不得重复生成）：'+have()
    + '\n需要补齐的一级维度：'+names.join(' / ')
    + '\n每个二级指标的 rubric 要可观测、可查证：high = 8-10 分长什么样、mid = 4-7 分、low = 0-3 分。'
    + '\n输出: {"categories": [{"name": "一级维度名", "indicators": [{"name": "", "rubric": {"high": "", "mid": "", "low": ""}}]}]}';
  API.aiButton({button, container, label:'AI 补齐一级维度',
    buildPrompt: ()=> (typeof AiContext!=='undefined')
      ? AiContext.buildPrompt({workId:'work2', sections:['sbu','environment','competitors'],
          system:sys, instruction:ins(), fewShot:'work2.indicators'})
      : [{role:'system',content:sys},{role:'user',content:ins()}],
    onResult: r=>{
      const cats = r?.categories;
      if(!Array.isArray(cats) || !cats.length){ showToast('AI 未返回可补齐的一级维度，已保留原值'); return; }
      // 只收确实缺的：重名（与现有或本批重复）一律丢弃，防追加出两个「风险」
      // 名额以结果返回时为准（等待期间可能手动加过一级）
      const room = Work2.MAX_CATS - (state.work2[axis].categories||[]).length;
      const accepted = [];
      cats.forEach(c=>{
        if(accepted.length >= room) return;
        const nm = String(c?.name||'').trim();
        if(!nm) return;
        const cur = (state.work2[axis].categories||[]).map(x=>(x.name||'').trim());
        if(cur.some(x=>x===nm || x.includes(nm) || nm.includes(x))) return;
        if(accepted.some(x=>x.name===nm)) return;
        const inds = (c.indicators||[]).slice(0,Work2.MAX_INDS);
        accepted.push({id:uid('cat'), name:nm, weight:0.25,
          indicators: inds.map(i=>({id:uid('ind'), name:String(i?.name||'').trim(),
            rubric:Work2.pickRubric(i), weight:1/Math.max(1,inds.length), support:0, source:'ai'}))});
      });
      if(!accepted.length){ showToast(room<=0 ? '本轴已有 '+Work2.MAX_CATS+' 个一级维度，AI 结果未采用' : 'AI 返回的一级维度都已存在，未做改动'); return; }
      state.work2[axis].categories = (state.work2[axis].categories||[]).concat(accepted);
      // 只增不改：不清 persona（清了要重烧 N 次调用），仅标偏离——与手改一级权重同语义。
      // 新一级没有 persona 权重，靠存储权重 0.25×(1/n) 参与评分，effectiveWeights 按轴归一化。
      if(state.work2.delphi.status==='done') state.work2.delphi.drifted = true;
      autosave();
      Work2.rerender('framework');
      showToast('已补齐 '+accepted.length+' 个一级维度：'+accepted.map(c=>c.name).join(' / '));
    }});
};

/* 从 AI 产物里取锚点：模型常不按 rubric 嵌套写——扁平 i.high、中文键、
   highAnchor/8-10 分 等形态都见过，取不到就静默变空锚点、MVO 假失败。
   同时兼容 i.rubric 嵌套与扁平字段。纯函数。 */
Work2.pickRubric = function(i){
  const groups = [i && i.rubric, i];
  const pick = keys => {
    for(const o of groups){
      if(!o || typeof o!=='object') continue;
      for(const k of keys){
        const v = o[k];
        if(typeof v==='string' && v.trim()) return v.trim();
      }
    }
    return '';
  };
  return {
    high: pick(['high','highAnchor','scoreHigh','高','高分','高分锚点','8-10','8-10分','8~10']),
    mid:  pick(['mid','middle','medium','midAnchor','scoreMid','中','中分','中分锚点','4-7','4-7分','4~7']),
    low:  pick(['low','lowAnchor','scoreLow','低','低分','低分锚点','0-3','0-3分','0~3'])
  };
};

/* AI 指标产物归一化（对齐 Work1.normalizeMetricDims，2026-09-12）。
   模型常少给：3 个一级、一级下只给 1 个二级、锚点缺字段或换键名。缺二级补空行、
   缺一级按 4×2 模板名补齐，空行留给用户在界面补锚点。patched=缺名或缺锚点的二级数。纯函数。 */
Work2.normalizeAxisCats = function(axis, rawCats){
  const blankInd = ()=>({id:uid('ind'),name:'',rubric:{high:'',mid:'',low:''},weight:0.5,support:0,source:'ai'});
  let patched = 0;
  const cats = (rawCats||[]).slice(0,Work2.MAX_CATS).map(c=>{
    const inds = (Array.isArray(c?.indicators)?c.indicators:[]).slice(0,Work2.MAX_INDS).map(raw=>{
      const rubric = Work2.pickRubric(raw);
      if(!(String(raw?.name||'').trim()) || !rubric.high || !rubric.mid || !rubric.low) patched++;
      return {id:uid('ind'), name:String(raw?.name||'').trim(), rubric,
        weight:0.5, support:0, source:'ai'};
    });
    while(inds.length < Work2.MAX_INDS){ inds.push(blankInd()); patched++; }
    return {id:uid('cat'), name:String(c?.name||'').trim(), weight:0.25, indicators:inds};
  });
  if(cats.length < Work2.MAX_CATS){
    Work2.INDICATOR_TEMPLATE[axis].forEach(([tname])=>{
      if(cats.length >= Work2.MAX_CATS) return;
      if(!cats.some(c=>(c.name||'').includes(tname) || tname.includes(c.name||''))){
        cats.push({id:uid('cat'), name:tname, weight:0.25, indicators:[blankInd(),blankInd()]});
        patched += Work2.MAX_INDS;
      }
    });
    while(cats.length < Work2.MAX_CATS){
      cats.push({id:uid('cat'), name:'', weight:0.25, indicators:[blankInd(),blankInd()]});
      patched += Work2.MAX_INDS;
    }
  }
  return {cats, patched};
};

/* 流水线指标单元落点（每轴一单元）。空结果直接抛错：pipeline 的 catch 会
   toast + 降级手动箱且不 markDone。2026-09-12 前 onResult(null) 静默 return，
   单元却被判完成——「推导完成」但指标体系没生成，根因就在这。 */
Work2.acceptAxisIndicators = function(axis, r){
  const axisLabel = axis==='attractiveness'?'市场吸引力':'业务竞争力';
  if(!r || !Array.isArray(r.categories) || !r.categories.length)
    throw new Error('AI 未返回「'+axisLabel+'」的有效指标 JSON（输出可能被截断）');
  const {cats, patched} = Work2.normalizeAxisCats(axis, r.categories);
  state.work2[axis].categories = cats;
  // 指标变了：权重需重定（Delphi 重置）
  state.work2.delphi.finalWeights = null; state.work2.delphi.personas = [];
  state.work2.delphi.status = 'idle'; state.work2.delphi.drifted = false;
  autosave();
  if(patched) showToast('「'+axisLabel+'」有 '+patched+' 个二级指标缺名称或锚点，已按 4×2 补空行，请补全');
};

/* 保留市场换过 id（流水线重跑 / 手动删）后，三档决策里的旧 marketId 会悬空：
   下拉退回「— 必选 —」、矩阵没有选中点、导出写「主战场：未知」，
   而 MVO 的「tier1 非空」拿到的是旧字符串，依旧假通过。统一消毒。 */
Work2.pruneStaleTiers = function(){
  const d = state.work2.decision;
  if(!d) return false;
  const snap = () => JSON.stringify({t1:(d.tier1&&d.tier1.marketId)||null,
    t2:(d.tier2&&d.tier2.marketIds)||[], t3:(d.tier3&&d.tier3.marketIds)||[]});
  const before = snap();
  Work2.sanitizeTiers(d, (state.work2.retained||[]).map(m=>m.id));
  return snap() !== before;
};

Work2.defaultData = () => ({
  // ===== Tab 1: 构建评估体系 =====
  candidates: [],            // {id, name, reason, source}
  screening: { criteria: [] }, // {id, name, source, kind:'user'|'ai'}
  retained: [],              // {id, name, region, population, gdpPerCapita, notes, source}
  attractiveness: { categories: Work2.defaultTemplate('attractiveness') },
  competitiveness: { categories: Work2.defaultTemplate('competitiveness') },
  delphi: {
    // === Hybrid 2 升级版 ===
    recruitment: { perspectives: [] },   // 招聘阶段输出
    personas: [],                        // persona 并行阶段输出（动态生成）
    userHosted: true,                    // User 主持阶段标志
    finalWeights: null,                  // 收敛展示记录（回填后释放为 null）
    summary: '',
    status: 'idle',                      // idle|recruiting|personas|hosted|converging|done
    phase: null,                         // checkpoint
    drifted: false,                      // 收敛后 1.4 权重被手改 → 提示偏离收敛
    // === 旧字段（保留兼容，不再使用） ===
    panel: [], round1: null, round2: null, synthesis: null, finalSynthesis: null, weights: null
  },
  // ===== Tab 2: 评估候选市场 =====
  scoring: {},   // marketId: { indId: {score, evidence, url, source:'user'|'ai'} }
  // ===== Tab 3: 矩阵 + 三档决策 =====
  matrix: { xCut: null, yCut: null, notes: '' },
  decision: {
    explanations: {},   // marketName -> 为什么落在这个象限
    tier1: { marketId: null, rationale: '', resourcesPct: 80, milestones: [], reEvalTrigger: '' },
    tier2: { marketIds: [], observationMetrics: [], reEvalTrigger: '' },
    tier3: { marketIds: [], reEvalTrigger: '' }
  },
  // ===== 跨 tab 元信息 =====
  meta: { schemaVersion: 2, work1Linked: false },
  _pipeDone: [],  // Tab 1 主流水线断点
  _frameworkGenerated: false
});

/* ---------- 数据迁移（schemaVersion 1 → 2） ---------- */
Work2.BUCKET_KEYWORDS = {
  attractiveness: {
    '经济': ['经济','规模','增长','容量','消费','GDP'],
    '政治法律': ['政治','政策','法规','法律','监管','贸易','准入'],
    '社会文化': ['文化','社会','人口','语言','宗教','Hofstede'],
    '风险': ['风险','汇率','回款','物流','库存','波动']
  },
  competitiveness: {
    '市场信息': ['信息','数据','调研','监测'],
    '营销渠道': ['渠道','电商','KOL','分销','平台'],
    '认证合规': ['认证','合规','资质','法务'],
    '产品品牌': ['品牌','产品','客户','认知']
  }
};
Work2.bucketIndicatorsByCategory = function(inds, axis){
  const defaultNames = axis === 'attractiveness'
    ? ['经济', '政治法律', '社会文化', '风险']
    : ['市场信息', '营销渠道', '认证合规', '产品品牌'];
  const kw = Work2.BUCKET_KEYWORDS[axis] || {};
  const cats = defaultNames.map(n=>({ id: uid('cat'), name: n, weight: 0.25, indicators: [] }));
  // 按指标名模糊匹配归类（关键词 → 前缀包含）；不匹配的归到第一个
  (inds||[]).forEach(ind=>{
    const nm = ind.name || '';
    let idx = cats.findIndex(c => (kw[c.name]||[]).some(k => nm.includes(k)));
    if(idx < 0) idx = cats.findIndex(c => nm.includes(c.name) || c.name.includes(nm.slice(0,2)));
    cats[idx>=0?idx:0].indicators.push({
      id: ind.id || uid('ind'), name: nm,
      rubric: ind.rubric || {high:'',mid:'',low:''},
      weight: 0.5, support: ind.support||0, source: ind.source||'user'
    });
  });
  cats.forEach(c=>{
    const n = Math.max(1, c.indicators.length);
    c.indicators.forEach(i=>{ i.weight = 1/n; });
  });
  return cats;
};
Work2.migrateWork2 = function(old){
  if(!old) return old;
  // 旧 schema 特征（markets / scope / 平铺 indicators）。注意：mergeWithDefaults
  // 会把新默认值的 meta.schemaVersion=2 混入旧数据，因此不能只看 meta。
  const isV1 = Array.isArray(old.markets) || !!old.scope ||
    Array.isArray(old.attractiveness?.indicators) || Array.isArray(old.competitiveness?.indicators);
  if(!isV1) return old;
  const migrated = {
    ...old,
    candidates: (old.markets||[]).slice(3).map(m=>({id:m.id, name:m.name, reason:m.notes||'', source:'user'})),
    screening: { criteria: [] },
    retained: (old.markets||[]).slice(0,3),
    attractiveness: { categories: Work2.bucketIndicatorsByCategory(old.attractiveness?.indicators||[], 'attractiveness') },
    competitiveness: { categories: Work2.bucketIndicatorsByCategory(old.competitiveness?.indicators||[], 'competitiveness') },
    delphi: {
      recruitment: { perspectives: [] }, personas: [], userHosted: true,
      finalWeights: old.delphi?.weights || null,
      summary: old.delphi?.finalSynthesis || '',
      status: old.delphi?.weights ? 'done' : 'idle', phase: null,
      panel: old.delphi?.panel || [], round1: old.delphi?.round1 || null, round2: old.delphi?.round2 || null,
      synthesis: old.delphi?.synthesis || null, finalSynthesis: old.delphi?.finalSynthesis || null,
      weights: old.delphi?.weights || null
    },
    scoring: {},
    matrix: { xCut: old.matrix?.xCut ?? null, yCut: old.matrix?.yCut ?? null, notes: old.matrix?.notes || '' },
    decision: {
      explanations: {},
      tier1: {
        marketId: old.matrix?.selectedMarketId || null,
        rationale: old.decision?.rationale || '',
        resourcesPct: 80,
        milestones: old.decision?.nextSteps ? [old.decision.nextSteps] : [],
        reEvalTrigger: ''
      },
      tier2: { marketIds: [], observationMetrics: [], reEvalTrigger: '' },
      tier3: { marketIds: [], reEvalTrigger: '' }
    },
    meta: { schemaVersion: 2, work1Linked: false },
    _pipeDone: []
  };
  delete migrated.markets;
  delete migrated.scope;
  // 迁移函数禁止 showToast（AGENTS.md）：统一提示/落盘由 mergeWithDefaults 负责。
  return migrated;
};

/* Work 2 v2 读取统一 helper（work3 上下文 / work4 上下文条 / masthead 摘要共用）：
   decision.tier1.marketId 存在 → 新 schema；否则回退旧 matrix.selectedMarketId + markets。 */
Work2.selectedTiers = function(){
  const w2 = (typeof state !== 'undefined' && state) ? state.work2 : null;
  if(!w2) return { v: 0, tier1: null, tier2: [] };
  const pools = [w2.retained||[], w2.markets||[], w2.candidates||[]];
  const findM = id => { for(const p of pools){ const m = p.find(x=>x.id===id); if(m) return m; } return null; };
  if(w2.decision?.tier1?.marketId){
    const t1 = findM(w2.decision.tier1.marketId);
    const t2 = (w2.decision.tier2?.marketIds||[]).map(id=>findM(id)).filter(Boolean);
    return {
      v: 2,
      tier1: { marketId: w2.decision.tier1.marketId, name: t1?.name||'', rationale: w2.decision.tier1.rationale||'' },
      tier2: t2.map(m=>({ marketId: m.id, name: m.name }))
    };
  }
  if(w2.matrix?.selectedMarketId){
    const m = findM(w2.matrix.selectedMarketId);
    return { v: 1, tier1: { marketId: w2.matrix.selectedMarketId, name: m?.name||'', rationale: w2.decision?.rationale||'' }, tier2: [] };
  }
  return { v: 0, tier1: null, tier2: [] };
};

/* ---------- 骨架渲染 ---------- */
Work2.renderStep = function(id){
  const sec=document.querySelector('#steps2 .step[data-step="'+id+'"]');
  if(!sec) return;
  // RENDER_VERSION guard（契约在 UI.mountGuard，2026-09-01 候选 4）
  if(!UI.mountGuard(sec, Work2, id)) return;
  sec.innerHTML='';
  const idx2 = Work2.steps.findIndex(s=>s.id===id);
  sec.appendChild(el('div',{class:'sub-head'},
    el('span',{class:'num'},'2.'+(idx2+1)),
    el('h3',{}, Work2.titles[id])
  ));
  const subEl2 = Work2.subtitles && Work2.subtitles[id];
  if(subEl2){
    sec.appendChild(el('p',{class:'lede', style:{fontFamily:'var(--font-display)', fontStyle:'normal', fontSize:'1.125rem', lineHeight:1.5, color:'var(--color-ink)', margin:'0 0 28px'}}, subEl2));
  }
  sec.appendChild(el('div',{class:'plate plate--empty'}));
  UI.mountMvo(sec, Work2, id);
  const fn=Work2.render[id]; if(fn) fn(sec);
  // 步间跳转 CTA：本步 mvo 全过后显示「下一步 →」（2026-08-28 统一步间 CTA）
  const nxt=UI.stepNextCta(2,id); if(nxt) sec.querySelector('.plate').appendChild(nxt);
  // 跨工作坊闭环 CTA：末步 mvo 全过后显示「III. 价值主张 →」
  const nw=UI.nextWorkCta(2,id); if(nw) sec.querySelector('.plate').appendChild(nw);
  UI.mountMark(sec, Work2);
};
Work2.rerender = function(id){
  const sec=document.querySelector('#steps2 .step[data-step="'+id+'"]');
  if(!sec) return;
  sec.dataset.rendered='0';
  Work2.renderStep(id);
};
// Bump when changing render output so cached steps re-render for existing users.
Work2.RENDER_VERSION = '2';

// Forced redraw (clears cache + re-renders).
// Called by interactive state-change callbacks after autosave.
Work2.rerender=function(id){
  const sec=document.querySelector('#steps2 .step[data-step="'+id+'"]');
  if(!sec) return;
  sec.dataset.rendered='0';
  Work2.renderStep(id);
};

// Global refreshDynamic: default behavior invalidates cache on any id change,
// so every interactive callback triggers a full rebuild.
Work2.refreshDynamic=function(id){
  Work2.rerender(id);
};

Work2.titles = {
  framework: '构建评估体系',
  evaluate: '评估候选市场',
  decision: '矩阵 + 三档决策'
};
Work2.subtitles = {
  framework: '候选清单 → 筛选标准 → 应用筛选 → 4×2 指标体系 → Hybrid 2 Delphi 定权重。',
  evaluate: '3 个保留市场 × 16 个指标 = 48 格评分；每格必须有依据，AI 打分后人工复核。',
  decision: '加权得分落在吸引力—竞争力矩阵上，起三档决策卡：主战场 / 观察期 / 暂缓。'
};

Work2.mvo = {
  framework: () => ({
    checks: [
      {label:'候选市场 ≥5 个且有入选理由', test:()=>state.work2.candidates.length>=5 && state.work2.candidates.every(c=>(c.reason||'').trim().length>3)},
      {label:'筛选标准 ≥3 个', test:()=>state.work2.screening.criteria.length>=3},
      {label:'保留了 3 个市场', test:()=>state.work2.retained.length===3},
      // 锚点三档缺一不可（打分时三档全用）；空白字符串/纯空格都不算数。
      // 2026-09-12：原检查只看 high 真值——'   ' 能过、mid/low 缺失也能过，MVO 假通过。
      {label:'指标体系完整（每个二级有名称 + 高/中/低锚点）', test:()=>{
        const inds=Work2.allIndicators();
        return inds.length>0 && inds.every(i=>(i.name||'').trim() && i.rubric
          && (i.rubric.high||'').trim() && (i.rubric.mid||'').trim() && (i.rubric.low||'').trim());
      }}
    ],
    note:'评估体系先于打分——没有 rubric（高/中/低锚点）的指标，AI 和你自己打分都会漂移。'
  }),
  evaluate: () => ({
    checks: [
      {label:'每个市场在所有指标上都有分', test:()=>Work2.allIndicators().every(i=>state.work2.retained.every(m=>state.work2.scoring[m.id]?.[i.id]?.score!=null))},
      {label:'每格都有依据（10-30 字）', test:()=>Work2.allIndicators().every(i=>state.work2.retained.every(m=>(state.work2.scoring[m.id]?.[i.id]?.evidence||'').trim().length>=5))}
    ],
    note:'AI 打分后一定要人工复核——尤其你比 AI 更懂的本地市场。依据写不出来，分数大概率是编的。'
  }),
  decision: () => ({
    checks: [
      {label:'已选定主战场（tier1 非空）', test:()=>state.work2.decision.tier1.marketId!=null},
      {label:'写了选择理由', test:()=>(state.work2.decision.tier1.rationale||'').trim().length>20},
      {label:'列了 6 个月里程碑', test:()=>(state.work2.decision.tier1.milestones||[]).some(m=>(m||'').trim().length>3)},
      {label:'写了触发再评估条件', test:()=>!!(state.work2.decision.tier1.reEvalTrigger||'').trim()}
    ],
    note:'好的决策记录"放弃了什么、为什么"——主战场之外，观察期和暂缓市场也要有触发再评估的条件。'
  })
};

Work2.render = {};

/* ---------- 公共工具 ---------- */
// 展平两轴指标：{id, name, axis, catId, catName, rubric, weight(一级内), catWeight}
Work2.allIndicators = function(){
  const out=[];
  ['attractiveness','competitiveness'].forEach(axis=>{
    (state.work2[axis].categories||[]).forEach(cat=>{
      (cat.indicators||[]).forEach(ind=>{
        out.push({...ind, axis, catId:cat.id, catName:cat.name, catWeight:cat.weight??0.25});
      });
    });
  });
  return out;
};
// 有效权重：存储的一级×二级，按轴归一化（收敛后已回填到存储，finalWeights 不再覆盖）
Work2.effectiveWeights = function(){
  const inds = Work2.allIndicators();
  const weights = {attractiveness:{}, competitiveness:{}};
  ['attractiveness','competitiveness'].forEach(axis=>{
    const axisInds = inds.filter(i=>i.axis===axis);
    let sum = 0;
    axisInds.forEach(i=>{
      const w = (i.catWeight ?? 0.25) * (i.weight ?? 0.5);
      weights[axis][i.id] = w; sum += w;
    });
    if(sum>0) axisInds.forEach(i=>{ weights[axis][i.id] /= sum; });
  });
  return weights;
};
Work2.work1Ready = function(){
  return !!(state.work1?.sbu?.name||'').trim();
};
Work2.guardWork1 = function(){
  if(!Work2.work1Ready()){ showToast('work1 未填，请先完成 work1'); return false; }
  return true;
};
// Tab 1 主流水线的完成单元存储
Work2.pipeStore = {
  get(){ return state.work2._pipeDone || []; },
  set(v){ state.work2._pipeDone = v; }
};

/* ---------- TAB 1: 构建评估体系 ---------- */
Work2.render.framework = function(sec){
  const plate = sec.querySelector('.plate');
  const w2 = state.work2;

  // 主按键：AI 从 work1 推导评估体系（4 单元流水线：候选→标准→筛选→指标）
  const ai = el('div',{class:'ai-box'});
  const mid = el('div',{class:'ai-box-mid'});
  const fwGenerated = (state.work2._pipeDone||[]).length>0 || state.work2._frameworkGenerated===true;
  const mainBtn = el('button',{class:'primary'}, fwGenerated ? '重新推导评估体系' : 'AI 从 work1 推导评估体系');
  mid.appendChild(mainBtn);
  const needsAll = ['sbu','environment','personas','competitors'];
  const handle = (typeof AiContext!=='undefined')
    ? AiContext.mountSettings(mid,{workId:'work2', needs:needsAll,
        preview:()=>({system:'4 单元流水线（候选清单→筛选标准→应用筛选→指标体系）', instruction:'点击后按单元顺序执行'})})
    : {current:()=>({sections:needsAll.slice(), fewShot:null})};
  mainBtn.addEventListener('click', ()=>Work2.runFrameworkPipeline(mainBtn, mid, handle.current()));
  ai.appendChild(mid);
  plate.appendChild(ai);

  // 候选市场清单
  plate.appendChild(el('h4',{},'候选市场清单（5-10 个）'));
  const ct=el('div',{class:'table-wrap'});
  const ctbl=el('table',{class:'data'});
  ctbl.innerHTML='<thead><tr><th style="width:24%">市场</th><th>入选理由（需求 / 规模 / 趋势）</th><th style="width:50px"></th></tr></thead>';
  const ctb=el('tbody');
  w2.candidates.forEach((c,i)=>{
    ctb.appendChild(el('tr',{},
      el('td',{},el('input',{value:c.name,oninput:e=>{c.name=e.target.value;autosave()}})),
      el('td',{},el('input',{value:c.reason,oninput:e=>{c.reason=e.target.value;autosave()}})),
      el('td',{},el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Interaction.removeItem({
        list:()=>state.work2.candidates,index:i,type:'候选市场',name:c.name,trigger:e.currentTarget,
        onChange:()=>Work2.afterRemoval('framework')})},'候选市场',()=>c.name,i,()=>state.work2.candidates),'×'))
    ));
  });
  ctbl.appendChild(ctb); ct.appendChild(ctbl); plate.appendChild(ct);
  plate.appendChild(el('button',{class:'small',onclick:()=>{w2.candidates.push({id:uid('cand'),name:'',reason:'',source:'user'});autosave();Work2.rerender('framework')}},'+ 添加候选市场'));

  // 筛选标准
  plate.appendChild(el('h4',{},'筛选标准（3-5 个可观测、可量化）'));
  const st=el('div',{class:'table-wrap'});
  const stbl=el('table',{class:'data'});
  stbl.innerHTML='<thead><tr><th>标准（如：Hofstede UAI > 80）</th><th style="width:30%">数据源</th><th style="width:50px"></th></tr></thead>';
  const stb=el('tbody');
  w2.screening.criteria.forEach((c,i)=>{
    stb.appendChild(el('tr',{},
      el('td',{},el('input',{value:c.name,oninput:e=>{c.name=e.target.value;autosave()}})),
      el('td',{},el('input',{value:c.source||'',oninput:e=>{c.source=e.target.value;autosave()}})),
      el('td',{},el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work2.removeCriterion(i,e.currentTarget)},
        '筛选标准',()=>c.name,i,()=>state.work2.screening.criteria),'×'))
    ));
  });
  stbl.appendChild(stb); st.appendChild(stbl); plate.appendChild(st);
  plate.appendChild(el('button',{class:'small',onclick:()=>{w2.screening.criteria.push({id:uid('crit'),name:'',source:'',kind:'user'});autosave();Work2.rerender('framework')}},'+ 添加标准'));

  // 保留市场（3 张详细字段卡）
  plate.appendChild(el('h4',{},'应用筛选 → 保留 3 个市场'));
  const rGrid = el('div',{class:'grid3'});
  for(let i=0;i<3;i++){
    const m = w2.retained[i];
    const card = el('div',{class:'card'});
    if(!m){
      card.appendChild(el('p',{class:'hint'},'保留市场 '+(i+1)+' — 用「应用筛选」生成或手动添加。'));
      card.appendChild(el('button',{class:'small ghost',onclick:()=>{w2.retained.push({id:uid('m'),name:'',region:'',population:'',gdpPerCapita:'',notes:'',reason:'',source:'user'});autosave();Work2.rerender('framework')}},'+ 手动添加'));
    } else {
      card.appendChild(el('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
        el('input',{value:m.name,style:{fontFamily:'var(--font-display)',fontStyle:'normal',fontSize:'16px'},oninput:e=>{m.name=e.target.value;autosave();App.updateSummary()}}),
        el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work2.removeRetained(i,e.currentTarget)},
          '保留市场',()=>m.name,i,()=>state.work2.retained),'×')));
      [['region','地区'],['population','人口/规模'],['gdpPerCapita','人均 GDP']].forEach(([k,lb])=>{
        card.appendChild(el('div',{class:'field'},el('label',{},lb),el('input',{value:m[k]||'',oninput:e=>{m[k]=e.target.value;autosave()}})));
      });
      card.appendChild(el('div',{class:'field'},el('label',{},'为什么保留'),el('textarea',{rows:2,oninput:e=>{m.reason=e.target.value;autosave()}},m.reason||'')));
      card.appendChild(el('div',{class:'field'},el('label',{},'备注'),el('textarea',{rows:1,oninput:e=>{m.notes=e.target.value;autosave()}},m.notes||'')));
    }
    rGrid.appendChild(card);
  }
  plate.appendChild(rGrid);

  // 指标体系（可折叠一级 card）
  plate.appendChild(el('h4',{},'指标体系（4×2 模板，默认可覆写）'));
  ['attractiveness','competitiveness'].forEach(axis=>{
    const axisLabel = axis==='attractiveness'?'市场吸引力':'业务竞争力';
    plate.appendChild(el('h5',{style:'margin:14px 0 6px'}, axisLabel));
    (w2[axis].categories||[]).forEach((cat,ci)=>{
      const det = el('details',{open:true,class:'plate',style:'margin-bottom:10px'});
      // summary 只做展示，名称与一级权重的编辑入口在展开后第一行——
      // 2026-09-11 修复：原来一级只有 summary 文本，新建的一级维度永远改不了名。
      const sumName = el('span',{}, cat.name || '（未命名一级维度）');
      const sumWeight = el('span',{class:'mono',style:'font-size:12px;color:var(--color-ink-2)'},
        '一级权重 ' + Math.round((cat.weight??0.25)*100) + '%');
      det.appendChild(el('summary',{style:'cursor:pointer;font-family:var(--font-display);font-style:normal;font-size:16px'},
        sumName, '（', sumWeight, '）'));
      const refreshEff = [];   // 一级权重手改 → 该一级下所有二级的有效权重要跟着刷
      det.appendChild(el('div',{style:{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',padding:'10px 0 4px'}},
        el('span',{class:'mono',style:'font-size:11px'},'一级名称'),
        el('input',{value:cat.name||'',placeholder:'如：经济 / 政治法律 / 社会文化 / 风险',style:{flex:1,minWidth:'200px'},
          oninput:e=>{ cat.name=e.target.value; sumName.textContent=cat.name||'（未命名一级维度）'; autosave(); }}),
        el('span',{class:'mono',style:'font-size:11px'},'一级权重'),
        el('input',{type:'number',min:0,max:1,step:0.05,value:cat.weight??0.25,style:{width:'70px'},oninput:e=>{
          cat.weight=parseFloat(e.target.value)||0;
          if(state.work2.delphi.status==='done') state.work2.delphi.drifted=true;
          sumWeight.textContent='一级权重 '+Math.round((cat.weight??0)*100)+'%';
          refreshEff.forEach(fn=>fn());
          autosave();
        }})
      ));
      (cat.indicators||[]).forEach((ind,ii)=>{
        const effPct = () => Math.round(((cat.weight??0.25)*(ind.weight??0.5))*100) + '%';
        const effSpan = el('span',{class:'mono',style:'font-size:11px;color:var(--color-ink-2)',title:'有效权重 = 一级权重 × 二级权重'}, '有效 ' + effPct());
        refreshEff.push(()=>{ effSpan.textContent='有效 '+effPct(); });
        const row = el('div',{style:{borderTop:'1px solid var(--color-rule)',padding:'10px 0'}},
          el('div',{style:{display:'flex',gap:'10px',alignItems:'center'}},
            el('input',{value:ind.name,style:{flex:1},oninput:e=>{ind.name=e.target.value;autosave()}}),
            effSpan,
            el('span',{class:'mono',style:'font-size:11px'}, '二级权重'),
            el('input',{type:'number',min:0,max:1,step:0.05,value:ind.weight??0.5,style:{width:'70px'},oninput:e=>{
              ind.weight=parseFloat(e.target.value)||0;
              if(state.work2.delphi.status==='done') state.work2.delphi.drifted=true;
              effSpan.textContent='有效 '+effPct();
              autosave();
            }}),
            el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Work2.removeIndicator(axis,cat.id,ii,e.currentTarget)},
              '二级指标',()=>ind.name,ii,()=>state.work2[axis].categories.find(c=>c.id===cat.id)?.indicators||[]),'×'))
        );
        const rub = el('div',{class:'grid3',style:'margin-top:6px'});
        ['high','mid','low'].forEach(a=>{
          rub.appendChild(el('div',{class:'field'},
            el('label',{},({high:'高分锚点 (8-10)',mid:'中分锚点 (4-7)',low:'低分锚点 (0-3)'})[a]),
            el('textarea',{rows:2,oninput:e=>{ind.rubric=ind.rubric||{};ind.rubric[a]=e.target.value;autosave()}},ind.rubric?.[a]||'')));
        });
        row.appendChild(rub);
        det.appendChild(row);
      });
      det.appendChild(el('div',{class:'row',style:'margin-top:8px'},
        // 每个一级下最多 2 个二级（4×2 模板）：满了置灰，handler 再挡一道
        el('button',{class:'small ghost',
          disabled: (cat.indicators||[]).length >= Work2.MAX_INDS || null,
          title: (cat.indicators||[]).length >= Work2.MAX_INDS ? '每个一级维度最多 '+Work2.MAX_INDS+' 个二级指标；要新增请先删除现有指标' : '',
          onclick:()=>{
            if((cat.indicators||[]).length >= Work2.MAX_INDS){ showToast('每个一级维度最多 '+Work2.MAX_INDS+' 个二级指标'); return; }
            cat.indicators.push({id:uid('ind'),name:'',rubric:{high:'',mid:'',low:''},weight:0.5,support:0,source:'user'});
            autosave();Work2.rerender('framework');
          }},'+ 二级指标'),
        el('button',Interaction.deleteButton({class:'small ghost',onclick:e=>Work2.removeCategory(axis,ci,e.currentTarget)},
          '一级维度',()=>cat.name,ci,()=>state.work2[axis].categories),'删除整个一级')));
      plate.appendChild(det);
    });
    const footRow = el('div',{class:'row',style:{gap:'8px',flexWrap:'wrap'}});
    // 每轴硬上限 4 个一级（4×2 模板）：满了按钮置灰，handler 再挡一道
    const catFull = (w2[axis].categories||[]).length >= Work2.MAX_CATS;
    footRow.appendChild(el('button',{class:'small',
      disabled: catFull || null,
      title: catFull ? '每轴最多 '+Work2.MAX_CATS+' 个一级维度；要新增请先删除现有一级' : '',
      onclick:()=>{
        if((w2[axis].categories||[]).length >= Work2.MAX_CATS){ showToast('每轴最多 '+Work2.MAX_CATS+' 个一级维度'); return; }
        w2[axis].categories.push({id:uid('cat'),name:'',weight:0.25,indicators:[]});autosave();Work2.rerender('framework');
      }},'+ 一级维度'));
    // 常显：缺一级时点名要补哪个；不缺时点了只提示无需补齐（不会调 AI）。
    // 2026-09-11 先做成“只缺才出现”，结果用户找不到入口——按钮得先被看见。
    const missingCats = Work2.missingTemplateCats(axis);
    footRow.appendChild(el('button',{class:'small ghost',
      title: missingCats.length
        ? '让 AI 只补齐缺的一级维度：'+missingCats.map(t=>t[0]).join(' / ')+'；已有指标、锚点、权重与已打评分都不动'
        : '本轴 4 个一级维度都在；点了只提示无需补齐，不会调 AI',
      onclick:e=>Work2.fillMissingCats(axis, e.currentTarget, footRow)},
      missingCats.length ? 'AI 补齐一级：'+missingCats.map(t=>t[0]).join(' / ') : 'AI 补齐缺失的一级'));
    footRow.appendChild(el('button',{class:'small ghost danger delete-control','aria-label':'恢复'+axisLabel+'默认模板',title:'恢复'+axisLabel+'默认模板','data-tooltip':'恢复'+axisLabel+'默认模板',
      onclick:e=>Work2.restoreAxisTemplate(axis,e.currentTarget)},'恢复默认 4×2 模板'));
    plate.appendChild(footRow);
  });

  // 1.5 Hybrid 2 Delphi
  Work2.renderDelphi(plate);
};

/* 主流水线：候选 → 标准 → 筛选 → 指标 */
Work2.runFrameworkPipeline = function(button, container, cfg){
  if(!Work2.guardWork1()) return;
  // 2026-08-29 重新生成语义：已生成 → 清断点，4 单元完整重跑（直接覆盖）
  if((state.work2._pipeDone||[]).length>0 || state.work2._frameworkGenerated===true) state.work2._pipeDone=[];
  const w1 = state.work1;
  const sections = cfg?.sections || ['sbu','environment','personas','competitors'];
  const pick = needs => sections.filter(s=>needs.includes(s));
  // AI03：schema 随单元交给 aiPipeline → CallJsonStrict，顶层形状不对会带纠偏说明重试一次。
  // 只约束顶层键与明显类型（动态键/深层条目不校验，避免误伤合法变体）。
  const mk = (key, label, fewShot, needs, system, instruction, onResult, schema) => ({
    key, label, jsonMode: true, schema,
    buildPrompt: ()=> AiContext.buildPrompt({workId:'work2', sections:pick(needs), system,
      // 2026-09-01：instruction 支持函数——流水线逐单元执行，下游单元（应用筛选）
      // 必须在执行时读前序单元刚写入的 state；点击时冻结的字符串拿到的是空/旧清单。
      instruction: typeof instruction==='function' ? instruction() : instruction, fewShot}),
    onResult
  });
  const units = [
    mk('fw:candidates','候选清单','work2.candidates',['sbu','environment','personas'],
      '你是国际市场进入策略顾问。基于 SBU 特征，列出 5-10 个值得评估的海外候选市场。',
      '目标客群分布：' + (w1.personas||[]).map(p=>p.region).filter(Boolean).join('、') +
      '\n输出: {"candidates": [{"name": "", "reason": "1 句, 含 需求/规模/趋势 之一"}]}',
      r=>{ if(!r || !Array.isArray(r.candidates) || !r.candidates.length) throw new Error('AI 返回缺少候选市场');
        state.work2.candidates = r.candidates.map(c=>({id:uid('cand'),name:c.name||'',reason:c.reason||'',source:'ai'}));
        state.work2.meta.work1Linked = true; autosave(); },
      {type:'object', required:['candidates'], fields:{candidates:{type:'array'}}}),
    mk('fw:criteria','筛选标准','work2.criteria',['sbu','environment'],
      '你是市场进入策略顾问。基于业务特征，建议 3-5 个可观测、可量化的初筛淘汰标准。每条标准必须能从一个公开数据源查到。',
      '输出: {"criteria": [{"name": "", "source": "数据源名称"}]}',
      r=>{ if(!r || !Array.isArray(r.criteria) || !r.criteria.length) throw new Error('AI 返回缺少评估标准');
        state.work2.screening.criteria = r.criteria.map(c=>({id:uid('crit'),name:c.name||'',source:c.source||'',kind:'ai'}));
        autosave(); },
      {type:'object', required:['criteria'], fields:{criteria:{type:'array'}}}),
    mk('fw:retained','应用筛选','work2.retained',['sbu'],
      '你是市场进入策略顾问。给定 5-10 个候选市场和 3-5 个筛选标准，应用标准淘汰到 3 个保留市场。',
      ()=>'候选: ' + JSON.stringify(state.work2.candidates.map(c=>({name:c.name,reason:c.reason}))) +
      '\n标准: ' + JSON.stringify(state.work2.screening.criteria.map(c=>c.name)) +
      '\n只能从上面的候选清单里选，不得引入清单外的市场。' +
      // 2026-09-01：三个事实字段必须填——空串占位示例会被模型照抄成空值（1.3 卡片全空的根因）
      '\n输出: {"retained": [{"name": "清单中的市场名", "reason": "为什么留", "region": "所属地区如 欧洲/东亚", "population": "人口或规模量级如 约 6700 万", "gdpPerCapita": "人均 GDP 量级如 约 4.9 万美元"}]}，region/population/gdpPerCapita 按真实近似值填写，不得留空。',
      r=>{ if(!r || !Array.isArray(r.retained) || !r.retained.length) throw new Error('AI 返回缺少保留市场');
        state.work2.retained = r.retained.slice(0,3).map(m=>({id:uid('m'),name:m.name||'',region:m.region||'',population:m.population||'',gdpPerCapita:m.gdpPerCapita||'',notes:'',reason:m.reason||'',source:'ai'}));
        state.work2.scoring = {};
        // 保留市场换了 id：三档决策里的旧 marketId 当场消毒，不留悬空选择
        Work2.pruneStaleTiers();
        autosave(); },
      {type:'object', required:['retained'], fields:{retained:{type:'array'}}}),
    // 2026-09-12：指标拆成两单元。原一单元要两轴共 48 段锚点文本，超长被
    // 截断 → JSON 两次解析失败 → callJson 返回 null，旧 onResult 静默 return
    // 却仍被 markDone，表现为「推导完成」但指标体系没生成（/ 只剩默认空模板）。
    // 每轴一单元：payload 减半，单轴失败可断点续跑或粘贴手动箱。
    mk('fw:indicators:attractiveness','指标体系 · 市场吸引力','work2.indicators',['sbu','environment'],
      '你是营销研究方法专家。为海外市场选择的「市场吸引力」轴建议指标：严格输出恰好 4 个一级维度，每个一级下恰好 2 个二级指标（不多不少）。一级维度按模板（可微调名称但不得缺失）：经济 / 政治法律 / 社会文化 / 风险。每个二级指标给出 high/mid/low 评分锚点（high=8-10 分长什么样、mid=4-7、low=0-3），锚点要可观测、可查证。',
      '输出: {"categories": [{"name": "一级维度名", "indicators": [{"name": "二级指标名", "rubric": {"high": "", "mid": "", "low": ""}}, {"name": "同个一级下第 2 个二级", "rubric": {"high": "", "mid": "", "low": ""}}]}, {"name": "共恰好 4 个一级", "indicators": [{"name":"","rubric":{"high":"","mid":"","low":""}},{"name":"","rubric":{"high":"","mid":"","low":""}}]}]}',
      r=>Work2.acceptAxisIndicators('attractiveness', r),
      {type:'object', required:['categories'], fields:{categories:{type:'array'}}}),
    mk('fw:indicators:competitiveness','指标体系 · 业务竞争力','work2.indicators',['sbu','environment','competitors'],
      '你是营销研究方法专家。为海外市场选择的「业务竞争力」轴建议指标：严格输出恰好 4 个一级维度，每个一级下恰好 2 个二级指标（不多不少）。一级维度按模板（可微调名称但不得缺失）：市场信息 / 营销渠道 / 认证合规 / 产品品牌。每个二级指标给出 high/mid/low 评分锚点（high=8-10 分长什么样、mid=4-7、low=0-3），锚点要可观测、可查证。',
      '输出: {"categories": [{"name": "一级维度名", "indicators": [{"name": "二级指标名", "rubric": {"high": "", "mid": "", "low": ""}}, {"name": "同个一级下第 2 个二级", "rubric": {"high": "", "mid": "", "low": ""}}]}, {"name": "共恰好 4 个一级", "indicators": [{"name":"","rubric":{"high":"","mid":"","low":""}},{"name":"","rubric":{"high":"","mid":"","low":""}}]}]}',
      r=>Work2.acceptAxisIndicators('competitiveness', r),
      {type:'object', required:['categories'], fields:{categories:{type:'array'}}})
  ];
  API.aiPipeline({button, container, label:'AI 推导评估体系', units, store:Work2.pipeStore,
    onDone: ()=>{ state.work2._frameworkGenerated=true; autosave(); Work2.rerender('framework'); }});
};

/* ---------- Hybrid 2 Delphi ---------- */
Work2.renderDelphi = function(plate){
  const d = state.work2.delphi;
  plate.appendChild(el('hr',{class:'rule'}));
  plate.appendChild(el('h4',{},'权重：Hybrid 2 Delphi（先招聘后画像）'));
  plate.appendChild(el('p',{class:'muted',style:'font-size:12px;margin:0 0 10px'},
    '论文《AI-Human Hybrids for Marketing Research》（JM 2025）验证：先招聘后画像模式产出异质性更高的合成数据。'));
  const inds = Work2.allIndicators();

  // 招聘
  if(!(d.recruitment.perspectives||[]).length){
    const {box} = API.aiCtxBox({
      workId:'work2', needs:['sbu','environment'], fewShotKey:'delphi.perspectives',
      label:'AI 招聘：该听哪 5 个视角',
      system:'你是营销研究方法专家。给定一个 SBU，建议做“海外市场选择”时应该重点听哪 5 个视角/利益方。',
      instruction:()=>'行业: ' + (state.work1.environment?.industry||'') +
        '\n输出: {"perspectives": [{"name": "视角名", "rationale": "为什么这个视角重要", "keySignals": ["3-5 个该视角最在意的信号"]}]}',
      onResult:r=>{
        if(!r?.perspectives?.length){ showToast('AI 未招募到专家视角，已保留原值'); return; }
        d.recruitment.perspectives = r.perspectives.slice(0,7).map(p=>({name:p.name||'',rationale:p.rationale||'',keySignals:p.keySignals||[]}));
        d.status='recruiting'; d.personas=[]; d.finalWeights=null;
        autosave(); Work2.rerender('framework');
      }
    });
    plate.appendChild(box);
    return;
  }

  // 视角清单（可删）
  const chipRow = el('div',{class:'chip-row',style:'margin-bottom:10px'});
  d.recruitment.perspectives.forEach((p,i)=>{
    const chip = el('span',{class:'chip',title:p.rationale},
      p.name,
      el('button',Interaction.deleteButton({class:'ghost small',style:'margin-left:6px',onclick:e=>Work2.removePerspective(i,e.currentTarget)},
        '招聘视角',()=>p.name,i,()=>state.work2.delphi.recruitment.perspectives),'×'));
    chipRow.appendChild(chip);
  });
  plate.appendChild(chipRow);

  // 5 persona 并行赋权（Runner 可暂停，d.phase 记录已完成 persona 数）
  if(!(d.personas||[]).length || d.status==='personas'){
    const runBtn = el('button',{class:'primary',onclick:e=>Work2.runPersonas(e.currentTarget)},
      (d.personas||[]).length ? '补全 persona 赋权' : '运行 ' + d.recruitment.perspectives.length + ' persona 并行赋权');
    plate.appendChild(el('div',{class:'ai-actions'}, runBtn,
      el('button',{class:'ghost danger delete-control','aria-label':'清空招聘与赋权记录并重新招聘',title:'清空招聘与赋权记录并重新招聘','data-tooltip':'清空招聘与赋权记录并重新招聘',
        onclick:e=>Work2.restartRecruitment(e.currentTarget)},'重新招聘')));
    return;
  }

  // User 主持（no AI）
  plate.appendChild(el('div',{class:'callout'},
    el('span',{class:'callout-title'},'USER HOSTED'),
    el('p',{style:'margin:6px 0 0'},'这 ' + d.personas.length + ' 位视角的权重有分歧。你可以：① 采纳 AI 收敛 ② 手动改（直接改下表权重） ③ 保留分歧给不同方案分别跑矩阵。')));
  const grid = el('div',{class:'grid2'});
  d.personas.forEach(p=>{
    const card = el('div',{class:'card',style:'margin-bottom:12px'});
    card.appendChild(el('div',{style:{fontFamily:'var(--font-display)',fontStyle:'normal',fontSize:'18px'}}, p.perspectiveName + (p.userOverride?' · 已手改':'')));
    if(p.reasoning) card.appendChild(el('p',{class:'hint',style:'margin:4px 0 8px'}, p.reasoning));
    ['attractiveness','competitiveness'].forEach(axis=>{
      const axisInds = inds.filter(i=>i.axis===axis);
      if(!axisInds.length) return;
      card.appendChild(el('div',{class:'mono',style:'font-size:10px;letter-spacing:.15em;color:var(--color-ink-2);margin-top:6px'}, axis==='attractiveness'?'吸引力':'竞争力'));
      axisInds.forEach(ind=>{
        p.ratings = p.ratings || {};
        p.ratings[axis] = p.ratings[axis] || {};
        const row = el('div',{style:{display:'flex',gap:'8px',alignItems:'center',padding:'2px 0'}},
          el('span',{style:{flex:1,fontSize:'12px'}}, ind.name),
          el('input',{type:'number',min:0,max:1,step:0.05,value:(p.ratings[axis][ind.id]??0).toFixed(2),style:{width:'70px',fontFamily:'var(--font-mono)',textAlign:'right'},
            oninput:e=>{p.ratings[axis][ind.id]=parseFloat(e.target.value)||0;p.userOverride=true;autosave();}}));
        card.appendChild(row);
      });
    });
    grid.appendChild(card);
  });
  plate.appendChild(grid);

  // 收敛（可选）1 call
  const convAi = el('div',{class:'ai-box'});
  const convBtn = el('button',{class:'primary',onclick:()=>Work2.converge(convBtn, convAi)}, 'AI 收敛（取均值归一化）');
  convAi.appendChild(convBtn);
  plate.appendChild(convAi);

  if(d.status==='done'){
    const ew = Work2.effectiveWeights();
    plate.appendChild(el('hr',{class:'rule'}));
    plate.appendChild(el('h4',{},'最终权重（已回填到指标体系）'));
    ['attractiveness','competitiveness'].forEach(axis=>{
      plate.appendChild(el('h5',{style:'margin:10px 0 4px'}, axis==='attractiveness'?'市场吸引力':'业务竞争力'));
      const items = inds.filter(i=>i.axis===axis)
        .map(i=>({label:i.name, value:ew[axis]?.[i.id]||0}))
        .sort((a,b)=>b.value-a.value);
      const c = el('section',{class:'plate'});
      // 与 persona 赋权表同口径：0–1 归一化权重、两位小数（不用百分比）
      renderBarChart(c, items, {unit:'', decimals:2});
      plate.appendChild(c);
    });
    if(d.drifted) plate.appendChild(el('div',{class:'callout'},
      el('span',{class:'callout-title'},'已偏离收敛'),
      el('p',{style:{margin:'6px 0 0'}},'指标体系的权重已被手改，评分与矩阵已用最新手改权重。如需回到收敛结果，重新执行 AI 收敛。')));
    if(d.summary) plate.appendChild(el('div',{class:'callout'}, el('span',{class:'callout-title'},'收敛总结'), d.summary));
  }
};

/* persona 并行：每个 persona 一个深 system prompt（含 rationale + keySignals RAG）+ few-shot，并行 call */
Work2.runPersonas = async function(button){
  if(!Work2.guardWork1()) return;
  const d = state.work2.delphi;
  const inds = Work2.allIndicators();
  if(inds.length<2){ showToast('请先完成指标体系（至少 2 个二级指标）'); return; }
  const pers = d.recruitment.perspectives;
  // 并行完成顺序可能与招聘顺序不同；按名称和出现次数匹配，避免删除后漏跑或重复。
  const completed=new Map();
  (d.personas||[]).forEach(p=>completed.set(p.perspectiveName,(completed.get(p.perspectiveName)||0)+1));
  const pending=pers.filter(p=>{const count=completed.get(p.name)||0;if(!count)return true;completed.set(p.name,count-1);return false;});
  const doneN = pers.length-pending.length;
  if(!pending.length){ showToast('persona 已全部完成'); return; }
  const task = Runner.start({id:'work2-delphi-personas', label:'Delphi persona 赋权', button,
    total: pers.length, pausable: true,
    onPause:()=>{ d.status='personas'; autosave(); },
    onResume:()=>{}});
  if(!task) return;
  task.done = doneN;
  d.status='personas';
  Runner.renderUI();
  // RAG：把该视角 keySignals 相关的 work1 字段塞进 prompt（字段级截断）
  const w1 = state.work1;
  const ragFor = p => {
    const sig = (p.keySignals||[]).join('、');
    const bits = [
      '能力: ' + AiContext.tr(['delivery','core','brand','customer','compliance'].map(k=>w1.environment?.ourCapabilities?.[k]).filter(Boolean).join('；'), 300),
      '竞品: ' + (w1.environment?.competitors||[]).slice(0,5).map(c=>c.name).join('、'),
      '客群: ' + (w1.personas||[]).map(x=>x.name).join('、')
    ].filter(Boolean);
    return '你最在意的信号：' + sig + '\n相关资料：\n' + bits.join('\n');
  };
  // BIZ04：persona 一完成即归一化+落盘——中止只丢未完成单元，
  // 已完成单元不重跑（原实现等整批 resolve 后才写，中止即整批丢弃）。
  const applyPersona = (p, r) => {
    if(!r?.ratings){ showToast('该 persona 未返回评分，已跳过'); return; }
    const ratings = {attractiveness:{}, competitiveness:{}};
    inds.forEach(i=>{ ratings[i.axis][i.id] = clamp(Number(r.ratings[i.id])||0, 0, 1); });
    ['attractiveness','competitiveness'].forEach(axis=>{
      const sum = Object.values(ratings[axis]).reduce((a,b)=>a+b,0);
      if(sum>0) Object.keys(ratings[axis]).forEach(k=>ratings[axis][k]=+(ratings[axis][k]/sum).toFixed(3));
    });
    d.personas.push({id:uid('persona'), perspectiveName:p.name, keySignals:p.keySignals||[],
      ratings, reasoning:r.reasoning||'', userOverride:false});
    autosave();
  };
  try{
    // 剩余 persona 并行 call；每个完成即入库（不等待整批）
    await Promise.all(pending.map(async p=>{
      const sys = '你是' + p.name + '专家。' + (p.rationale||'') +
        '\n few-shot 示例：财务紧张创业公司出海 → 短期要回本，权重偏向规模与增长。\n' +
        '请对下列指标赋权重（吸引力维度内总和=1，竞争力维度内总和=1，保留两位小数）。严格输出 JSON。';
      const user = ragFor(p) +
        '\nSBU: ' + w1.sbu.name + ' (' + (w1.sbu.category||'') + ')' +
        '\n范围: ' + (w1.sbu.scope||'') +
        '\n指标:\n' + inds.map(i=>'- [' + i.id + '] (' + i.axis + ') ' + i.name + ': 高分 ' + (i.rubric?.high||'—') + ' / 中分 ' + (i.rubric?.mid||'—') + ' / 低分 ' + (i.rubric?.low||'—')).join('\n') +
        '\n输出: {"ratings": {"<indicatorId>": 0.0-1.0}, "reasoning": "<30字理由>"}';
      const fs = AiContext.fewShotText('delphi.weights');
      const messages = [{role:'system',content:sys}];
      if(fs) messages.push({role:'system',content:'格式示例（仅参考格式，勿照抄内容）：\n'+fs});
      messages.push({role:'user',content:user});
      const r = await API.callJson(messages, {signal:Runner.signal(),
        schema:{type:'object', required:['ratings'], fields:{ratings:{type:'object'}, reasoning:{type:'string'}}}});
      Runner.tick(1);
      if(task.aborted) return;
      applyPersona(p, r);
    }));
    if(task.aborted) return;
    d.status='hosted'; d.phase=null;
    autosave();
  }catch(e){
    if(task.aborted || (e && e.name==='AbortError')){ d.status='personas'; }
    else { showToast('Delphi persona 失败: '+e.message); }
    autosave();
  }finally{
    Runner.finish();
    Work2.rerender('framework');
  }
};

/* 纯函数：多 persona 权重取均值（同轴内归一化）——便于单测 */
Work2.convergeWeights = function(personas, inds){
  const weights = {attractiveness:{}, competitiveness:{}};
  ['attractiveness','competitiveness'].forEach(axis=>{
    const axisInds = inds.filter(i=>i.axis===axis);
    axisInds.forEach(ind=>{
      const vals = personas
        .map(p=>Number(p.ratings?.[axis]?.[ind.id]))
        .filter(v=>!isNaN(v));
      weights[axis][ind.id] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    });
    const sum = Object.values(weights[axis]).reduce((a,b)=>a+b,0);
    if(sum>0) Object.keys(weights[axis]).forEach(k=>weights[axis][k] = weights[axis][k]/sum);
  });
  return weights;
};

/* 纯函数：把收敛权重（轴内和=1）回填到一级+二级，令 一级×二级 == 收敛权重。
   catWeight = 该一级下各二级收敛权重之和；indWeight = 收敛权重 / catWeight。
   无有效收敛权的一级/二级保留原值；全部无效时返回 false（不落回）。 */
Work2.backfillWeightsInto = function(w2Data, weights){
  if(!w2Data || !weights) return false;
  let any = false;
  ['attractiveness','competitiveness'].forEach(axis=>{
    const axisW = weights[axis] || {};
    (w2Data[axis]?.categories||[]).forEach(cat=>{
      let catSum = 0;
      (cat.indicators||[]).forEach(ind=>{
        const w = Number(axisW[ind.id]);
        if(!isNaN(w)) catSum += w;
      });
      if(!(catSum > 0)) return;
      cat.weight = +catSum.toFixed(4);
      (cat.indicators||[]).forEach(ind=>{
        const w = Number(axisW[ind.id]);
        if(isNaN(w)) return;
        ind.weight = +(w/catSum).toFixed(4);
        any = true;
      });
    });
  });
  return any;
};

/* 存量迁移：旧档案 finalWeights 一次性回填两级并释放（幂等：回填后置空，不再触发） */
Work2.migrateDelphiWeights = function(w2Data){
  const d = w2Data?.delphi;
  // 迁移契约：原地改即可（SchemaMigrate 靠 JSON 对比检测变更），返回值必须是
  // undefined 或替换对象——曾 return false/ok 导致 work2 整片被换成布尔。
  if(!d || d.finalWeights == null) return;
  const ok = Work2.backfillWeightsInto(w2Data, d.finalWeights);
  if(ok){ d.status = 'done'; d.drifted = false; }
  d.finalWeights = null;
};

/* 收敛：本地均值（确定性）+ 回填两级 + 可选 1 call AI 总结 */
Work2.converge = async function(btn, container){
  const workspace=state,work=state.work2,d=work.delphi;
  const isCurrent=()=>state===workspace && state.work2===work && state.work2.delphi===d && !(state.meta?.isDemo||state.meta?.demoCase);
  if(!isCurrent())return false;
  const task=Runner.start({id:'work2-converge',label:'权重收敛',button:btn,pausable:false});
  if(!task)return false;
  const inds = Work2.allIndicators();
  const weights = Work2.convergeWeights(d.personas, inds);
  if(!Work2.backfillWeightsInto(work, weights)){
    showToast('无可收敛权重：请先让视角给出有效权重');
    Runner.finish();return false;
  }
  // Local convergence is a completed result; aborting the optional summary keeps it.
  d.drifted = false;
  d.finalWeights=null;d.status='done';autosave();
  try{
    const messages = AiContext.buildPrompt({
      workId:'work2', sections:['sbu','indicators'],
      system:'你是研究方法主持人。' + d.personas.length + ' 位视角分别给出指标权重（已含用户手改）。已按均值归一化，请给出 1 段收敛总结（分歧在哪、共识在哪）。',
      instruction: d.personas.length + ' persona 权重: ' + JSON.stringify(d.personas.map(p=>({name:p.perspectiveName, ratings:p.ratings}))) +
        '\n收敛后权重: ' + JSON.stringify(weights) +
        '\n输出: {"summary": "<1段>"}',
      fewShot:'delphi.converge'
    });
    const r = await API.callJson(messages,{signal:task.controller.signal,
      schema:{type:'object', required:['summary'], fields:{summary:{type:'string'}}}});
    if(task.aborted || !isCurrent())return false;
    d.summary = r?.summary || '';
  }catch(e){
    if(task.aborted || e?.name==='AbortError' || !isCurrent())return false;
    // 降级：本地总结，不阻断权重落地（0-1 call 语义）
    d.summary = '（AI 总结不可用）权重取 ' + d.personas.length + ' 位视角均值并归一化。';
  }finally{
    if(Runner.current===task)Runner.finish();
    if(isCurrent()){autosave();Work2.rerender('framework');}
  }
  showToast('已回填到指标体系');
  return true;
};

/* ---------- TAB 2: 评估候选市场 ---------- */
Work2.render.evaluate = function(sec){
  const plate = sec.querySelector('.plate');
  const mks = state.work2.retained;
  const inds = Work2.allIndicators();
  if(!mks.length){ plate.appendChild(el('div',{class:'warning'},'请先在「应用筛选」保留恰好 3 个市场（当前 0 个）——候选清单 ≠ 保留市场。')); return; }
  if(!inds.length){ plate.appendChild(el('div',{class:'warning'},'请先完成指标体系。')); return; }

  // AI 评分 + 范围选择（全部 / 市场 A / B / C）
  const aiBar = el('div',{class:'ai-box'});
  const mid = el('div',{class:'ai-box-mid'});
  const scopeSel = el('select',{style:{marginBottom:'10px',maxWidth:'220px'}});
  scopeSel.appendChild(el('option',{value:'all'},'范围：全部市场'));
  mks.forEach(m=>scopeSel.appendChild(el('option',{value:m.id},'范围：仅 ' + (m.name||'未命名'))));
  mid.appendChild(scopeSel);
  const scoreBtn = el('button',{class:'primary'}, Work2.hasAnyScore() ? '重新生成' : 'AI 评分');
  mid.appendChild(scoreBtn);
  const needsScore = ['sbu','competitors','personas','metrics','indicators'];
  const handle = (typeof AiContext!=='undefined')
    ? AiContext.mountSettings(mid,{workId:'work2', needs:needsScore, fewShotKey:'work2.scores',
        preview:()=>({system:'你是市场进入评分员…', instruction:'对每个市场在每个指标上打 0-10 分'})})
    : {current:()=>({sections:needsScore.slice(), fewShot:'work2.scores'})};
  scoreBtn.addEventListener('click', ()=>Work2.aiScore(scoreBtn, mid, scopeSel.value, handle.current()));
  aiBar.appendChild(mid);
  plate.appendChild(aiBar);

  // 两轴表格：行=市场，列=指标；每格 score + evidence（必填）+ url（可选）
  ['attractiveness','competitiveness'].forEach((axis,idx)=>{
    plate.appendChild(el('h4',{}, idx===0?'市场吸引力':'业务竞争力'));
    const axisInds = inds.filter(i=>i.axis===axis);
    const table = el('div',{class:'table-wrap'});
    const t = el('table',{class:'data'});
    const head = el('thead'); const hr = el('tr');
    hr.appendChild(el('th',{style:'min-width:90px'},'市场'));
    axisInds.forEach(ind=>hr.appendChild(el('th',{title:'高分：'+(ind.rubric?.high||''),style:'min-width:150px'},
      ind.name + '\n(' + ind.catName + ', w=' + Math.round((Work2.effectiveWeights()[axis][ind.id]||0)*100) + '%)')));
    head.appendChild(hr); t.appendChild(head);
    const tb = el('tbody');
    mks.forEach(mk=>{
      const tr = el('tr');
      tr.appendChild(el('td',{style:{'font-family':'var(--font-display)','font-style':'normal'}}, mk.name||'未命名'));
      axisInds.forEach(ind=>{
        state.work2.scoring[mk.id] = state.work2.scoring[mk.id] || {};
        const cell = state.work2.scoring[mk.id][ind.id] || (state.work2.scoring[mk.id][ind.id] = {score:null, evidence:'', url:'', source:'user'});
        const td = el('td',{class:'score-cell'});
        const inp = el('input',{type:'number',min:0,max:10,step:0.1,value:cell.score??'',placeholder:'—',
          oninput:e=>{cell.score = e.target.value===''?null:clamp(parseFloat(e.target.value),0,10); cell.source='user'; autosave();}});
        td.appendChild(inp);
        if(cell.source==='ai' && cell.score!=null){
          const dot = el('span',{class:'ai-mark',title:'AI 生成，编辑后变为人工'});
          td.appendChild(dot);
          inp.addEventListener('input',()=>dot.remove());
        }
        td.appendChild(el('input',{value:cell.evidence||'',placeholder:'依据（必填 10-30 字）',style:{fontSize:'11px',marginTop:'4px'},
          oninput:e=>{cell.evidence=e.target.value;autosave()}}));
        td.appendChild(el('input',{value:cell.url||'',placeholder:'URL（可选）',style:{fontSize:'11px',marginTop:'2px'},
          oninput:e=>{cell.url=e.target.value;autosave()}}));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb); table.appendChild(t); plate.appendChild(table);
  });
};

/* AI 评分：每市场一个单元，调用边界可暂停；已完成市场在中止后保留。 */
Work2.aiScore = async function(btn, container, scope, cfg){
  if(!Work2.guardWork1()) return false;
  const workspace=state,work=state.work2;
  const isCurrent=()=>state===workspace && state.work2===work && !(state.meta?.isDemo||state.meta?.demoCase);
  if(!isCurrent())return false;
  const mks=(scope==='all' ? work.retained : work.retained.filter(m=>m.id===scope)).slice();
  if(!mks.length){ showToast('没有可评分的市场'); return false; }
  const inds = Work2.allIndicators();
  const task=Runner.start({id:'work2-score',label:'市场评分',button:btn,total:mks.length,pausable:mks.length>1});
  if(!task)return false;
  let emptyResults = 0;
  const indBlock = inds.map(i=>'[' + i.id + '] (' + i.axis + ') ' + i.name +
    '\n  高分(8-10): ' + (i.rubric?.high||'—') + '\n  中分(4-7): ' + (i.rubric?.mid||'—') + '\n  低分(0-3): ' + (i.rubric?.low||'—')).join('\n');
  try{
   for(const mk of mks){
    await Runner.checkpoint();
    if(task.aborted || !isCurrent())return false;
    const messages = AiContext.buildPrompt({
      workId:'work2', sections:(cfg?.sections||[]),
      system:'你是市场进入评分员。根据 SBU 与 rubric，对给定市场在每个指标上打 0-10 分（保留一位小数），并给 10-30 字依据。严格输出 JSON。',
      instruction:'市场: ' + mk.name + ' (' + [mk.region,mk.population,mk.gdpPerCapita].filter(Boolean).join(', ') + ')' +
        '\n指标:\n' + indBlock +
        '\n输出: {"scores": {"<id>": 0-10}, "evidence": {"<id>": "10-30 字依据"}, "sources": {"<id>": "可选 URL"}}',
      fewShot: cfg?.fewShot
    });
    try{
      const r = await API.callJson(messages,{signal:task.controller.signal,
        schema:{type:'object', required:['scores'], fields:{scores:{type:'object'}, evidence:{type:'object'}, sources:{type:'object'}}}});
      if(task.aborted || !isCurrent())return false;
      if(!work.retained.some(m=>m===mk))continue;
      if(!r || !r.scores || !Object.keys(r.scores).length){
        emptyResults++;
      }else{
      // 有效结果整体替换该市场的评分，避免旧结果与新结果拼接。
      const validIds=new Set(Work2.allIndicators().map(i=>i.id));
      work.scoring[mk.id] = {};
      Object.entries(r.scores).forEach(([k,v])=>{
        if(!validIds.has(k))return;
        work.scoring[mk.id][k] = {
          score: clamp(Number(v),0,10),
          evidence: r.evidence?.[k] || '',
          url: r.sources?.[k] || '',
          source: 'ai'
        };
      });
      autosave();
      }
    }catch(e){
      if(task.aborted || e?.name==='AbortError' || !isCurrent())return false;
      emptyResults++;
    }
    Runner.tick();
   }
    await Runner.checkpoint();
    if(task.aborted || !isCurrent())return false;
    if(emptyResults) showToast(emptyResults===mks.length ? 'AI 未返回评分，已保留原值' : '评分完成，'+emptyResults+' 个市场未返回评分');
    else showToast('评分完成');
    return emptyResults<mks.length;
  }catch(e){
    if(!(task.aborted || e?.name==='AbortError') && isCurrent())showToast('评分失败：'+e.message);
    return false;
  }finally{
    if(task.aborted && isCurrent())showToast('已中止，已完成市场评分保留');
    if(Runner.current===task)Runner.finish();
    if(isCurrent())Work2.rerender('evaluate');
  }
};

/* 是否已有任何评分（驱动「AI 评分」→「重新生成」按钮语义，同 887 决策卡模式） */
Work2.hasAnyScore = () => Object.values(state.work2.scoring||{})
  .some(mk => mk && Object.values(mk).some(c => c && c.score != null));

/* ---------- TAB 3: 矩阵 + 三档决策 ---------- */
Work2.computeMatrix = function(){
  const mks = state.work2.retained || [];
  const w = Work2.effectiveWeights();
  return mks.map(mk=>{
    const sc = state.work2.scoring[mk.id] || {};
    let a=0, c=0, swA=0, swC=0;
    Work2.allIndicators().forEach(ind=>{
      const v = sc[ind.id]?.score;
      if(v==null || isNaN(v)) return;
      const wt = w[ind.axis][ind.id] || 0;
      if(ind.axis==='attractiveness'){ a += v*wt; swA += wt; }
      else { c += v*wt; swC += wt; }
    });
    return {...mk, x: swC ? c/swC : 0, y: swA ? a/swA : 0};
  });
};

Work2.render.decision = function(sec){
  const plate = sec.querySelector('.plate');
  const d = state.work2.decision;
  const mks = state.work2.retained || [];
  // 兜底消毒：覆盖导入/迁移/其它改写保留市场的入口——悬空的 tier id 会让
  // 下拉退回「— 必选 —」而 MVO 仍报 tier1 非空（假通过）。
  if(Work2.pruneStaleTiers()) autosave();
  const pts = Work2.computeMatrix();
  if(!pts.length){ plate.appendChild(el('div',{class:'warning'},'请先完成候选市场与评分。')); return; }
  const cuts = Work2.matrixCuts();
  const hasStar = pts.length>=2 && pts.some(p=>Work2.quadrant(p.x,p.y)==='明星');
  // 2026-09-01 grilling：象限是分析结论，三档是资源决策——无明星时不代填、明示取舍义务。
  if(pts.length>=2 && !hasStar){
    plate.appendChild(el('div',{class:'warning'},'当前无明星市场（双高象限空缺）：tier1 主战场是战略取舍而非矩阵结论，请让理由说明取舍。'));
  }

  // AI 解释 + 起三档决策卡（单 call）
  const {box} = API.aiCtxBox({
    workId:'work2', needs:['sbu','recommendations','matrix','markets','indicators'], fewShotKey:'work2.tiers',
    label:((d.explanations && Object.keys(d.explanations).length>0) || !!d.tier1?.marketId) ? '重新生成三档决策卡' : 'AI 解释 + 起三档决策卡',
    system:'你是国际市场战略顾问。基于矩阵结果，给出三档决策 + 每档象限解释 + 触发再评估条件。',
    instruction:()=>'边界: ' + (state.work1.sbu.boundary||'') +
      '\n建议: 短期 ' + (state.work1.recommendations?.short||'') + ' / 中期 ' + (state.work1.recommendations?.mid||'') + ' / 长期 ' + (state.work1.recommendations?.long||'') +
      '\n矩阵结果:\n' + pts.map(p=>'- [id=' + p.id + '] ' + p.name + ': 吸引力 ' + p.y.toFixed(2) + ', 竞争力 ' + p.x.toFixed(2) + ', 象限 ' + Work2.quadrant(p.x,p.y)).join('\n') +
      '\n象限语义: 明星=双高·重点投入 / 潜力=吸引力高竞争力低·补能力 / 产能=竞争力高吸引力低·选择性收割 / 双低=放弃' +
      (hasStar ? '' : '\n当前无明星市场：tier1 选非明星市场时，rationale 必须写明取舍（选它要补什么能力、放弃什么）。') +
      '\n输出: explanations / tier1 / tier2 / tier3 四段 JSON（marketId 用上面给出的 id）。',
    onResult:r=>{
      if(!r || typeof r!=='object' || !(r.explanations || r.tier1 || r.tier2 || r.tier3)){
        showToast('AI 未返回三档决策，已保留原值'); return;
      }
      if(r.explanations) d.explanations = r.explanations;
      ['tier1','tier2','tier3'].forEach(t=>{
        if(!r[t]) return;
        Object.keys(r[t]).forEach(k=>{ d[t][k] = r[t][k]; });
      });
      // AI 回填的 id 必须落在矩阵点清单内：幻觉 id 会让 tier1 名字变空串，
      // 并随跨坊 CTA 污染下游 workshop（2026-09-01 审计）。
      Work2.sanitizeTiers(d, pts.map(p=>p.id));
      // tier1 变更后联动：保证 tier2/3 不含 tier1 市场
      if(d.tier1.marketId) Work2.syncTiers(d.tier1.marketId);
      d.cutsChanged = false;  // 新解释按当前口径生成，过期提示解除
      autosave(); Work2.rerender('decision'); App.updateSummary();
    }
  });
  plate.appendChild(box);

  // 散点图（4 象限：明星 / 产能 / 双低 / 潜力）
  const scatterPlate = el('section',{class:'plate'},
    el('span',{class:'plate-label'},'F8 · PLUMB SCATTER · 吸引力 × 竞争力'));
  renderMatrix({
    container:scatterPlate, points:pts.map(p=>({id:p.id,label:p.name,x:p.x,y:p.y})),
    xLabel:'业务竞争力（加权）', yLabel:'市场吸引力（加权）',
    xCut:cuts.xCut, yCut:cuts.yCut,
    selectedId:d.tier1.marketId,
    qHighHigh:'明星市场（重点投入）', qHighYLowX:'潜力市场（补能力）',
    qlowYHighX:'产能市场（选择性收割）', qLowLow:'放弃市场',
    onSelect:id=>{ Work2.setTier1(id); }
  });
  // 2026-09-01 修复：scatterPlate 此前从未挂载，矩阵图画进孤儿节点（用户看不到）。
  plate.appendChild(scatterPlate);
  plate.appendChild(el('div',{class:'grid3',style:{marginTop:'14px'}},
    UI.field('X 轴切分线 · 留空=自动（区间中点）', el('input',{type:'number',min:0,max:10,step:0.1,value:state.work2.matrix.xCut??'',onchange:e=>{state.work2.matrix.xCut=e.target.value===''?null:parseFloat(e.target.value);state.work2.decision.cutsChanged=true;autosave();Work2.rerender('decision')}})),
    UI.field('Y 轴切分线 · 留空=自动（区间中点）', el('input',{type:'number',min:0,max:10,step:0.1,value:state.work2.matrix.yCut??'',onchange:e=>{state.work2.matrix.yCut=e.target.value===''?null:parseFloat(e.target.value);state.work2.decision.cutsChanged=true;autosave();Work2.rerender('decision')}})),
    UI.field('矩阵备注', el('input',{type:'text',value:state.work2.matrix.notes,oninput:e=>{state.work2.matrix.notes=e.target.value;autosave()}}))
  ));
  // 口径变更后旧 AI 解释不自动销毁，只提示（2026-09-01 grilling 决策 4-B）。
  if(d.cutsChanged && Object.keys(d.explanations||{}).length){
    plate.appendChild(el('div',{class:'warning'},'矩阵口径已变，AI 解释可能过期——可点上方按钮重新生成。'));
  }

  // 排名表
  plate.appendChild(el('h4',{},'排名'));
  const table = el('div',{class:'table-wrap'});
  const t = el('table',{class:'data'});
  t.innerHTML='<thead><tr><th>#</th><th>市场</th><th>吸引力</th><th>竞争力</th><th>象限</th><th>解释</th></tr></thead>';
  const tb = el('tbody');
  [...pts].sort((a,b)=>(b.x+b.y)-(a.x+a.y)).forEach((p,i)=>{
    const q = Work2.quadrant(p.x, p.y);
    tb.appendChild(el('tr',{},
      el('td',{},String(i+1)),
      el('td',{style:{'font-style':'normal'}}, p.name + (p.id===d.tier1.marketId?' *':'')),
      el('td',{class:'mono'},p.y.toFixed(2)),
      el('td',{class:'mono'},p.x.toFixed(2)),
      el('td',{},el('span',{class:'tag '+(q==='明星'?'maroon':'')},q)),
      el('td',{class:'hint',style:'max-width:240px;white-space:normal;text-transform:none;letter-spacing:0'}, d.explanations?.[p.name]||'')
    ));
  });
  t.appendChild(tb); table.appendChild(t); plate.appendChild(table);

  // 三档决策卡
  plate.appendChild(el('h4',{},'三档决策卡'));
  const grid = el('div',{class:'grid3'});
  // tier1 主战场（强制非空）
  const c1 = el('div',{class:'card'});
  c1.appendChild(el('div',{class:'hint'},'TIER 1 · 主战场'));
  const sel1 = el('select',{onchange:e=>{ Work2.setTier1(e.target.value||null); }});
  sel1.appendChild(el('option',{value:''},'— 必选 —'));
  mks.forEach(m=>{ const o = el('option',{value:m.id}, m.name||'未命名'); if(m.id===d.tier1.marketId) o.selected=true; sel1.appendChild(o); });
  c1.appendChild(sel1);
  c1.appendChild(el('div',{class:'field'},el('label',{},'为什么选它'),el('textarea',{rows:3,oninput:e=>{d.tier1.rationale=e.target.value;autosave()}},d.tier1.rationale)));
  c1.appendChild(el('div',{class:'field'},el('label',{},'资源占比 %'),el('input',{type:'number',min:0,max:100,value:d.tier1.resourcesPct,oninput:e=>{d.tier1.resourcesPct=parseInt(e.target.value)||0;autosave()}})));
  c1.appendChild(el('div',{class:'field'},el('label',{},'6 个月里程碑')));
  (d.tier1.milestones||[]).forEach((ms,i)=>{
    c1.appendChild(el('div',{style:{display:'flex',gap:'6px',marginBottom:'4px'}},
      el('input',{value:ms,style:{flex:1},oninput:e=>{d.tier1.milestones[i]=e.target.value;autosave()}}),
      el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Interaction.removeItem({
        list:()=>state.work2.decision.tier1.milestones,index:i,type:'里程碑',name:state.work2.decision.tier1.milestones[i],trigger:e.currentTarget,
        onChange:()=>Work2.afterRemoval('decision')})},'里程碑',()=>state.work2.decision.tier1.milestones[i],i,()=>state.work2.decision.tier1.milestones),'×')));
  });
  c1.appendChild(el('button',{class:'small ghost',onclick:()=>{d.tier1.milestones.push('');autosave();Work2.rerender('decision')}},'+ 里程碑'));
  c1.appendChild(el('div',{class:'field'},el('label',{},'触发再评估条件'),el('input',{value:d.tier1.reEvalTrigger||'',oninput:e=>{d.tier1.reEvalTrigger=e.target.value;autosave()}})));
  grid.appendChild(c1);
  // tier2 观察期 / tier3 暂缓（复选）
  [['tier2','TIER 2 · 观察期'],['tier3','TIER 3 · 放弃 / 暂缓']].forEach(([key,label])=>{
    const card = el('div',{class:'card'});
    card.appendChild(el('div',{class:'hint'},label));
    mks.forEach(m=>{
      if(m.id===d.tier1.marketId) return;
      const on = (d[key].marketIds||[]).includes(m.id);
      card.appendChild(el('label',{class:'ai-settings-check'},
        (()=>{const cb=el('input',{type:'checkbox',checked:on});cb.style.width='auto';cb.addEventListener('change',()=>{
          const arr=d[key].marketIds; const i=arr.indexOf(m.id);
          if(cb.checked&&i<0) arr.push(m.id); if(!cb.checked&&i>=0) arr.splice(i,1);
          autosave();
        });return cb;})(),
        ' ' + (m.name||'未命名')));
    });
    if(key==='tier2'){
      card.appendChild(el('div',{class:'field',style:'margin-top:8px'},el('label',{},'观察指标')));
      (d.tier2.observationMetrics||[]).forEach((om,i)=>{
        card.appendChild(el('div',{style:{display:'flex',gap:'6px',marginBottom:'4px'}},
          el('input',{value:om,style:{flex:1},oninput:e=>{d.tier2.observationMetrics[i]=e.target.value;autosave()}}),
          el('button',Interaction.deleteButton({class:'ghost small',onclick:e=>Interaction.removeItem({
            list:()=>state.work2.decision.tier2.observationMetrics,index:i,type:'观察指标',name:state.work2.decision.tier2.observationMetrics[i],trigger:e.currentTarget,
            impact:'该条观察指标会从观察期决策卡和导出中删除；其它观察指标、市场选择与评分保留。',
            onChange:()=>Work2.afterRemoval('decision')})},'观察指标',()=>state.work2.decision.tier2.observationMetrics[i],i,()=>state.work2.decision.tier2.observationMetrics),'×')));
      });
      card.appendChild(el('button',{class:'small ghost',onclick:()=>{d.tier2.observationMetrics.push('');autosave();Work2.rerender('decision')}},'+ 观察指标'));
    }
    card.appendChild(el('div',{class:'field'},el('label',{},'触发再评估条件'),el('input',{value:d[key].reEvalTrigger||'',oninput:e=>{d[key].reEvalTrigger=e.target.value;autosave()}})));
    grid.appendChild(card);
  });
  plate.appendChild(grid);
};

/* 切分线唯一出口（ADR 0010）：手动值优先；留空 → 自动区间中点 (min+max)/2。
   旧默认中位数在 3 点场景必然穿过中间市场的圆心，>= 平局裁决静默加冕象限
   （2026-09-01 荷兰案例：表格判「明星」、图上看不出）。表格/图/AI/导出一律走这里。 */
Work2.matrixCuts = function(){
  const pts = Work2.computeMatrix();
  const mid = vs => vs.length>=2 ? (Math.min(...vs)+Math.max(...vs))/2 : null;
  return {
    xCut: state.work2.matrix.xCut ?? mid(pts.map(p=>p.x)),
    yCut: state.work2.matrix.yCut ?? mid(pts.map(p=>p.y))
  };
};

Work2.quadrant = function(x, y){
  const pts = Work2.computeMatrix();
  if(pts.length<2) return '—';  // 单市场无切分意义
  const {xCut, yCut} = Work2.matrixCuts();
  if(x>=xCut && y>=yCut) return '明星';
  if(x<xCut && y>=yCut) return '潜力';
  if(x>=xCut && y<yCut) return '产能';
  return '双低';
};

/* 改 tier1.marketId → tier2/tier3 自动调整：旧主战场若不在任何档则降入观察期 */
/* AI 回填的三档 id 消毒：不在合法清单内的 marketId/marketIds 直接丢弃（幻觉防线） */
Work2.sanitizeTiers = function(d, validIds){
  const has = id => validIds.includes(id);
  if(d.tier1 && d.tier1.marketId!=null && !has(d.tier1.marketId)) d.tier1.marketId = null;
  ['tier2','tier3'].forEach(t=>{
    if(d[t] && Array.isArray(d[t].marketIds)) d[t].marketIds = [...new Set(d[t].marketIds.filter(has))];
  });
  return d;
};

Work2.setTier1 = function(marketId){
  const d = state.work2.decision;
  const prev = d.tier1.marketId;
  if(!marketId){ return; }
  d.tier1.marketId = marketId;
  Work2.syncTiers(marketId, prev);
  autosave(); Work2.rerender('decision'); App.updateSummary();
};
Work2.syncTiers = function(marketId, prev){
  const d = state.work2.decision;
  [d.tier2.marketIds, d.tier3.marketIds].forEach(arr=>{
    const i = arr.indexOf(marketId);
    if(i>=0) arr.splice(i,1);
  });
  if(prev && prev!==marketId && !d.tier2.marketIds.includes(prev) && !d.tier3.marketIds.includes(prev)){
    d.tier2.marketIds.push(prev);
  }
};

/* ---------- 导出 ---------- */
Work2.exportMd = function(){
  const d = state.work2;
  let out = '\n## II. 目标市场选择\n\n';
  out += '### 1. 候选市场清单\n';
  d.candidates.forEach(c=>{ out += '- **' + c.name + '**：' + (c.reason||'') + '\n'; });
  out += '\n### 2. 筛选标准\n';
  d.screening.criteria.forEach(c=>{ out += '- ' + c.name + (c.source ? '（数据源：' + c.source + '）' : '') + '\n'; });
  out += '\n### 3. 保留市场（应用筛选后）\n';
  d.retained.forEach(m=>{ out += '- **' + m.name + '**（' + [m.region,m.population,m.gdpPerCapita].filter(Boolean).join('，') + '）— ' + (m.reason||m.notes||'') + '\n'; });
  out += '\n### 4. 指标体系与权重\n';
  const ew = Work2.effectiveWeights();
  ['attractiveness','competitiveness'].forEach(axis=>{
    out += '**' + (axis==='attractiveness'?'市场吸引力':'业务竞争力') + '**：\n';
    d[axis].categories.forEach(cat=>{
      out += '- ' + cat.name + '（一级权重 ' + Math.round((cat.weight??0.25)*100) + '%）\n';
      cat.indicators.forEach(i=>{
        const w = Math.round((ew[axis]?.[i.id] ?? (cat.weight??0.25)*(i.weight??0.5)) * 100);
        out += '  - ' + i.name + '（权重 ' + w + '%）— 高：' + (i.rubric?.high||'—') + '；中：' + (i.rubric?.mid||'—') + '；低：' + (i.rubric?.low||'—') + '\n';
      });
    });
  });
  if(d.delphi.personas.length){
    out += '\n**Hybrid 2 Delphi**：' + d.delphi.personas.map(p=>p.perspectiveName).join('、') + '\n';
    if(d.delphi.summary) out += '> ' + d.delphi.summary + '\n';
  }
  out += '\n### 5. 评分与矩阵\n';
  Work2.computeMatrix().forEach(p=>{
    out += '- **' + p.name + '**（' + (p.region||'') + '）— 吸引力 ' + p.y.toFixed(2) + '，竞争力 ' + p.x.toFixed(2) + '，象限：' + Work2.quadrant(p.x,p.y) + '\n';
  });
  const nameOf = id => (d.retained.find(m=>m.id===id)||{}).name || '未知';
  out += '\n### 6. 三档决策\n';
  out += '- **主战场**：' + nameOf(d.decision.tier1.marketId) + '（资源 ' + d.decision.tier1.resourcesPct + '%）\n';
  out += '  - 理由：' + (d.decision.tier1.rationale||'') + '\n';
  (d.decision.tier1.milestones||[]).forEach(ms=>{ out += '  - 里程碑：' + ms + '\n'; });
  out += '  - 再评估触发：' + (d.decision.tier1.reEvalTrigger||'') + '\n';
  out += '- **观察期**：' + (d.decision.tier2.marketIds||[]).map(nameOf).join('、') + '\n';
  (d.decision.tier2.observationMetrics||[]).forEach(om=>{ out += '  - 观察：' + om + '\n'; });
  out += '  - 再评估触发：' + (d.decision.tier2.reEvalTrigger||'') + '\n';
  out += '- **暂缓**：' + ((d.decision.tier3.marketIds||[]).map(nameOf).join('、')||'无') + '\n';
  out += '  - 再评估触发：' + (d.decision.tier3.reEvalTrigger||'') + '\n';
  return out;
};

// 2026-09-01 候选 4：迁移注册契约（v2 重构 + Delphi 权重回填）
Work2.workKey = 'work2';
Work2.migrations = [Work2.migrateWork2, Work2.migrateDelphiWeights];
