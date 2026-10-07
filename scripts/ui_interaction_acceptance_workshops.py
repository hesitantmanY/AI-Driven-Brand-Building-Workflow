"""A06–A11, A16–A20 and A22 against mounted workshop UI.

Fixtures and controlled AI replies are synthetic. Every destructive action,
confirmation, undo, navigation and keyboard action uses the actual UI. State
reads verify the affected objects and the disposable API verifies persistence.
"""
from __future__ import annotations

import json
import re
import time


FULL = r"""
Object.assign(state.work1.sbu, {
 name:'验收合成品牌',category:'合成产品',stage:'成长',scope:'国内',
 summary:'面向合成验收客户提供可以重复验证的产品与服务，记录具体业务边界。',
 boundary:'客户独立获取，渠道独立经营，品牌独立使用，损益独立核算；仅共享母公司的基础设施与采购资源。',
 threeQuestions:{customer:true,channel:true,brand:true}
});
Object.assign(state.work1.environment,{
 political:'合成政治环境来源及可复核的市场准入事实。',
 economic:'合成经济环境来源及可复核的购买力事实。',
 social:'合成社会环境来源及可复核的消费行为事实。',
 technological:'合成技术环境来源及可复核的技术供给事实。',
 competitors:[
 {id:'cmp-a',name:'竞品甲',price:'11',strengths:'甲优势',weaknesses:'甲不足',position:'甲定位'},
 {id:'cmp-b',name:'竞品乙',price:'22',strengths:'乙优势',weaknesses:'乙不足',position:'乙定位'},
 {id:'cmp-c',name:'竞品丙',price:'33',strengths:'丙优势',weaknesses:'丙不足',position:'丙定位'}]
});
state.work1.personas=['p-a','p-b','p-c'].map((id,i)=>({id,name:'P'+(i+1),gender:'女',age:'28',occupation:'合成职业',income:'合成收入',region:'国内',painPoints:'稳定可验证的合成客户痛点',values:['可靠'],channels:['自营'],quote:'合成原话',traits:[]}));
state.work1.scenarios=[
 {id:'ws-a',name:'日常场景',personaIds:['p-a','p-b'],benefits:{usage:8,service:7,staff:6,image:5},costs:{monetary:2,time:2,energy:2,psychic:2},anchor:'具体合成场景',decisiveGap:'合成缺口'},
 {id:'ws-b',name:'独立场景',personaIds:[],benefits:{usage:7,service:6,staff:5,image:4},costs:{monetary:1,time:1,energy:1,psychic:1},anchor:'独立场景',decisiveGap:'独立缺口'}
];
state.work1.metrics.dimensions=[
 {id:'md-a',name:'合成一级指标',secondaries:[{id:'mi-a',name:'关联测评点',measure:'合成口径',selfScore:7,actual:8,actualN:1},{id:'mi-b',name:'独立测评点',measure:'独立口径',selfScore:6,actual:6,actualN:1}]},
 {id:'md-b',name:'保留一级指标',secondaries:[{id:'mi-c',name:'保留测评点',measure:'保留口径',selfScore:5,actual:5,actualN:1}]}
];
state.work1.survey.questions=[
 {id:'q-a',type:'likert',text:'关联生成题',sourceIndicatorId:'mi-a',anchors:['1','2','3','4','5']},
 {id:'q-b',type:'likert',text:'保留生成题',sourceIndicatorId:'mi-c',anchors:['1','2','3','4','5']},
 {id:'q-open',type:'open',text:'手动开放题',sourceIndicatorId:null},
 {id:'q-free',type:'open',text:'无依赖题目',sourceIndicatorId:null}
];
state.work1.survey.responses=[{personaId:'p-a',answers:[{questionId:'q-a',value:4,raw:'同意'},{questionId:'q-b',value:3,raw:'一般'},{questionId:'q-open',value:'上游原文一',raw:'上游原文一'}]}];
state.work1.survey.status='done';state.work1.survey._doneKeys=['p-a:q-a','p-a:q-b','p-a:q-open'];
state.work1.survey.progress={done:3,total:3};
state.work1.analysis.likertStats={'q-a':{mean:4,sd:0,n:1,dist:[0,0,0,1,0]},'q-b':{mean:3,sd:0,n:1,dist:[0,0,1,0,0]}};
state.work1.analysis.openThemes=[{questionId:'q-open',question:'手动开放题',texts:['上游原文一','上游原文二'],themes:[{label:'上游主题',count:2}],quotes:['上游原文一']}];
state.work1.analysis.indicatorMeans=[{sourceIndicatorId:'mi-a',mean:4,value:4,n:1},{sourceIndicatorId:'mi-c',mean:3,value:3,n:1}];
state.work1.analysis.insights='合成洞察用于验证删除依赖范围，历史答卷应按明确范围保留。';
state.work2.candidates=[{id:'mk-a',name:'候选甲',reason:'甲理由',source:'user'},{id:'mk-b',name:'候选乙',reason:'乙理由',source:'user'},{id:'mk-c',name:'候选丙',reason:'丙理由',source:'user'}];
state.work2.screening.criteria=[{id:'sc-a',name:'合成筛选标准',source:'合成来源',kind:'user'}];
state.work2.retained=[{id:'ret-a',name:'保留甲',region:'国内',population:10,gdpPerCapita:20,notes:'甲详情',source:'合成来源'},{id:'ret-b',name:'保留乙',region:'国内',population:20,gdpPerCapita:30,notes:'乙详情',source:'合成来源'}];
state.work2.attractiveness.categories=[{id:'cat-a',name:'吸引力维度',weight:1,indicators:[{id:'ind-a',name:'吸引力指标',weight:.5,rubric:{high:'高合成锚点',mid:'中合成锚点',low:'低合成锚点'},source:'user'},{id:'ind-b',name:'独立吸引力指标',weight:.5,rubric:{high:'高',mid:'中',low:'低'},source:'user'}]}];
state.work2.competitiveness.categories=[{id:'cat-b',name:'竞争力维度',weight:1,indicators:[{id:'ind-c',name:'竞争力指标',weight:1,rubric:{high:'高',mid:'中',low:'低'},source:'user'}]}];
state.work2.scoring={'ret-a':{'ind-a':{score:8,evidence:'甲评分',source:'user'},'ind-b':{score:7,evidence:'乙评分',source:'user'},'ind-c':{score:8,evidence:'竞争评分',source:'user'}},'ret-b':{'ind-a':{score:5,evidence:'保留评分',source:'user'},'ind-b':{score:4,evidence:'保留评分',source:'user'},'ind-c':{score:5,evidence:'保留评分',source:'user'}}};
state.work2.delphi.recruitment.perspectives=[{name:'合成视角',rationale:'合成来源'},{name:'保留视角',rationale:'保留来源'}];
state.work2.delphi.personas=[{id:'dp-a',name:'合成赋权者',perspectiveName:'合成视角',ratings:{attractiveness:{'ind-a':60,'ind-b':40},competitiveness:{'ind-c':100}}},{id:'dp-b',name:'保留赋权者',perspectiveName:'保留视角',ratings:{attractiveness:{'ind-a':40,'ind-b':60},competitiveness:{'ind-c':100}}}];
state.work2.delphi.status='done';state.work2.delphi.summary='旧收敛总结';state.work2.delphi.finalWeights={attractiveness:{'ind-a':.5,'ind-b':.5},competitiveness:{'ind-c':1}};
state.work2._pipeDone=['fw:retained'];
Object.assign(state.work2.decision.tier1,{marketId:'ret-a',rationale:'甲主战场理由',milestones:['里程碑甲','里程碑乙'],resourcesPct:80});
Object.assign(state.work2.decision.tier2,{marketIds:['ret-b'],observationMetrics:['观察指标甲','观察指标乙']});
state.work2.decision.explanations={'保留甲':'甲矩阵解释','保留乙':'乙矩阵解释'};
state.work3.scenarios=[{id:'s-a',name:'卖点场景甲',description:'合成场景描述',personaIds:['p-a','p-b'],needStrength:{pain:8,willingness:7,frequency:6},selected:true},{id:'s-b',name:'卖点场景乙',description:'独立场景描述',personaIds:[],needStrength:{pain:5,willingness:5,frequency:5},selected:false}];
state.work3.mining.documents=['本地真实原文'];state.work3.mining.simulatedDocuments=['模拟反馈甲','模拟负面反馈乙','模拟反馈丙'];
state.work3.mining.includeSimulated=true;state.work3.mining.includeWork1Open=true;state.work3.mining.includeWork1Themes=true;
state.work3.mining.ldaResult={fixture:'lda'};state.work3.mining.stats={raw_count:7,valid_count:7,total_words:20,vocab_size:10};
state.work3.mining.topics=[{id:0,topic_id:0,label:'旧主题',keywords:[{word:'合成',weight:.5}],representative_docs:['[真实] 本地真实原文']}];
state.work3.mining.corpusComposition={real:4,simulated:3,total:7};
state.work3.mining.painMap=[{id:'pain-a',pain:'关联痛点',evidence:'[真实] 本地真实原文',frequency:2,linkedNeeds:[],linkedTopicId:0,type:'痛点',scenarioId:'s-a'},{id:'pain-b',pain:'独立痛点',evidence:'合成证据',frequency:1,linkedNeeds:[],linkedTopicId:0,type:'痛点',scenarioId:''}];
state.work3.candidates=[{id:'c-a',name:'关联卖点',pain:'关联痛点',painId:'pain-a',description:'合成方案',evidence:'合成证据',scenarioId:'s-a',selected:true,importance:8,uniqueness:7,credibility:6,feasibility:8,communicability:7,sustainability:6,src_importance:'user',desirabilityScores:{'p-a':{importance:8,uniqueness:7,credibility:6},'p-b':{importance:5,uniqueness:6,credibility:7}},extraDims:{}},{id:'c-b',name:'保留卖点',pain:'独立痛点',painId:'pain-b',description:'保留方案',evidence:'保留证据',scenarioId:'s-b',selected:false,importance:5,uniqueness:5,credibility:5,feasibility:4,communicability:4,sustainability:4,desirabilityScores:{},extraDims:{}}];
state.work3.matrix.manualSelected=['c-a'];state.work3.proposition.coreValueIds=['c-a'];
state.work3.migration.analyses=[{candidateId:'c-a',barrier:'合成障碍',path:'合成路径'}];state.work3._scoreDone=['d:p-a:c-a','i:c-a'];
state.work3.proposition.alternatives=[{id:'alt-a',text:'选定合成主张为客户提供可靠可验证的具体利益'},{id:'alt-b',text:'未选定合成主张'}];
state.work3.proposition.chosenValueText=state.work3.proposition.alternatives[0].text;
state.work3.proposition.positioning={brand:'验收合成品牌',audience:'合成客群',coreValue:'合成利益',category:'合成品类'};
state.work3.identity={mbti:'INFJ',personalityTraits:['可靠','透明'],sloganOptions:['选定口号','独立口号'],chosenSlogan:'选定口号'};
state.work3._pipeProp=['prop:alt','prop:pos'];state.work3._pipeIdentity=['id:persona','id:slogan'];
state.work4.product.coreDifferentiators=['标签甲','标签乙','标签丙'];state.work4.product.physicalFeatures='原有物理特征';state.work4.product.aiResult='## 产品叙事\n合成产品正文';state.work4.product._aiGenerated=true;
state.work4.price.tiers=[{id:'tier-a',name:'基础档',price:19,unit:'元',targetSegment:'合成客户',hero:true},{id:'tier-b',name:'保留档',price:29,unit:'元',targetSegment:'保留客户',hero:false}];
state.work4.price.channelPricing=[{id:'cp-a',channel:'线上定价',priceAdjustment:'加价5%',rationale:'合成理由'}];
state.work4.price.promotions=[{id:'promo-a',occasion:'节日节奏',discount:'九折',period:'十月'}];
state.work4.place.structure=[{id:'grp-a',name:'线上',children:[{id:'ch-a',name:'渠道甲',share:23},{id:'ch-b',name:'渠道乙',share:37},{id:'ch-c',name:'渠道丙',share:40}]},{id:'grp-b',name:'线下',children:[{id:'ch-d',name:'线下甲',share:100}]}];
state.work4.place.keyPartners=[{id:'kp-a',name:'伙伴甲',side:'线上'},{id:'kp-b',name:'伙伴乙',side:'线下'},{id:'kp-c',name:'伙伴丙',side:''}];
state.work4.place.onlineSelf=['自营标签'];state.work4.place.channelIncentives='原有激励';
state.work4.promotion.advertising=[{id:'ad-a',media:'合成媒介',budgetShare:60,message:'合成信息',kpi:'合成KPI'},{id:'ad-b',media:'保留媒介',budgetShare:40,message:'保留信息',kpi:'保留KPI'}];
state.work4.promotion.pr=[{id:'pr-a',event:'合成公关',timing:'十月',expectedReach:'100'}];
state.work4.promotion.salesPromotion=[{id:'sp-a',tactic:'合成促销',mechanic:'满赠',period:'十月'}];
state.work5.ch1_business='手工业务章节';Object.assign(state.work5.ch2_environment,{political:'旧政治',economic:'旧经济',social:'旧社会',technological:'旧技术',strengths:['手工优势'],weaknesses:['手工弱势']});
state.work5.ch3_strategy={segmentation:'手工细分',targeting:'手工目标市场',positioning:'手工定位'};
Object.assign(state.work5.ch4_mix,{route:'手工路径',product:'手工产品',price:'手工价格',place:'手工渠道',promotion:'手工传播',customerValue:'手工4C',customerCost:'手工成本',convenience:'手工便利',communication:'手工沟通',reactionMechanism:'手工反应机制'});
state.work5.ch5_outlook='手工展望';
"""

