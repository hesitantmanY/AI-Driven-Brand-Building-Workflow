/* Deletion contracts with synthetic W1/W2 data and the real shared remove/undo helper. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass=0, fail=0, seq=0, answer=true, dirty=0;
const confirmations=[];
const ok=(name,condition,detail)=>{
  if(condition){pass++;console.log('PASS '+name);}
  else{fail++;console.log('FAIL '+name+(detail?' — '+detail:''));}
};
const walk=(node,out=[])=>{if(node){out.push(node);(node.children||[]).forEach(n=>walk(n,out));}return out;};
function node(tag,attrs={}){
  const n={tag,tagName:tag.toUpperCase(),attrs:{},children:[],handlers:{},dataset:{},style:{},isConnected:true,
    appendChild(c){if(c!=null){this.children.push(c);c.parentNode=this;}return c;},
    addEventListener(k,f){this.handlers[k]=f;},setAttribute(k,v){this.attrs[k]=v;if(k==='id')this.id=v;if(k==='class')this.className=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(v);},
    getAttribute(k){return this.attrs[k];},removeAttribute(k){delete this.attrs[k];},
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.isConnected=false;},
    contains(c){return walk(this).includes(c);},closest(){return null;},focus(){document.activeElement=this;},
    querySelector(sel){return this.querySelectorAll(sel)[0]||null;},
    querySelectorAll(sel){return walk(this).slice(1).filter(c=>sel.split(',').some(s=>s.trim()===c.tag||s.trim()==='.'+c.className||(s.trim()==='.plate'&&String(c.className||'').split(' ').includes('plate'))));},
    classList:{add(){},remove(){},toggle(){return false;},contains(){return false;}},
    set innerHTML(v){this._html=v;this.children=[];},get innerHTML(){return this._html||'';},
    set textContent(v){this._text=String(v);this.children=[];},get textContent(){return this._text??this.children.map(c=>c.textContent||'').join('');}
  };
  Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n;
}
function el(tag,attrs={},...children){
  const n=node(tag);
  Object.entries(attrs||{}).forEach(([k,v])=>{
    if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.slice(2),v);
    else if(k==='style')Object.assign(n.style,typeof v==='object'?v:{cssText:v});
    else if(v!=null&&v!==false)n.setAttribute(k,v);
  });
  children.flat().forEach(c=>{if(c!=null&&c!==false)n.appendChild(typeof c==='object'?c:Object.assign(node('#text'),{_text:String(c)}));});
  return n;
}
const document={body:node('body'),head:node('head'),activeElement:null,createElement:node,createTextNode:t=>Object.assign(node('#text'),{_text:String(t)}),
  querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,addEventListener(){},removeEventListener(){}};
const sandbox={console,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,setTimeout,clearTimeout,setInterval,clearInterval,
  document,el,uid:p=>p+'_'+(++seq),mean:a=>a.length?a.reduce((a,b)=>a+b,0)/a.length:0,sd:()=>0,median:()=>0,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),esc:s=>String(s??''),autosave:()=>dirty++,showToast(){},
  confirm:message=>{confirmations.push({message});return answer;},
  renderBarChart(){},renderMatrix(){},renderRadarChart(){},renderLikertChart(){},
  UI:{field:(l,n)=>el('div',{},l,n),tagsInput:values=>({el:el('div',{},el('input')),get:()=>values||[]}),mountGuard:()=>true,mountMvo(){},mountMark(){},stepNextCta:()=>null,nextWorkCta:()=>null},
  API:{aiButton(){},aiCtxBox:()=>({box:el('div')}),aiPipeline(){}},Runner:{start:()=>null,renderUI(){},finish(){}},
  App:{currentWork:1,renderSubtabs(){},updateSummary(){}},Work1:{},Work2:{},state:null,sessionStorage:{setItem(){},getItem:()=>null,removeItem(){}}
};
sandbox.window=sandbox;vm.createContext(sandbox);
for(const file of ['lib/interaction.js','workshop1.js','workshop2.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs',file),'utf8'),sandbox,{filename:file});
const {Work1:W1,Work2:W2,Interaction:I}=sandbox;
I.confirm=async cfg=>{confirmations.push(cfg);return answer;};
W1.rerender=()=>{};W2.rerender=()=>{};W1.renderSmileCurve=()=>{};
function fresh(){I.invalidateUndo();document.body.children.slice().forEach(n=>n.remove());document.body.innerHTML='';W1.personaDraft.mountPoint=null;answer=true;dirty=0;confirmations.length=0;sandbox.state={meta:{},work1:W1.defaultData(),work2:W2.defaultData(),work3:{scenarios:[]}};return sandbox.state;}
function render(work,step){const plate=el('div',{class:'plate'});const sec={querySelector:()=>plate,querySelectorAll:()=>[],appendChild(){}};work.render[step](sec);return plate;}
const buttons=(p,text)=>walk(p).filter(n=>n.tag==='button'&&n.textContent===text);
const byType=(p,type)=>walk(p).filter(n=>n.tag==='button'&&String(n.attrs['aria-label']||'').startsWith('删除'+type));
const click=async b=>{if(!b)throw new Error('Missing expected button');return b.handlers.click({currentTarget:b,target:b});};
const undoIds=()=>walk(document.body).filter(n=>n.attrs['data-undo-id']!=null).map(n=>Number(n.attrs['data-undo-id']));
async function test(name,fn){try{await fn();}catch(e){ok(name,false,e.stack);}}

(async()=>{
  await test('W1 competitor delete and undo',async()=>{
    const s=fresh();s.work1.environment.competitors=[{id:'a',name:'A',price:'18'},{id:'b',name:'B',price:'26'}];
    const plate=render(W1,'environment');await click(byType(plate,'竞品')[0]);
    ok('竞品直接删除不先确认',confirmations.length===0&&s.work1.environment.competitors.length===1);
    s.work1.environment.industry='删除后的编辑';const ids=undoIds();ok('竞品删除有独立撤销入口',ids.length===1);
    if(ids.length)I.undo(ids[0]);
    ok('竞品撤销恢复字段/id/位置',s.work1.environment.competitors[0]?.id==='a'&&s.work1.environment.competitors[0]?.price==='18');
    ok('竞品撤销保留无关编辑',s.work1.environment.industry==='删除后的编辑');
    ok('竞品入口对象名和危险样式完整',plate&&byType(plate,'竞品')[0]?.attrs['aria-label']==='删除竞品：A'&&/danger/.test(byType(plate,'竞品')[0]?.className||''));
  });
  await test('W1 scene dependency confirmation',async()=>{
    const s=fresh();s.work1.personas=[{id:'p',name:'P1',values:[],channels:[]}];s.work1.scenarios=[{id:'sc',name:'送礼',personaIds:['p'],benefits:{},costs:{}}];s.work1.survey.responses=[{personaId:'p',answers:[]}];
    let plate=render(W1,'personas');answer=false;const before=JSON.stringify(s);await click(buttons(plate,'删除场景')[0]);
    ok('有关联场景取消不改数据',JSON.stringify(s)===before);
    ok('场景确认只说明真实关联且保留画像/答卷',/1.*画像/.test(confirmations[0]?.message||'')&&/保留/.test(confirmations[0]?.message||''),confirmations[0]?.message);
    answer=true;await click(buttons(plate,'删除场景')[0]);
    ok('场景确认后删除场景，保留画像和历史答卷',s.work1.scenarios.length===0&&s.work1.personas.length===1&&s.work1.survey.responses.length===1);
  });
  await test('W1 persona reference cleanup',async()=>{
    const s=fresh();s.work1.personas=[{id:'p1',name:'P1',values:[],channels:[]},{id:'p2',name:'P2',values:[],channels:[]}];
    s.work1.scenarios=[{id:'sc',name:'自用',personaIds:['p1','p2'],benefits:{},costs:{}}];s.work3.scenarios=[{id:'sc3',personaIds:['p1','p2']}];
    s.work1.survey.responses=[{personaId:'p1',answers:[{questionId:'keep',value:3}]},{personaId:'p2',answers:[]}];s.work1.survey._doneKeys=['p1:0','p2:0'];
    const plate=render(W1,'personas');await click(buttons(plate,'删除')[0]);
    ok('画像删除先确认准确答卷/场景范围',confirmations.length===1&&/1 份/.test(confirmations[0]?.message||'')&&/场景/.test(confirmations[0]?.message||''));
    ok('画像删除取消 W1/W3 的真实场景关联',s.work1.scenarios[0].personaIds.join()==='p2'&&s.work3.scenarios[0].personaIds.join()==='p2');
    ok('画像删除保留答卷但清空 persona 指向',s.work1.survey.responses.length===2&&s.work1.survey.responses[0].personaId==null&&s.work1.survey.responses[0].answers[0].value===3);
    ok('画像删除清过期完成记录并在保存前重编号',s.work1.survey._doneKeys.join()==='p2:0'&&s.work1.personas[0].name==='P1');
  });
  await test('W1 persona removal invalidates only W3 persona aggregates',async()=>{
    const s=fresh();s.work1.personas=[{id:'p1',name:'P1',values:[],channels:[]},{id:'p2',name:'P2',values:[],channels:[]}];
    s.work3.dimensions={desirability:[{key:'d1'},{key:'d2'},{key:'d3'}]};
    s.work3.candidates=[{id:'c',desirabilityScores:{p1:{d1:9},p2:{d1:5}},d1:7,src_d1:'personas',d2:4,src_d2:'user',d3:6}];
    s.work3._scoreDone=['d:p1:c','d:p2:c','i:c'];s.work3.context={personas:[{id:'p1',name:'P1'},{id:'p2',name:'P2'}]};
    const plate=render(W1,'personas');await click(buttons(plate,'删除')[0]);const c=s.work3.candidates[0];
    ok('画像删除清 W3 子分和相应断点，其他 persona 保留',!c.desirabilityScores.p1&&c.desirabilityScores.p2.d1===5&&s.work3._scoreDone.join()==='d:p2:c,i:c');
    ok('画像删除只使 W3 persona 缓存均值失效，保留人工维度分',c.d1==null&&c.src_d1==null&&c.d2===4&&c.src_d2==='user'&&c.d3===6);
    ok('画像删除同步快照去旧指向并重排名称',s.work3.context.personas.length===1&&s.work3.context.personas[0].id==='p2'&&s.work3.context.personas[0].name==='P1');
  });
  await test('W1 question and metric cleanup',async()=>{
    const s=fresh();s.work1.personas=[{id:'p',values:[],channels:[]}];s.work1.metrics.dimensions=[{id:'d',name:'显著性',secondaries:[{id:'i1',name:'认知',selfScore:7,actual:8},{id:'i2',name:'曝光',selfScore:6,actual:5}]}];
    s.work1.survey.questions=[{id:'q1',text:'认知题',type:'likert',sourceIndicatorId:'i1',anchors:[]},{id:'q2',text:'保留题',type:'likert',sourceIndicatorId:'i2',anchors:[]}];
    s.work1.survey.responses=[{personaId:'p',answers:[{questionId:'q1',value:4},{questionId:'q2',value:3}]}];
    s.work1.analysis={likertStats:{q1:{mean:4,n:1},q2:{mean:3,n:1}},openThemes:[{questionId:'q2',themes:[{label:'保留主题'}],quotes:['保留引文']}],indicatorMeans:[{sourceIndicatorId:'i1',mean:4,n:1},{sourceIndicatorId:'i2',mean:3,n:1}],insights:'旧洞察'};
    let plate=render(W1,'metrics');answer=false;let before=JSON.stringify(s);await click(byType(plate,'测评点')[0]);ok('测评点取消不改任何引用',JSON.stringify(s)===before);
    answer=true;await click(byType(plate,'测评点')[0]);
    ok('测评点删除连同关联生成题与答案',s.work1.survey.questions.map(q=>q.id).join()==='q2'&&s.work1.survey.responses[0].answers.map(a=>a.questionId).join()==='q2');
    ok('测评点删除清孤儿统计，保留其它题主题',!s.work1.analysis.likertStats.q1&&s.work1.analysis.openThemes[0]?.quotes[0]==='保留引文');
    ok('测评点删除清相关实测聚合与失效洞察',s.work1.analysis.indicatorMeans.every(x=>x.sourceIndicatorId!=='i1')&&s.work1.analysis.insights==='');
    plate=render(W1,'metrics');await click(buttons(plate,'删除')[0]);
    ok('一级删除清全部子项/题目/答案并重新回填',s.work1.metrics.dimensions.length===0&&s.work1.survey.questions.length===0&&s.work1.survey.responses[0].answers.length===0&&s.work1.analysis.indicatorMeans.length===0);
  });
  await test('W1 independent question undo and bound deletion',async()=>{
    const s=fresh();s.work1.personas=[{id:'p',values:[],channels:[]}];s.work1.survey.questions=[{id:'q',type:'likert',text:'手动题',sourceIndicatorId:null,anchors:[]}];
    let plate=render(W1,'survey');await click(buttons(plate,'删除')[0]);const ids=undoIds();ok('独立手动题无需确认并可撤销',confirmations.length===0&&ids.length===1);
    if(ids.length)I.undo(ids[0]);ok('题目撤销恢复原 id',s.work1.survey.questions[0]?.id==='q');
    s.work1.survey.responses=[{personaId:'p',answers:[{questionId:'q',value:4}]}];s.work1.analysis.likertStats={q:{mean:4,n:1}};
    plate=render(W1,'survey');answer=false;const before=JSON.stringify(s);await click(buttons(plate,'删除')[0]);ok('已有答卷的题目取消不改答案/统计',JSON.stringify(s)===before&&confirmations.length===1);
    answer=true;await click(buttons(plate,'删除')[0]);ok('题目确认后清相应答案/统计，保留答卷',s.work1.survey.responses.length===1&&s.work1.survey.responses[0].answers.length===0&&!s.work1.analysis.likertStats.q);
  });
  await test('W1 rebuild and clear answers',async()=>{
    const s=fresh();s.work1.personas=[{id:'p',values:[],channels:[]}];s.work1.metrics.dimensions=[{id:'d',name:'维度',secondaries:[{id:'i',name:'测评',selfScore:8,actual:9}]}];
    s.work1.survey.questions=[{id:'old',type:'likert',text:'旧指标题',sourceIndicatorId:'i',anchors:[]},{id:'manual',type:'likert',text:'保留手动题',sourceIndicatorId:null,anchors:[]}];
    s.work1.survey.responses=[{personaId:'p',answers:[{questionId:'old',value:5},{questionId:'manual',value:2}]}];s.work1.survey._doneKeys=['p:0'];s.work1.survey.progress={done:1,total:1};s.work1.survey.status='done';s.work1.survey.error='旧错误';
    s.work1.analysis.likertStats={old:{mean:5,n:1},manual:{mean:2,n:1}};s.work1.analysis.insights='旧洞察';
    await W1.rebuildQuestionsFromMetrics();
    ok('重建确认说明旧/新/保留题数与答案影响',/1 道/.test(confirmations[0]?.message||'')&&/手动/.test(confirmations[0]?.message||'')&&/回答|答案/.test(confirmations[0]?.message||''),confirmations[0]?.message);
    ok('重建清旧指标题答案/统计且保留手动题及答案',s.work1.survey.questions.some(q=>q.id==='manual')&&!s.work1.survey.questions.some(q=>q.id==='old')&&s.work1.survey.responses[0].answers.map(a=>a.questionId).join()==='manual'&&!s.work1.analysis.likertStats.old);
    ok('重建清完成断点、回填失效值',s.work1.survey._doneKeys.length===0&&s.work1.metrics.dimensions[0].secondaries[0].actual==null);
    s.work1.survey.error='旧错误';s.work1.survey.progress={done:1,total:1};const plate=render(W1,'survey');await click(buttons(plate,'清空回答')[0]);
    ok('清空回答确认报准确数量及派生范围',/1 份/.test(confirmations.at(-1)?.message||'')&&/统计/.test(confirmations.at(-1)?.message||'')&&/实测/.test(confirmations.at(-1)?.message||''));
    ok('清空回答清答卷/完成记录/统计/主题/洞察/实测',s.work1.survey.responses.length===0&&s.work1.survey._doneKeys.length===0&&Object.keys(s.work1.analysis.likertStats).length===0&&s.work1.analysis.openThemes.length===0&&s.work1.analysis.insights==='');
    ok('清空回答重置进度与错误，保留问卷和自评',s.work1.survey.progress.done===0&&s.work1.survey.progress.total===0&&s.work1.survey.error==null&&s.work1.survey.questions.length===2&&s.work1.metrics.dimensions[0].secondaries[0].selfScore===8);
  });
  await test('W1 clear adoption preserves historical answers',async()=>{
    const s=fresh();s.work1.personas=[{id:'p',values:[],channels:[]}];s.work1.scenarios=[{id:'sc',name:'场景',personaIds:['p']}];s.work1.survey.responses=[{personaId:'p',answers:[]}];s.work3.scenarios=[{id:'sc3',personaIds:['p']}];
    W1.personaDraft.versions=[{personas:[{name:'P1'}],scenarios:[{name:'场景'}]}];W1.personaDraft.version=0;W1.personaDraft.mountDrawer();
    answer=false;const before=JSON.stringify(s);await click(buttons(document.body,'清空采纳')[0]);ok('清空采纳取消不改任何数据',JSON.stringify(s)===before);
    answer=true;await click(buttons(document.body,'清空采纳')[0]);
    ok('清空采纳确认列出画像/场景/答卷数量',/1.*画像/.test(confirmations.at(-1)?.message||'')&&/1.*场景/.test(confirmations.at(-1)?.message||'')&&/1 份/.test(confirmations.at(-1)?.message||''));
    ok('清空采纳清整组及关系，答卷去指向并保留',s.work1.personas.length===0&&s.work1.scenarios.length===0&&s.work1.survey.responses.length===1&&s.work1.survey.responses[0].personaId==null&&s.work3.scenarios[0].personaIds.length===0);
  });
  await test('W2 candidate independent three-item undo',async()=>{
    const s=fresh();s.work2.candidates=[{id:'c1',name:'华东',reason:'一'},{id:'c2',name:'华东',reason:'二'},{id:'c3',name:'',reason:'三'}];s.work2.retained=[{id:'r',name:'华东',reason:'保留'}];
    let plate=render(W2,'framework');const deletes=walk(plate).filter(n=>n.tag==='button'&&n.textContent==='×').slice(0,3);
    ok('重名和未命名候选入口有编号',deletes[0].attrs['aria-label']==='删除候选市场：华东，第 1 项'&&deletes[2].attrs['aria-label']==='删除候选市场：未命名候选市场，第 3 项');
    for(let i=0;i<3;i++){plate=render(W2,'framework');await click(walk(plate).find(n=>n.tag==='button'&&n.textContent==='×'));}
    ok('连续三个候选各有撤销，保留市场未受影响',undoIds().length===3&&s.work2.candidates.length===0&&s.work2.retained[0].id==='r'&&confirmations.length===0);
    s.work2.matrix.notes='后续编辑';const ids=undoIds();ids.reverse().forEach(id=>I.undo(id));
    ok('候选独立撤销恢复全部内容和位置',s.work2.candidates.map(c=>c.id).join()==='c1,c2,c3'&&s.work2.candidates[1].reason==='二');
    ok('候选撤销不回滚无关内容',s.work2.matrix.notes==='后续编辑');
  });
  await test('W2 retained market cleanup',async()=>{
    const s=fresh();s.work2.retained=[{id:'m1',name:'德国'},{id:'m2',name:'瑞典'}];s.work2.scoring={m1:{x:{score:7}},m2:{x:{score:6}}};s.work2.decision.explanations={德国:'旧解释',瑞典:'保留解释'};s.work2.decision.tier1.marketId='m1';s.work2.decision.tier2.marketIds=['m1','m2'];s.work2.decision.tier3.marketIds=['m1'];
    const plate=render(W2,'framework');const del=byType(plate,'保留市场')[0]||walk(plate).filter(n=>n.tag==='button'&&n.textContent==='×')[0];answer=false;let before=JSON.stringify(s);await click(del);ok('保留市场取消不变数据',JSON.stringify(s)===before);
    answer=true;await click(del);ok('保留市场确认后清评分/解释和三档指针',!s.work2.scoring.m1&&!s.work2.decision.explanations.德国&&s.work2.decision.tier1.marketId==null&&s.work2.decision.tier2.marketIds.join()==='m2'&&s.work2.decision.tier3.marketIds.length===0);
    ok('保留市场删除保留其它市场与评分',s.work2.retained.length===1&&s.work2.retained[0].id==='m2'&&s.work2.scoring.m2.x.score===6);
  });
  await test('W2 same-name market explanation is shared',async()=>{
    const s=fresh();s.work2.retained=[{id:'m1',name:'同名市场'},{id:'m2',name:'同名市场'}];s.work2.decision.explanations={'同名市场':'共享解释'};
    const plate=render(W2,'framework');await click(byType(plate,'保留市场')[0]);
    ok('删同名市场只清该对象，确认准确说明共享解释保留',s.work2.retained[0].id==='m2'&&s.work2.decision.explanations['同名市场']==='共享解释'&&/共享.*保留/.test(confirmations[0]?.message||''),confirmations[0]?.message);
  });
  await test('W2 axis restore retains focus on the selected axis',async()=>{
    fresh();const plate=render(W2,'framework'),target=walk(plate).find(n=>n.attrs['aria-label']==='恢复业务竞争力默认模板');
    const oldQuery=document.querySelector;document.querySelector=sel=>sel.startsWith('#steps2')?plate:null;
    await W2.restoreAxisTemplate('competitiveness',target);document.querySelector=oldQuery;
    ok('恢复第二轴后焦点仍在第二轴的模板入口',document.activeElement===target);
  });
  await test('W2 indicator and axis cleanup',async()=>{
    const s=fresh();s.work2.retained=[{id:'m',name:'德国'}];const cat=s.work2.attractiveness.categories[0], id=cat.indicators[0].id, keep=cat.indicators[1].id, other=s.work2.competitiveness.categories[0].indicators[0].id;
    s.work2.scoring={m:{[id]:{score:8},[keep]:{score:6},[other]:{score:7}}};s.work2.delphi.personas=[{id:'p',perspectiveName:'专家',ratings:{attractiveness:{[id]:.2,[keep]:.8},competitiveness:{[other]:1}}}];s.work2.delphi.recruitment.perspectives=[{name:'专家'}];s.work2.delphi.finalWeights={attractiveness:{[id]:.2,[keep]:.8},competitiveness:{[other]:1}};s.work2.delphi.summary='旧收敛';s.work2.delphi.status='done';
    let plate=render(W2,'framework');const del=byType(plate,'二级指标')[0]||walk(plate).filter(n=>n.tag==='button'&&n.textContent==='×')[1];answer=false;let before=JSON.stringify(s);await click(del);ok('二级指标取消不改评分与权重',JSON.stringify(s)===before);
    answer=true;await click(del);
    ok('二级删除清评分与 persona 权重引用',!s.work2.scoring.m[id]&&!s.work2.delphi.personas.some(p=>Object.hasOwn(p.ratings?.attractiveness||{},id)));
    ok('二级删除清旧收敛，保留其它指标与评分',s.work2.delphi.finalWeights==null&&s.work2.delphi.summary===''&&s.work2.scoring.m[other].score===7&&cat.indicators[0].id===keep);
    const axisBefore=JSON.stringify(s.work2.competitiveness);await W2.restoreAxisTemplate('attractiveness');
    ok('恢复轴模板先确认准确范围与不可恢复',/市场吸引力/.test(confirmations.at(-1)?.message||'')&&/不会/.test(confirmations.at(-1)?.message||'')&&/另一轴/.test(confirmations.at(-1)?.message||''));
    ok('恢复模板清本轴旧评分且保留另一轴评分/结构',!s.work2.scoring.m[keep]&&s.work2.scoring.m[other].score===7&&JSON.stringify(s.work2.competitiveness)===axisBefore);
    ok('恢复模板清 Delphi 派生与断点',s.work2.delphi.personas.length===0&&s.work2.delphi.status==='idle'&&s.work2.delphi.summary===''&&s.work2.delphi.phase==null);
  });
  await test('W2 criteria, perspective, milestones and observation metrics',async()=>{
    const s=fresh();s.work2.screening.criteria=[{id:'crit',name:'规模',source:'报告'}];s.work2.retained=[{id:'m',name:'德国',reason:'符合规模'}];
    let plate=render(W2,'framework');answer=false;let before=JSON.stringify(s);let del=byType(plate,'筛选标准')[0]||walk(plate).find(n=>n.tag==='button'&&n.textContent==='×');await click(del);ok('已筛选标准先确认，取消保留依据',JSON.stringify(s)===before&&confirmations.length===1);
    answer=true;await click(del);ok('删标准保留已保留市场，确认说明需复核',s.work2.retained[0].id==='m'&&/复核/.test(confirmations.at(-1)?.message||''));
    s.work2.delphi.recruitment.perspectives=[{name:'财务'},{name:'渠道'}];s.work2.delphi.personas=[{id:'p',perspectiveName:'财务',ratings:{}}];s.work2.delphi.status='done';s.work2.delphi.summary='旧总结';s.work2.delphi.finalWeights={};s.work2.delphi.phase=1;
    plate=render(W2,'framework');await click(byType(plate,'招聘视角')[0]||byType(plate,'视角')[0]);
    ok('删除已赋权视角先确认并清其 persona/收敛/断点',confirmations.at(-1)?.confirmLabel==='删除招聘视角'&&!s.work2.delphi.personas.some(p=>p.perspectiveName==='财务')&&s.work2.delphi.summary===''&&s.work2.delphi.finalWeights==null&&s.work2.delphi.phase==null);
    s.work2.decision.tier1.marketId='m';s.work2.decision.tier1.milestones=['首单','复购'];s.work2.decision.tier2.observationMetrics=['季度增长'];plate=render(W2,'decision');const count=confirmations.length;await click(byType(plate,'里程碑')[0]);ok('里程碑直接删除并有撤销',confirmations.length===count&&undoIds().length===1);
    answer=false;before=JSON.stringify(s);await click(byType(plate,'观察指标')[0]);ok('观察指标先确认，取消不动',confirmations.length===count+1&&JSON.stringify(s)===before);
  });
  await test('W2 persona resume follows remaining perspectives',async()=>{
    const s=fresh();s.work1.sbu.name='SBU';s.work2.delphi.recruitment.perspectives=[{name:'甲',keySignals:[]},{name:'乙',keySignals:[]},{name:'丙',keySignals:[]}];
    s.work2.delphi.personas=[{id:'done-b',perspectiveName:'乙',ratings:{}}];
    const calls=[],oldApi=sandbox.API.callJson,oldRunner=sandbox.Runner,oldContext=sandbox.AiContext;
    sandbox.AiContext={tr:s=>String(s),fewShotText:()=>''};sandbox.API.callJson=async messages=>{calls.push(messages[0].content);return {ratings:{},reasoning:''};};
    sandbox.Runner={start:()=>({controller:{signal:{}},done:0,aborted:false}),renderUI(){},finish(){},tick(){},signal:()=>({})};
    await W2.runPersonas(el('button'));sandbox.Runner=oldRunner;sandbox.API.callJson=oldApi;sandbox.AiContext=oldContext;
    ok('招聘删除/异序完成后续跑补缺失视角，不重跑已完成者',calls.length===2&&calls.some(s=>s.startsWith('你是甲'))&&calls.some(s=>s.startsWith('你是丙'))&&!calls.some(s=>s.startsWith('你是乙')),JSON.stringify(calls));
  });
  I.invalidateUndo();console.log('\n'+pass+' passed, '+fail+' failed');process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