STEPS = {
 1:['sbu','environment','personas','metrics','survey','analysis','values','recommendations'],
 2:['framework','evaluate','decision'],
 3:['scenarios','mining','candidates','matrix','proposition','identity'],
 4:['route','product','price','place','promotion'],5:['plan'],
}


def _active(h):
    return h.page.locator('.workshop.active .step.active')


def _content(h):
    return h.page.evaluate('JSON.stringify([state.work1,state.work2,state.work3,state.work4,state.work5])')


def _dialog(h):
    return h.page.locator('[role="dialog"]:visible').last


def _delete(h, type_name, object_name):
    return h.page.get_by_role('button', name=f'删除{type_name}：{object_name}', exact=True)


def _undo(h, type_name, object_name):
    return h.page.get_by_role('button', name=f'撤销删除{type_name}：{object_name}', exact=True)


def _persist(h, expression, expected, label):
    h.page.evaluate('saveNow()')
    h.wait_idle()
    saved = h.api('GET', '/api/state')
    value = saved
    for part in expression.split('.'):
        value = value[int(part)] if part.isdecimal() else value[part]
    h.check(label, value == expected, {'actual':value,'expected':expected})


def _confirm_cancel(h, locator, terms, label, *, escape=False):
    before = _content(h)
    locator.click()
    text = _dialog(h).inner_text()
    h.check(label+'确认对象和影响', all(term in text for term in terms), text)
    h.check(label+'确认前未变更', _content(h) == before)
    h.check(label+'默认焦点为取消', h.page.evaluate('document.activeElement.textContent.trim()') == '取消')
    # The confirmation owns keyboard focus; Tab must stay inside it.
    h.page.keyboard.press('Shift+Tab')
    h.check(label+'焦点限制在确认内', h.page.evaluate("!!document.activeElement.closest('[role=dialog]')"))
    if escape:
        h.page.keyboard.press('Escape')
    else:
        h.confirm('取消')
    h.check(label+'取消保留工作坊内容', _content(h) == before)
    h.check(label+'取消关闭确认', h.page.locator('.interaction-dialog:visible').count() == 0)


def a06(h):
    for source, button, other, quantity in [('real','清空本地真实语料','3 条模拟语料会保留',1),('simulated','清空模拟语料','1 条本地真实语料会保留',3)]:
        h.seed(FULL, work=3, step='mining')
        clear = _active(h).get_by_role('button', name=button, exact=True)
        h.check('A06 不存在混合来源全清入口', _active(h).get_by_role('button',name=re.compile(r'^清空(?:全部|所有)?语料$|^清空$')).count() == 0)
        h.check('A06 库存持续标注真实1模拟3', '本地真实 1 条 + 模拟 3 条' in _active(h).inner_text())
        _confirm_cancel(h, clear, [f'{quantity} 条',other,'Work1','旧 LDA','主题关联'], button)
        clear.click();h.confirm(button)
        got = h.page.evaluate('({real:state.work3.mining.documents,sim:state.work3.mining.simulatedDocuments,lda:state.work3.mining.ldaResult,topics:state.work3.mining.topics,link:state.work3.mining.painMap[0].linkedTopicId})')
        h.check('A06 '+source+' 清空后来源准确', got['real'] == ([] if source=='real' else ['本地真实原文']) and got['sim'] == ([] if source=='simulated' else ['模拟反馈甲','模拟负面反馈乙','模拟反馈丙']), got)
        h.check('A06 清空使旧LDA与主题绑定失效', got['lda'] is None and got['topics'] == [] and got['link'] is None,got)
        toast = h.page.locator('#toast').inner_text()
        h.check('A06 来源反馈和模拟状态准确', button.replace('清空','已清空')+f' {quantity} 条' in toast and ('模拟语料仍参与建模' if source=='real' else '当前无模拟语料') in toast,toast)
        key = 'documents' if source=='real' else 'simulatedDocuments'
        _persist(h,'work3.mining.'+key,[],'A06 来源清空真实API持久化')
    h.screenshot('A06-corpus-separated')


def a07(h):
    for include in (True,False):
        h.seed(FULL, work=3,step='mining')
        # Source switches are changed by real checkbox actions.
        sim = _active(h).get_by_label('建模时包含模拟语料（默认勾选，可取消）')
        if not include: sim.uncheck()
        _active(h).get_by_label('包含 Work 1 主题文本').uncheck()
        counts=h.page.evaluate('Work3.corpusCounts()')
        text=_active(h).inner_text()
        h.check('A07 存储与实际纳入数量分开', counts['localReal']==1 and counts['simulated']==3 and counts['realUsed']==3 and counts['simulatedUsed']==(3 if include else 0) and '本地真实 1 条 + 模拟 3 条' in text and f'当前实际纳入真实 3 条 + 模拟 {3 if include else 0} 条' in text,counts)
        h.check('A07 Work1来源按各自勾选显示', '开放题 2 条（按勾选纳入 2 条）' in text and '主题 1 条（未纳入）' in text,text)
        # A populated prior result verifies cancellation, independent of the
        # earlier checkbox change which correctly invalidates prior modeling.
        h.page.evaluate("state.work3.mining.ldaResult={fixture:'cancel'};state.work3.mining.topics=[{topic_id:0,label:'取消保留',keywords:[],representative_docs:[]}];state.work3.mining.painMap[0].linkedTopicId=0;Work3.rerender('mining')")
        _confirm_cancel(h,_active(h).get_by_role('button',name='清空本地真实语料',exact=True),['1 条真实语料','3 条模拟语料','Work1'],f'A07模拟纳入{include}',escape=True)
        h.check('A07 取消不使LDA失效',h.page.evaluate("state.work3.mining.ldaResult.fixture==='cancel' && state.work3.mining.painMap[0].linkedTopicId===0"))
        _active(h).get_by_role('button',name='清空本地真实语料',exact=True).click();h.confirm('清空本地真实语料')
        kept=h.page.evaluate('({sim:state.work3.mining.includeSimulated,open:state.work3.mining.includeWork1Open,themes:state.work3.mining.includeWork1Themes,upstream:state.work1.analysis.openThemes,counts:Work3.corpusCounts()})')
        h.check('A07 清空不改勾选或上游文本',kept['sim']==include and kept['open'] is True and kept['themes'] is False and len(kept['upstream'][0]['texts'])==2 and kept['counts']['realUsed']==2,kept)
        toast=h.page.locator('#toast').inner_text()
        h.check('A07 剩余模拟参与状态准确',('模拟语料仍参与建模' if include else '模拟语料未参与建模') in toast,toast)
        _active(h).get_by_role('button',name='清空模拟语料',exact=True).click();h.confirm('清空模拟语料')
        h.check('A07 清空模拟也保留三项勾选',h.page.evaluate(f"state.work3.mining.includeSimulated==={str(include).lower()} && state.work3.mining.includeWork1Open && !state.work3.mining.includeWork1Themes && Work3.collectDocs().length===2"))
    h.screenshot('A07-upstream-source-switches')


def a08(h):
    for kind in ('真实语料','模拟语料'):
        h.seed(FULL,work=3,step='mining')
        target=_delete(h,kind,'第 1 条')
        _confirm_cancel(h,target,[kind,'来源：','旧 LDA','主题关联','其他语料'],kind)
        target.click();h.confirm('删除'+kind)
        h.check('A08 单语料确认后结果和关系清理',h.page.evaluate("state.work3.mining.ldaResult===null && state.work3.mining.topics.length===0 && state.work3.mining.painMap.every(p=>p.linkedTopicId===null)"))
        h.check('A08 单语料另一来源保留',h.page.evaluate('state.work3.mining.'+('simulatedDocuments' if kind=='真实语料' else 'documents')+'.length')==(3 if kind=='真实语料' else 1))
    h.seed(FULL,work=1,step='personas')
    target=_delete(h,'画像','P1')
    _confirm_cancel(h,target,['1 个 Work1 场景','1 个 Work3 场景','1 份调研答卷','历史答卷及答案保留','子分'], 'A08画像')
    target.click();h.confirm('删除画像')
    data=h.page.evaluate("({personas:state.work1.personas,ws:state.work1.scenarios[0].personaIds,sc:state.work3.scenarios[0].personaIds,r:state.work1.survey.responses[0],c:state.work3.candidates[0],done:state.work3._scoreDone,sd:state.work1.survey._doneKeys})")
    h.check('A08 画像关联清理答卷原文保留',data['ws']==['p-b'] and data['sc']==['p-b'] and data['r']['personaId'] is None and len(data['r']['answers'])==3,data)
    h.check('A08 仅移除目标画像子分与断点', 'p-a' not in data['c']['desirabilityScores'] and 'p-b' in data['c']['desirabilityScores'] and data['c']['importance']==8 and data['done']==['i:c-a'] and data['sd']==[],data)
    h.check('A08 剩余画像id保留编号重排',[(p['id'],p['name']) for p in data['personas']]==[('p-b','P1'),('p-c','P2')],data['personas'])
    h.seed(FULL,work=1,step='metrics')
    target=_delete(h,'一级指标','合成一级指标')
    _confirm_cancel(h,target,['2 个下级测评点','1 道关联生成题','1 条答案','统计','实测'], 'A08一级指标')
    target.click();h.confirm('删除一级指标')
    data=h.page.evaluate('({dims:state.work1.metrics.dimensions,questions:state.work1.survey.questions,answers:state.work1.survey.responses[0].answers,stats:state.work1.analysis.likertStats,insights:state.work1.analysis.insights})')
    h.check('A08 一级指标删除精确清理题目答案统计',len(data['dims'])==1 and all(q['id']!='q-a' for q in data['questions']) and all(a['questionId']!='q-a' for a in data['answers']) and 'q-a' not in data['stats'] and 'q-b' in data['stats'] and data['insights']=='',data)
    _persist(h,'work1.metrics.dimensions.0.id','md-b','A08 指标删除真实API持久化')
    h.screenshot('A08-dependency-deletion')


def a09(h):
    for work,step,kind,name,path in [(2,'framework','候选市场','候选乙','state.work2.candidates'),(4,'place','二级渠道','渠道乙','state.work4.place.structure[0].children'),(4,'product','标签','标签乙','state.work4.product.coreDifferentiators'),(4,'place','关键伙伴','伙伴乙','state.work4.place.keyPartners')]:
        h.seed(FULL,work=work,step=step)
        original=h.page.evaluate('JSON.stringify('+path+')')
        _delete(h,kind,name).click()
        h.check('A09 '+kind+'直接删除不确认',h.page.locator('.interaction-dialog:visible').count()==0 and _delete(h,kind,name).count()==0)
        h.check('A09 '+kind+'独立撤销可访问',_undo(h,kind,name).count()==1)
        _undo(h,kind,name).click()
        h.check('A09 '+kind+'恢复全部字段id原位置',h.page.evaluate('JSON.stringify('+path+')')==original,{'original':json.loads(original),'restored':h.page.evaluate(path)})
        h.check('A09 '+kind+'重挂载恢复删除入口',_delete(h,kind,name).count()==1)
        _persist(h,path.replace('state.','').split('[')[0],h.page.evaluate(path.split('[')[0]),'A09 '+kind+'恢复API持久化')
    h.screenshot('A09-partner-channel-undo')


def a10(h):
    h.seed(FULL,work=4,step='place')
    original=h.page.evaluate('JSON.stringify(state.work4.place.keyPartners)')
    for name in ('伙伴甲','伙伴乙','伙伴丙'):_delete(h,'关键伙伴',name).click()
    h.check('A10 连删三项独立有效入口',h.page.locator('#undoNotices .undo-notice').count()==3 and h.page.evaluate('state.work4.place.keyPartners.length')==0)
    # Edit and add after deletion, then undo out of order. Each restore must
    # affect one object without replaying an old workspace snapshot.
    partner=_active(h).get_by_placeholder('输入伙伴名称回车添加')
    partner.fill('后来新增伙伴');partner.press('Enter')
    h.goto(4,'product')
    # Select by current DOM value rather than a source string.
    field=_active(h).locator('textarea').all()
    edited=next(loc for loc in field if loc.input_value()=='原有物理特征')
    edited.fill('删除后独立新编辑')
    for name in ('伙伴乙','伙伴甲','伙伴丙'):
        _undo(h,'关键伙伴',name).click()
        h.check('A10 '+name+'撤销不覆盖新编辑',h.page.evaluate("state.work4.product.physicalFeatures==='删除后独立新编辑' && state.work4.place.keyPartners.some(p=>p.name==='后来新增伙伴')"))
    restored=h.page.evaluate('state.work4.place.keyPartners')
    h.check('A10 原三项顺序id归属完整恢复',restored[:3]==json.loads(original) and restored[3]['name']=='后来新增伙伴',restored)
    h.goto(4,'place')
    h.check('A10 导航重新挂载保持恢复结果',_delete(h,'关键伙伴','伙伴甲').count()==1 and _delete(h,'关键伙伴','后来新增伙伴').count()==1)
    _persist(h,'work4.product.physicalFeatures','删除后独立新编辑','A10 无关新编辑API持久化')
    h.screenshot('A10-independent-three-undos')


def _unpause(h):
    h.page.mouse.move(5,5)
    h.page.locator('#saveBtn').focus()


def a11(h):
    h.seed(FULL,work=2,step='framework')
    _delete(h,'候选市场','候选甲').click();_unpause(h)
    started=time.monotonic();h.page.wait_for_timeout(4500)
    h.check('A11 10秒内撤销有效',_undo(h,'候选市场','候选甲').count()==1)
    h.page.wait_for_timeout(5800)
    h.check('A11 真实10秒后入口过期',_undo(h,'候选市场','候选甲').count()==0,{'elapsed_seconds':round(time.monotonic()-started,2)})
    for mode in ('hover','focus'):
        h.seed(FULL,work=2,step='framework')
        _delete(h,'候选市场','候选乙').click();_unpause(h)
        undo=_undo(h,'候选市场','候选乙');notice=undo.locator('..')
        h.page.wait_for_timeout(1200)
        if mode=='hover':notice.hover()
        else:undo.focus();h.page.keyboard.press('Tab');h.page.keyboard.press('Shift+Tab')
        countdown=notice.locator('.undo-countdown').inner_text()
        h.page.wait_for_timeout(10500)
        h.check('A11 '+mode+'真实10秒暂停',undo.count()==1 and notice.locator('.undo-countdown').inner_text()==countdown,{'before':countdown,'after':notice.locator('.undo-countdown').inner_text() if notice.count() else None})
        _unpause(h);h.page.wait_for_timeout(10000)
        h.check('A11 '+mode+'移出后续计过期',undo.count()==0)
    h.seed(FULL,work=2,step='framework')
    _delete(h,'候选市场','候选丙').click()
    _undo(h,'候选市场','候选丙').hover()
    h.goto(4,'place')
    h.check('A11 跨步骤工作坊导航保留入口',_undo(h,'候选市场','候选丙').count()==1)
    _undo(h,'候选市场','候选丙').focus()
    reset=h.page.get_by_role('button',name='重置工作区',exact=True)
    reset.click();h.confirm('取消')
    h.check('A11 整体替换取消保留旧撤销',_undo(h,'候选市场','候选丙').count()==1)
    h.page.evaluate('() => {window.__acceptSaveNow=saveNow;saveNow=async()=>false;}')
    reset.click();h.confirm('重置工作区');h.wait_idle()
    h.check('A11 前置保存失败保留旧撤销',_undo(h,'候选市场','候选丙').count()==1 and '当前内容未被覆盖' in h.page.locator('#interactionNotices').inner_text())
    h.page.evaluate('() => {saveNow=window.__acceptSaveNow;}')
    reset.click();h.confirm('重置工作区');h.wait_idle()
    h.check('A11 成功整体替换结束所有旧撤销',h.page.locator('#undoNotices .undo-notice').count()==0 and h.page.evaluate('state.work2.candidates.length')==0)
    h.seed(FULL,work=2,step='framework');h.save_version('A11合成替换版本')
    _delete(h,'候选市场','候选甲').click();h.open_history()
    load=h.page.locator('#snapList .expert-row').filter(has_text='A11合成替换版本').locator('button[data-act="load"]')
    load.click();h.confirm('取消')
    h.check('A11 历史加载取消保留撤销',_undo(h,'候选市场','候选甲').count()==1)
    load.click();h.confirm('加载并覆盖');h.wait_idle()
    h.check('A11 成功历史加载撤销失效',h.page.locator('#undoNotices .undo-notice').count()==0)
    if h.page.locator('#historyModal.open').count():h.page.get_by_role('button',name='关闭历史记录面板',exact=True).click()
    h.seed(FULL,work=2,step='framework')
    payload=h.page.evaluate('JSON.parse(JSON.stringify(state))');payload['work1']['sbu']['name']='A11导入业务'
    file={'name':'A11合成导入.md','mimeType':'text/markdown','buffer':('# 合成导入\n<!-- data:'+json.dumps(payload,ensure_ascii=False)+' -->').encode()}
    _delete(h,'候选市场','候选乙').click()
    for confirm in (False,True):
        with h.page.expect_file_chooser() as chooser:h.page.get_by_role('button',name='导入 .md',exact=True).click()
        chooser.value.set_files(file);h.confirm('导入并覆盖' if confirm else '取消');h.wait_idle()
        h.check('A11 '+('成功导入撤销失效' if confirm else '导入取消保留撤销'),h.page.locator('#undoNotices .undo-notice').count()==(0 if confirm else 1))
    h.seed(FULL,work=2,step='framework');_delete(h,'候选市场','候选丙').click()
    h.page.locator('#demoBtn').click();h.page.locator('#demoMenuList .demo-menu-item').first.click()
    h.page.wait_for_function('!!state.meta.demoCase')
    h.check('A11 成功进入案例旧撤销失效',h.page.locator('#undoNotices .undo-notice').count()==0)
    h.page.locator('#demoBtn').click();h.page.wait_for_function('!state.meta.demoCase')
    h.check('A11 退出案例不复活旧撤销',h.page.locator('#undoNotices .undo-notice').count()==0 and h.page.evaluate("!state.work2.candidates.some(m=>m.id==='mk-c')"))
    h.screenshot('A11-replacement-invalidates-undo')


def _style(locator):
    return locator.evaluate("e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,transform:s.transform,bg:s.backgroundColor,color:s.color,border:s.borderColor,outline:s.outlineColor,outlineWidth:parseFloat(s.outlineWidth)||0,outlineStyle:s.outlineStyle,disabled:e.disabled,current:e.getAttribute('aria-current'),pressed:e.getAttribute('aria-pressed')}}")


def _stable(h,locator,label,selected=False):
    locator.scroll_into_view_if_needed();h.page.mouse.move(5,5)
    h.page.wait_for_timeout(180)
    before=_style(locator);locator.hover();h.page.wait_for_timeout(220);hover=_style(locator)
    h.page.mouse.down();pressed=_style(locator);h.page.mouse.move(5,5);h.page.mouse.up()
    locator.focus();h.page.keyboard.press('Shift+Tab');h.page.keyboard.press('Tab');focused=_style(locator)
    stable=lambda s:all(abs(s[k]-before[k])<.75 for k in ('x','y','w','h')) and s['transform'] in ('none','matrix(1, 0, 0, 1, 0, 0)')
    h.check('A16 '+label+' hover/按下/键盘焦点无位移缩放',all(stable(s) for s in (hover,pressed,focused)),{'base':before,'hover':hover,'pressed':pressed,'focus':focused})
    h.check('A16 '+label+'键盘蓝色焦点可见',focused['outlineWidth']>=2 and focused['outlineStyle']!='none' and focused['outline'] not in (focused['color'],'rgba(0, 0, 0, 0)'),focused)
    if selected:h.check('A16 '+label+' hover选中颜色和语义保留',hover['bg']==before['bg'] and hover['color']==before['color'] and hover['bg']!=hover['color'] and hover['current']==before['current'] and hover['pressed']==before['pressed'] and (hover['current'] in ('true','page','step') or hover['pressed']=='true'),hover)
    return before


def a16(h):
    h.seed(FULL,work=1,step='sbu')
    _stable(h,h.page.locator('#modeSwitch button.active'),'顶栏选中模式',True)
    _stable(h,h.page.locator('.tab.active'),'选中工作坊',True)
    _stable(h,h.page.locator('.subtab.active'),'选中步骤',True)
    _stable(h,h.page.locator('#saveBtn'),'ghost保存')
    _stable(h,_active(h).locator('.metric-next button:visible').first,'步间CTA')
    _stable(h,h.page.get_by_role('button',name='重置工作区',exact=True),'危险重置')
    danger=_style(h.page.get_by_role('button',name='重置工作区',exact=True))
    h.check('A16 静态危险有文字描边和色彩',danger['color']!=_style(h.page.locator('#saveBtn'))['color'] and danger['border']==danger['color'],danger)
    h.goto(3,'scenarios');_stable(h,_active(h).get_by_role('button',name='AI 起草场景细分',exact=True),'AI主操作')
    h.page.evaluate("window.__acceptDisabledCount=0;const b=document.querySelector('#steps3 .step.active button.primary');b.disabled=true;b.addEventListener('click',()=>window.__acceptDisabledCount++)")
    disabled=_active(h).locator('button.primary').first
    before=_style(disabled);disabled.hover();h.page.mouse.down();during=_style(disabled);h.page.mouse.up()
    # 无边框看 outline-style：button:disabled{outline:none} 把 width 重置为初始值 medium，
    # Chrome 无论 style 一律序列化成 3px，比较 width 会误判；style:none 时本就不绘制。
    h.check('A16 disabled禁止动作且无hover按下反馈',h.page.evaluate('window.__acceptDisabledCount')==0 and before['bg']==during['bg'] and before['color']==during['color'] and during['outlineStyle']=='none' and during['transform']=='none',during)
    h.screenshot('A16-button-keyboard-focus')


CONTROLLED_AI = r"""
state.settings.manualMode=false;state.settings.api.apiKey='synthetic-control-only';
window.__acceptCalls=[];window.__acceptReleases=[];
API.callJson=(messages,opts={})=>new Promise((resolve,reject)=>{
 const record={messages:JSON.parse(JSON.stringify(messages)),settled:false};
 window.__acceptCalls.push(record);
 const abort=()=>{if(record.settled)return;record.settled=true;reject(new DOMException('Controlled abort','AbortError'));};
 if(opts.signal?.aborted){abort();return;}
 opts.signal?.addEventListener('abort',abort,{once:true});
 window.__acceptReleases.push(value=>{if(record.settled)return;record.settled=true;resolve(value);});
});
"""


def _install_ai(h):
    # A function wrapper returns undefined; evaluating an assignment of a
    # promise-producing function can otherwise invoke and await that function.
    h.page.evaluate('() => {'+CONTROLLED_AI+'}')


def _reply(h,data,index=-1):
    h.page.evaluate('args=>window.__acceptReleases[args.index<0?window.__acceptReleases.length-1:args.index](args.data)',{'index':index,'data':data})


def _calls(h,count):
    h.page.wait_for_function('n=>window.__acceptCalls.length===n',arg=count)


def a17(h):
    h.seed(FULL,work=3,step='scenarios');_install_ai(h)
    single=_active(h).locator('.ai-box button.primary').first
    single.click();_calls(h,1)
    h.check('A17 单调用生成中只有中止',h.page.evaluate('Runner.current && !Runner.current.pausable && !Runner.current.paused') and '生成中' in single.inner_text() and '暂停' not in single.inner_text())
    h.goto(3,'identity')
    other=_active(h).get_by_role('button',name='重新生成人格与 Slogan',exact=True)
    h.check('A17 跨步骤其他AI全局互斥',other.is_disabled() and other.get_attribute('title')=='已有 AI 任务进行中')
    before=len(h.page.evaluate('window.__acceptCalls'));other.focus();h.page.keyboard.press('Enter')
    h.check('A17 disabled键盘不发第二任务',len(h.page.evaluate('window.__acceptCalls'))==before)
    h.goto(3,'scenarios')
    # The mounted task may preserve its original button or remount its UI;
    # the visible abort control is always the actual Runner control.
    abort=h.page.get_by_role('button',name='中止 AI 任务：AI 起草场景细分',exact=True)
    if not abort.count():
        h.check('A17 导航后任务按钮仍可中止',False,_active(h).inner_text()[:600])
    abort.focus();abort.press('Space');h.page.wait_for_function('Runner.current===null')
    h.check('A17 键盘中止不写未完成单元',h.page.evaluate("state.work3.scenarios[0].id==='s-a'"))
    # Existing results trigger direct replacement without confirmation.
    _install_ai(h)
    single=_active(h).locator('.ai-box button.primary').first
    single.click();_calls(h,1)
    _reply(h,{'scenarios':[{'name':'新场景','description':'新合成内容','personaIds':[],'needStrength':{'pain':8,'willingness':8,'frequency':8},'selected':True}]})
    h.page.wait_for_function('Runner.current===null')
    h.goto(3,'scenarios')
    regen=_active(h).get_by_role('button',name='重新生成场景细分',exact=True);regen.click();_calls(h,2)
    h.check('A17 重新生成直接发起无确认',h.page.locator('.interaction-dialog:visible').count()==0)
    _reply(h,{'scenarios':[{'name':'再次新场景','description':'整组替换','personaIds':[],'needStrength':{'pain':9,'willingness':9,'frequency':9},'selected':True}]})
    h.page.wait_for_function('Runner.current===null')
    h.check('A17 单调用重新生成覆盖旧数组',h.page.evaluate("state.work3.scenarios.length===1 && state.work3.scenarios[0].name==='再次新场景'"))
    # Real W3 identity pipeline: pause is requested during a call, the call
    # completes, the boundary stays paused, and keyboard Enter aborts.
    h.seed(FULL,work=3,step='identity');_install_ai(h)
    multi=_active(h).locator('.ai-box button.primary').first
    multi.click();_calls(h,1)
    h.check('A17 重新生成人格清旧断点整组跑',h.page.evaluate('state.work3._pipeIdentity.length===0 && Runner.current.pausable'))
    multi.press('Enter')
    h.check('A17 多单元键盘暂停状态',h.page.evaluate("Runner.current.paused && Runner.current.status==='paused'") and '已暂停' in multi.inner_text() and '继续' not in multi.inner_text())
    _reply(h,{'mbti':'ENTJ','traits':['新合成特质']})
    h.page.wait_for_function("state.work3._pipeIdentity.includes('id:persona')")
    h.check('A17 当前调用完成后停在边界',len(h.page.evaluate('window.__acceptCalls'))==1 and h.page.evaluate('Runner.current.done===1 && Runner.current.paused'))
    multi.press('Enter');h.page.wait_for_function('Runner.current===null')
    h.check('A17 已暂停只有中止且保留完成单元',h.page.evaluate("state.work3.identity.mbti==='ENTJ' && state.work3._pipeIdentity.includes('id:persona') && state.work3.identity.sloganOptions[0]==='选定口号'"))
    # Explicit regeneration restarts both units, even after the prior partial
    # result. Actual generation callbacks replace traits and slogan arrays.
    h.goto(3,'identity');_install_ai(h)
    _active(h).get_by_role('button',name='重新生成人格与 Slogan',exact=True).click();_calls(h,1)
    _reply(h,{'mbti':'ENFP','traits':['整组新特质']});_calls(h,2)
    _reply(h,{'slogans':['整组新口号一','整组新口号二']});h.page.wait_for_function('Runner.current===null')
    h.check('A17 人格Slogan两单元完整重跑不追加',h.page.evaluate("state.work3.identity.mbti==='ENFP' && JSON.stringify(state.work3.identity.personalityTraits)==='[\"整组新特质\"]' && state.work3.identity.sloganOptions.length===2 && state.work3.identity.chosenSlogan==='' && state.work3._pipeIdentity.length===2"))
    # The other two concrete W3 multi-unit regeneration paths also carry
    # populated old checkpoints, which must be discarded by actual clicks.
    h.seed(FULL,work=3,step='proposition');_install_ai(h)
    _active(h).get_by_role('button',name='重新生成主张与定位',exact=True).click();_calls(h,1)
    h.check('A17 主张重生成清旧断点',h.page.evaluate('state.work3._pipeProp.length===0'))
    _reply(h,{'alternatives':[{'text':'新整组主张'}]});_calls(h,2)
    _reply(h,{'positioning':{'brand':'新品牌','audience':'新客群','coreValue':'新利益','category':'新品类'}});h.page.wait_for_function('Runner.current===null')
    h.check('A17 主张定位两单元整组覆盖',h.page.evaluate("state.work3.proposition.alternatives.length===1 && state.work3.proposition.alternatives[0].text==='新整组主张' && state.work3.proposition.positioning.brand==='新品牌' && state.work3._pipeProp.length===2"))
    h.seed(FULL,work=3,step='matrix');_install_ai(h)
    _active(h).get_by_role('button',name='重新生成双维评分',exact=True).click();_calls(h,1)
    h.check('A17 双维评分清旧断点',h.page.evaluate('state.work3._scoreDone.length===0'))
    scores={key:9 for key in ('importance','uniqueness','credibility','feasibility','communicability','sustainability')}
    expected=h.page.evaluate('Work3._scorePending()')
    for n in range(1,expected+1):
        _reply(h,scores)
        if n<expected:_calls(h,n+1)
    h.page.wait_for_function('Runner.current===null')
    h.check('A17 双维两轴全卖点重跑',len(h.page.evaluate('window.__acceptCalls'))==expected and h.page.evaluate('state.work3.candidates.every(c=>c.feasibility===9) && state.work3._scoreDone.length===0'),{'calls':len(h.page.evaluate('window.__acceptCalls')),'expected':expected})
    h.screenshot('A17-controlled-ai-pipelines')


def _scan_targets(page):
    return page.locator('button:visible,[role=button]:visible').evaluate_all("""els=>els.filter(e=>e.matches('.delete-control,.partner-remove,.abort-btn,.abort-inline,.modal-close,.archive-rename') || /^(删除|清空|重置|恢复.*默认|重建全部)/.test(e.getAttribute('aria-label')||e.textContent.trim())).map(e=>{const r=e.getBoundingClientRect();return {name:e.getAttribute('aria-label')||e.textContent.trim(),title:e.getAttribute('title'),tooltip:e.getAttribute('data-tooltip'),w:r.width,h:r.height,x:r.x,y:r.y,html:e.outerHTML.slice(0,180)}})""")


def a18(h):
    h.seed(FULL,work=4,step='place')
    targets=_scan_targets(h.page)
    h.check('A18 桌面删除目标至少24x24',all(t['w']>=24 and t['h']>=24 for t in targets),targets)
    h.check('A18 删除名称包含类型对象',all(not t['name'].endswith('：') and t['name']!='×' for t in targets),targets)
    target=_delete(h,'关键伙伴','伙伴乙');target.hover()
    hover=h.page.locator('#interactionTargetTip').inner_text()
    h.page.mouse.move(5,5);target.focus();h.page.keyboard.press('Tab');h.page.keyboard.press('Shift+Tab')
    focus=h.page.locator('#interactionTargetTip').inner_text()
    h.check('A18 hover与键盘focus目标说明一致',hover==focus=='删除关键伙伴：伙伴乙' and h.page.locator('#interactionTargetTip').is_visible(),{'hover':hover,'focus':focus})
    overlap=h.page.locator('.partner-chip').evaluate_all("""chips=>chips.flatMap(c=>{const a=Array.from(c.querySelectorAll('button')).map(b=>({name:b.getAttribute('aria-label'),r:b.getBoundingClientRect()}));return a.flatMap((x,i)=>a.slice(i+1).filter(y=>Math.min(x.r.right,y.r.right)>Math.max(x.r.left,y.r.left)+.1 && Math.min(x.r.bottom,y.r.bottom)>Math.max(x.r.top,y.r.top)+.1).map(y=>[x.name,y.name]));})""")
    h.check('A18 伙伴删除与归属切换热区不重叠',overlap==[],overlap)
    target.press('Enter');h.check('A18 桌面键盘删除即时提供撤销',_undo(h,'关键伙伴','伙伴乙').count()==1)
    _undo(h,'关键伙伴','伙伴乙').press('Enter')
    h.check('A18 桌面键盘撤销恢复归属',h.page.evaluate("state.work4.place.keyPartners[1].id==='kp-b' && state.work4.place.keyPartners[1].side==='线下'"))
    # A real touch context drives pointer:coarse CSS; no stylesheet inference.
    desktop=h.page;touch=h.new_page(touch=True,viewport={'width':390,'height':844})
    try:
        h.page=touch;h.seed(FULL,work=4,step='place')
        h.check('A18 触屏上下文真实coarse pointer',touch.evaluate("matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints>0"))
        targets=_scan_targets(touch)
        h.check('A18 触屏删除目标至少44x44',all(t['w']>=44 and t['h']>=44 for t in targets),targets)
        overlap=touch.locator('.partner-chip').evaluate_all("chips=>chips.flatMap(c=>{const a=Array.from(c.querySelectorAll('button')).map(b=>b.getBoundingClientRect());return a.flatMap((x,i)=>a.slice(i+1).filter(y=>Math.min(x.right,y.right)>Math.max(x.left,y.left)+.1 && Math.min(x.bottom,y.bottom)>Math.max(x.top,y.top)+.1));})")
        h.check('A18 触屏伙伴热区不重叠',overlap==[],overlap)
        _delete(h,'关键伙伴','伙伴乙').tap()
        h.check('A18 触屏删除及撤销可用',_undo(h,'关键伙伴','伙伴乙').count()==1)
        _undo(h,'关键伙伴','伙伴乙').tap()
        h.check('A18 触屏撤销恢复归属',touch.evaluate("state.work4.place.keyPartners[1].side==='线下' && state.work4.place.keyPartners[1].id==='kp-b'"))
        h.screenshot('A18-touch-targets-390')
    finally:h.page=desktop;touch.close()


def a19(h):
    h.seed(FULL,work=1,step='sbu')
    for width,height in ((390,844),(768,1024)):
        h.page.set_viewport_size({'width':width,'height':height});h.page.wait_for_timeout(180)
        notice=h.page.locator('.narrow-width-notice');rect=notice.bounding_box()
        h.check(f'A19 {width}窄屏提示按可见视口排版',notice.is_visible() and '小于 1024px' in notice.inner_text() and abs(rect['width']-width)<=1,rect)
        h.check(f'A19 {width}保留完整桌面横滚',h.page.evaluate('document.body.scrollWidth>=1024 && document.documentElement.scrollWidth>innerWidth') and _active(h).is_visible())
        brand=h.page.get_by_placeholder('例：豆芽妈妈母婴洗护 / 问渠书院素质培训')
        h.check(f'A19 {width}无误加编辑锁',brand.is_editable() and h.page.evaluate("!document.body.classList.contains('is-demo')"))
        brand.fill(f'窄屏{width}新输入')
        h.page.evaluate('window.scrollTo(450,0)');h.page.wait_for_timeout(120)
        after=notice.bounding_box()
        h.check(f'A19 {width}横滚提示不移出视口',abs(after['x'])<=1 and after['width']<=width+1,after)
        h.screenshot(f'A19-sbu-{width}x{height}')
        h.page.evaluate('window.scrollTo(0,0)')
    h.page.set_viewport_size({'width':1440,'height':900})


def a20(h):
    h.seed(FULL,work=1,step='sbu')
    brand=h.page.get_by_placeholder('例：豆芽妈妈母婴洗护 / 问渠书院素质培训');brand.fill('跨断点保留输入')
    content=_content(h);url=h.page.url
    for width,height in ((1024,768),(1440,900),(390,844),(768,1024),(1024,768),(1440,900)):
        h.page.set_viewport_size({'width':width,'height':height});h.page.wait_for_timeout(180)
        h.check(f'A20 {width}内容位置dirty保留',_content(h)==content and brand.input_value()=='跨断点保留输入' and h.page.url==url and h.page.evaluate("dirty && App.currentWork===1 && App.currentStep==='sbu'"))
        if width>=1024:
            h.check(f'A20 {width}不显示宽度提示',not h.page.locator('.narrow-width-notice').is_visible())
            layout=h.page.evaluate("({viewport:innerWidth,scroll:document.documentElement.scrollWidth,nav:[...document.querySelectorAll('.tabs .tab,.subtabs .subtab')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {w:r.width,left:r.left,right:r.right,text:e.textContent.trim()}}),cards:[...document.querySelectorAll('.sbu-threeq-card')].map(e=>e.getBoundingClientRect().width)})")
            h.check(f'A20 {width}导航不裁切整页无溢出',layout['scroll']<=width+1 and all(n['w']>0 and n['left']>=-1 and n['right']<=width+1 for n in layout['nav']),layout)
            h.check(f'A20 {width}SBU三问保留可读列宽',not layout['cards'] or min(layout['cards'])>=200,layout['cards'])
            h.screenshot(f'A20-sbu-{width}x{height}')
    h.goto(3,'matrix')
    h.page.evaluate("for(let n=0;n<8;n++){const key='dense_'+n;state.work3.dimensions.desirability.push({key,label:'密集维度'+n,definition:'合成密集表验收维度'});state.work3.candidates.forEach(c=>c[key]=6);}Work3.rerender('matrix')")
    _active(h).get_by_text('展开/收起评分子项',exact=True).click()
    h.page.set_viewport_size({'width':1024,'height':768});h.page.wait_for_timeout(160)
    wraps=_active(h).locator('.table-wrap:visible').evaluate_all("es=>es.map(e=>({client:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflowX,table:e.querySelector('table')?.getBoundingClientRect().width}))")
    h.check('A20 密集评分表局部横滚',any(w['scroll']>w['client']+1 and w['overflow'] in ('auto','scroll') for w in wraps),wraps)
    h.check('A20 表格不造成受支持宽度整页溢出',h.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    h.screenshot('A20-matrix-local-scroll-1024x768')
    h.page.set_viewport_size({'width':1440,'height':900})


RISK_CANCEL = [
 (1,'personas','场景','日常场景',['2 个画像关联','历史答卷','保留']),
 (1,'metrics','测评点','关联测评点',['1 道关联生成题','1 条答案','实测']),
 (1,'survey','问卷题目','关联生成题',['1 条答案','1 项统计','历史答卷','回填']),
 (2,'framework','筛选标准','合成筛选标准',['2 个已保留市场','评分和三档决策会保留']),
 (2,'framework','保留市场','保留甲',['3 格评分','主战场','候选市场']),
 (2,'framework','一级维度','吸引力维度',['2 个二级指标','最后一个一级维度','本轴为空','锚点与评分不会回来']),
 (2,'framework','二级指标','吸引力指标',['高/中/低锚点','2 格已打评分','赋权引用','其它指标']),
 (2,'framework','招聘视角','合成视角',['1 条同名 persona','旧收敛','其它视角','评分保留']),
 (2,'decision','观察指标','观察指标甲',['观察期决策卡和导出','市场选择与评分保留']),
 (3,'scenarios','场景','卖点场景甲',['1 条痛点','1 个备选卖点','评分和证据会保留']),
 (3,'mining','痛点','关联痛点',['1 个备选卖点','痛点描述、证据和评分会保留']),
 (3,'candidates','备选卖点','关联卖点',['已有评分','矩阵点位','手动入选','迁移分析','评分断点']),
 (3,'matrix','评分维度','重要性',['评分及 persona 子分','评分断点','另一轴']),
 (3,'proposition','价值主张候选','选定合成主张为客户提供可靠可验证的具体利益',['已选定','清除选定指针','已有定位、表单及叙事正文保留']),
 (3,'identity','Slogan','选定口号',['已选定','清除选定指针','已有品牌人格、表单及叙事正文保留']),
]


def a22(h):
    # Scan every populated step, not just controls selected by the tests.
    h.seed(FULL,work=1,step='sbu')
    scanned=[]
    for work,steps in STEPS.items():
        for step in steps:
            h.goto(work,step);h.wait_idle()
            if work==3 and step=='matrix':_active(h).get_by_text('评分维度管理',exact=True).click()
            buttons=h.page.locator('button:visible,[role=button]:visible').evaluate_all("es=>es.map(e=>({text:e.textContent.trim(),name:e.getAttribute('aria-label')||e.textContent.trim(),title:e.getAttribute('title')}))")
            anonymous=[b for b in buttons if b['text']=='×' and (not b['name'] or b['name']=='×')]
            bad_close=[b for b in buttons if b['text']=='×' and b['name'].startswith('删除') and '面板' in b['name']]
            h.check(f'A22 W{work}/{step}无匿名×或误名关闭',not anonymous and not bad_close,anonymous+bad_close)
            scanned.append({'work':work,'step':step,'controls':[b['name'] for b in buttons if b['name'].startswith(('删除','清空','重建','恢复'))]})
    h.check('A22 全部23步骤对象入口扫描',len(scanned)==sum(map(len,STEPS.values())),scanned)
    for work,step,kind,name,terms in RISK_CANCEL:
        h.seed(FULL,work=work,step=step)
        if step=='matrix':_active(h).get_by_text('评分维度管理',exact=True).click()
        _confirm_cancel(h,_delete(h,kind,name),[name]+terms,f'A22 {kind}{name}')
    # Whole-group actions state the exact retained and overwritten ranges.
    groups=[(1,'personas','清空已采纳画像和场景',['3 个已采纳画像','2 个场景','历史调研答卷保留']),
            (1,'survey','清空调研回答',['1 份调研答卷','3 条答案','3 条已完成记录','问卷题目、指标自评及调研设置保留']),
            (1,'survey','重建全部指标生成题',['2 道指标生成题','3 道','2 道手动题','答案保留']),
            (2,'framework','恢复市场吸引力默认模板',['吸引力','整轴','另一轴','不会恢复']),
            (2,'framework','清空招聘与赋权记录并重新招聘',['2 个招聘视角','2 条 persona','当前两级指标','市场评分保留']),
            (4,'product','清空正文',['AI 起草的叙事正文','表单内容不受影响'])]
    for work,step,name,terms in groups:
        h.seed(FULL+("state.work2.delphi.status='personas';" if name=='清空招聘与赋权记录并重新招聘' else ''),work=work,step=step)
        if name=='清空已采纳画像和场景':
            h.page.evaluate("Work1.personaDraft.versions=[{personas:structuredClone(state.work1.personas),scenarios:structuredClone(state.work1.scenarios)}];Work1.personaDraft.version=0;Work1.personaDraft.adopted={personas:true,scenarios:true};Work1.personaDraft.mode='drawer';Work1.personaDraft.mountDrawer()")
        _confirm_cancel(h,h.page.get_by_role('button',name=name,exact=True),terms,'A22 '+name)
    # Representative actual dependency deletions, beyond cancellation coverage.
    actual=[(1,'survey','问卷题目','关联生成题',"!state.work1.survey.questions.some(q=>q.id==='q-a') && !state.work1.survey.responses[0].answers.some(a=>a.questionId==='q-a') && !('q-a' in state.work1.analysis.likertStats) && ('q-b' in state.work1.analysis.likertStats)"),
            (2,'framework','保留市场','保留甲',"!state.work2.retained.some(m=>m.id==='ret-a') && !state.work2.scoring['ret-a'] && state.work2.decision.tier1.marketId===null && state.work2.candidates.length===3 && !!state.work2.scoring['ret-b']"),
            (2,'framework','二级指标','吸引力指标',"!state.work2.attractiveness.categories[0].indicators.some(i=>i.id==='ind-a') && !state.work2.scoring['ret-a']['ind-a'] && !!state.work2.scoring['ret-a']['ind-b'] && state.work2.delphi.finalWeights===null && state.work2.delphi.personas.every(p=>!('ind-a' in p.ratings.attractiveness))"),
            (3,'scenarios','场景','卖点场景甲',"!state.work3.scenarios.some(s=>s.id==='s-a') && state.work3.mining.painMap[0].scenarioId==='' && state.work3.candidates[0].scenarioId==='' && state.work3.candidates[0].importance===8"),
            (3,'mining','痛点','关联痛点',"!state.work3.mining.painMap.some(p=>p.id==='pain-a') && state.work3.candidates[0].painId==='' && state.work3.candidates[0].pain==='关联痛点' && state.work3.candidates[0].importance===8"),
            (3,'candidates','备选卖点','关联卖点',"!state.work3.candidates.some(c=>c.id==='c-a') && !state.work3.matrix.manualSelected.includes('c-a') && !state.work3.proposition.coreValueIds.includes('c-a') && state.work3.migration.analyses.length===0 && !state.work3._scoreDone.some(k=>k.endsWith(':c-a'))"),
            (3,'proposition','价值主张候选','选定合成主张为客户提供可靠可验证的具体利益',"state.work3.proposition.chosenValueText==='' && state.work3.proposition.alternatives.length===1 && state.work3.proposition.positioning.brand==='验收合成品牌'"),
            (3,'identity','Slogan','选定口号',"state.work3.identity.chosenSlogan==='' && state.work3.identity.sloganOptions.length===1 && state.work3.identity.mbti==='INFJ'")]
    for work,step,kind,name,assertion in actual:
        h.seed(FULL,work=work,step=step);_delete(h,kind,name).click();h.confirm('删除'+kind)
        h.check('A22 '+kind+'实际清理范围',h.page.evaluate(assertion))
    h.seed(FULL,work=1,step='survey')
    questions=h.page.evaluate('JSON.stringify(state.work1.survey.questions)')
    _active(h).get_by_role('button',name='清空调研回答',exact=True).click();h.confirm('清空回答')
    h.check('A22 清回答实际清除答案完成记录分析实测',h.page.evaluate("state.work1.survey.responses.length===0 && state.work1.survey._doneKeys.length===0 && Object.keys(state.work1.analysis.likertStats).length===0 && state.work1.analysis.openThemes.length===0 && state.work1.analysis.insights==='' && state.work1.metrics.dimensions[0].secondaries[0].actual===null && state.work1.metrics.dimensions[0].secondaries[0].selfScore===7") and h.page.evaluate('JSON.stringify(state.work1.survey.questions)')==questions)
    h.seed(FULL,work=1,step='survey')
    _active(h).get_by_role('button',name='重建全部指标生成题',exact=True).click();h.confirm('重建指标生成题')
    h.check('A22 重建指标题实际保留手动题及答案',h.page.evaluate("state.work1.survey.questions.filter(q=>q.sourceIndicatorId!=null).length===3 && state.work1.survey.questions.some(q=>q.id==='q-open') && state.work1.survey.questions.some(q=>q.id==='q-free') && !state.work1.survey.questions.some(q=>q.id==='q-a') && state.work1.survey.responses[0].answers.length===1 && state.work1.survey.responses[0].answers[0].questionId==='q-open' && state.work1.survey._doneKeys.length===0"))
    h.seed(FULL,work=2,step='framework')
    other_axis=h.page.evaluate('JSON.stringify(state.work2.competitiveness)')
    _active(h).get_by_role('button',name='恢复市场吸引力默认模板',exact=True).click();h.confirm('恢复默认模板')
    h.check('A22 恢复模板实际替换本轴保留另一轴',h.page.evaluate("state.work2.attractiveness.categories.length===4 && !state.work2.scoring['ret-a']['ind-a'] && !!state.work2.scoring['ret-a']['ind-c'] && state.work2.delphi.personas.length===0") and h.page.evaluate('JSON.stringify(state.work2.competitiveness)')==other_axis)
    h.seed(FULL,work=3,step='matrix');_active(h).get_by_text('评分维度管理',exact=True).click()
    _delete(h,'评分维度','重要性').click();h.confirm('删除评分维度')
    h.check('A22 W3评分维度实际清理目标轴子分断点',h.page.evaluate("!state.work3.dimensions.desirability.some(d=>d.key==='importance') && state.work3.candidates.every(c=>!('importance' in c)) && !('importance' in state.work3.candidates[0].desirabilityScores['p-a']) && state.work3.candidates[0].feasibility===8 && state.work3._scoreDone.length===1 && state.work3._scoreDone[0]==='i:c-a' && state.work3.migration.analyses.length===0"))
    # W4 row deletion restores every field including budget, hero and period.
    rows=[('price','价格档位','基础档','tiers'),('price','渠道定价','线上定价','channelPricing'),('price','促销节奏','节日节奏','promotions'),('promotion','媒介','合成媒介','advertising'),('promotion','公关事件','合成公关','pr'),('promotion','促销手段','合成促销','salesPromotion')]
    for step,kind,name,key in rows:
        h.seed(FULL,work=4,step=step);path=f'state.work4.{step}.{key}';before=h.page.evaluate('JSON.stringify('+path+')')
        _delete(h,kind,name).click();h.check('A22 '+kind+'单行直接删除撤销',_undo(h,kind,name).count()==1 and h.page.locator('.interaction-dialog:visible').count()==0)
        _undo(h,kind,name).click();h.check('A22 '+kind+'全部字段原位置恢复',h.page.evaluate('JSON.stringify('+path+')')==before)
    h.seed(FULL,work=4,step='product');fields=h.page.evaluate('Work4.summaryText("product")')
    _active(h).get_by_role('button',name='清空正文',exact=True).click();h.confirm('清空正文')
    h.check('A22 清正文仅删除叙事表单导出保留',h.page.evaluate('state.work4.product.aiResult')=='' and h.page.evaluate('Work4.summaryText("product")')==fields)
    # W5 import is a chapter-range confirmation; its evidence is read-only.
    for name,terms in [('重新汇总',['业务与市场']),('重新导入 PEST',['PEST 四项','政治、经济、社会、技术']),('重新导入目标市场',['STP 的目标市场']),('重新导入细分与定位',['STP 的细分与定位']),('重新导入',['营销组合的路径、产品、价格、渠道、传播']),('从 Work 1–4 一键汇总',['业务与市场、PEST、STP、路径与 4P'])]:
        h.seed(FULL,work=5,step='plan')
        _confirm_cancel(h,_active(h).get_by_role('button',name=name,exact=True),terms+['其他策划书内容会保留'],'A22 W5 '+name)
    h.seed(FULL,work=5,step='plan');keep=h.page.evaluate('({outlook:state.work5.ch5_outlook,stp:state.work5.ch3_strategy,swot:state.work5.ch2_environment.strengths})')
    _active(h).get_by_role('button',name='重新导入 PEST',exact=True).click();h.confirm('导入并覆盖')
    got=h.page.evaluate('({outlook:state.work5.ch5_outlook,stp:state.work5.ch3_strategy,swot:state.work5.ch2_environment.strengths,pest:state.work5.ch2_environment.political})')
    h.check('A22 W5实际PEST导入范围准确',all(got[k]==keep[k] for k in keep) and got['pest'].startswith('合成政治'),got)
    h.check('A22 W5证据块无删除入口',_active(h).locator('.synced-badge').count()>0 and _active(h).locator('.synced-block .delete-control,.evidence-block .delete-control').count()==0)
    h.seed(FULL,work=1,step='sbu')
    h.save_version('A22合成删除版本');h.open_history()
    _confirm_cancel(h,_delete(h,'历史版本','A22合成删除版本'),['A22合成删除版本','不可恢复','只删除这一份历史快照','不删除当前工作区内容'],'A22历史版本')
    before=_content(h)
    _delete(h,'历史版本','A22合成删除版本').click();h.confirm('删除历史版本');h.wait_idle()
    h.check('A22 历史实际删除不影响工作区',h.snapshot('A22合成删除版本') is None and _content(h)==before)
    h.page.get_by_role('button',name='关闭历史记录面板',exact=True).click()
    h.screenshot('A22-risk-entry-review')


def run(h):
    cases=[('A06','真实1模拟3分来源清空',a06),('A07','模拟纳入与Work1勾选保留',a07),('A08','语料指标画像依赖删除',a08),('A09','候选渠道标签伙伴删除撤销',a09),('A10','三次连续独立撤销保留新编辑',a10),('A11','真实10秒暂停导航替换撤销',a11),('A16','按钮稳定选中焦点禁用状态',a16),('A17','真实AI按钮单调用多单元重生成',a17),('A18','名称热区键盘触屏',a18),('A19','390及768窄屏提示横滚编辑',a19),('A20','桌面布局跨断点与局部表滚动',a20),('A22','W1–W5其余风险删除入口',a22)]
    for code,title,callback in cases:
        h.case(code,title,lambda callback=callback:callback(h))
