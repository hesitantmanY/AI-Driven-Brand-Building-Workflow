/* Synthetic interaction checks for W3/W4 deletion, source scopes and remounted undo. */
'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.join(__dirname,'..','docs');
const walk=(node,out=[])=>{if(!node||typeof node!=='object')return out;out.push(node);(node.children||[]).forEach(child=>walk(child,out));return out;};
const text=node=>node.nodeType===3?node.text:node._text??(node.children||[]).map(text).join('');
function matches(node,selector){
  if(node.nodeType!==1)return false;
  if(selector.startsWith('.'))return node.className.split(/\s+/).includes(selector.slice(1));
  if(selector.startsWith('['))return Object.hasOwn(node.attrs,selector.slice(1,-1));
  if(selector.startsWith('#'))return node.attrs.id===selector.slice(1);
  return node.tagName===selector.toUpperCase();
}
function makeNode(tag){
  const node={nodeType:1,tagName:String(tag).toUpperCase(),children:[],attrs:{},dataset:{},style:{},className:'',value:'',_listeners:{},isConnected:true,
    appendChild(child){this.children.push(child);child.parentNode=this;return child;},
    addEventListener(type,fn){(this._listeners[type]||=[]).push(fn);},
    setAttribute(key,value){this.attrs[key]=String(value);if(key==='value')this.value=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);},
    removeAttribute(key){delete this.attrs[key];},
    insertAdjacentHTML(position,value){this._html=(this._html||'')+String(value);},
    getAttribute(key){return this.attrs[key]??null;},
    querySelectorAll(selector){const choices=selector.split(',');return walk(this).slice(1).filter(n=>choices.some(s=>matches(n,s.trim())));},
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;},
    closest(selector){let current=this;while(current){if(matches(current,selector))return current;current=current.parentNode;}return null;},
    contains(other){return walk(this).includes(other);},
    focus(){document.activeElement=this;},
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.isConnected=false;}
  };
  Object.defineProperty(node,'innerHTML',{get(){return this._html||'';},set(value){this._html=String(value);this.children=[];this._text=null;}});
  Object.defineProperty(node,'textContent',{get(){return text(this);},set(value){this._text=String(value);}});
  return node;
}
const document={body:makeNode('body'),activeElement:null,createElement:makeNode,createTextNode:value=>({nodeType:3,text:String(value),children:[]}),
  querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,addEventListener(){},removeEventListener(){}};
function el(tag,attrs={},...children){
  const node=makeNode(tag);
  Object.entries(attrs).forEach(([key,value])=>{
    if(key==='class')node.className=String(value);
    else if(key==='style')Object.assign(node.style,typeof value==='object'?value:{cssText:value});
    else if(key.startsWith('on')&&typeof value==='function')node.addEventListener(key.slice(2),value);
    else if(key==='html')node.innerHTML=value;
    else if(value!=null)node.setAttribute(key,value);
  });
  children.flat().filter(child=>child!=null&&child!==false).forEach(child=>node.appendChild(typeof child==='string'||typeof child==='number'?document.createTextNode(child):child));
  return node;
}
let saved='',saves=0,approved=true,confirmations=[],toasts=[],renders=[];
const sandbox={console,document,el,setTimeout,clearTimeout,setInterval,clearInterval,Date,JSON,Math,Object,Array,String,Number,Boolean,Set,Map,AbortController,
  uid:prefix=>prefix+'_'+Math.random().toString(36).slice(2),esc:value=>String(value??''),
  mean:values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0,median:values=>values.length?values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)]:0,
  clamp:(value,lo,hi)=>Math.max(lo,Math.min(hi,value)),autosave(){saved=JSON.stringify(sandbox.state);saves++;},showToast:value=>toasts.push(value),
  backendOnline:false,state:null,Work1:{},Work2:{},Work3:{},Work4:{},App:{updateSummary(){}},
  API:{config:()=>({apiKey:''}),aiCtxBox:cfg=>({box:el('div',{},cfg.label)}),aiPipeline(){},callJson:async()=>({importance:8,uniqueness:6,credibility:4})},
  Runner:{tick(){},checkpoint:async()=>{}},
  AiContext:{mountSettings:()=>({current:()=>({sections:[]})}),buildPrompt:()=>[]},
  UI:{field:(label,...children)=>el('div',{},label,...children),tagsInput(initial){const node=el('div',{},el('input'));return {el:node,get:()=>typeof initial==='function'?initial():initial};}}
};
sandbox.window=sandbox;
vm.createContext(sandbox);
for(const file of ['lib/interaction.js','workshop3.js','workshop4.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
const W3=sandbox.Work3,W4=sandbox.Work4,I=sandbox.Interaction,originalHead=W4.aiHeadRow;
I.confirm=async cfg=>{confirmations.push(cfg);return approved;};
W3.rerender=id=>renders.push('w3:'+id);W4.rerender=id=>renders.push('w4:'+id);
W4.aiHeadRow=()=>el('div');W4.renderSegments=()=>null;W4.refreshCharts=()=>{};
const plain=value=>JSON.parse(JSON.stringify(value));
function fresh(){
  I.invalidateUndo();approved=true;confirmations=[];toasts=[];renders=[];saves=0;saved='';
  sandbox.state={meta:{},settings:{manualMode:true},work1:{sbu:{name:'合成品牌'},analysis:{openThemes:[]},personas:[],values:{}},work3:W3.defaultData(),work4:W4.defaultData()};
  return sandbox.state;
}
function render(step,work=W3){const sec=el('section',{class:'step','data-step':step},el('div',{class:'plate'}));work.render[step](sec);return sec;}
const buttons=node=>walk(node).filter(n=>n.tagName==='BUTTON');
const findButton=(node,label)=>buttons(node).find(n=>n.attrs['aria-label']===label||text(n)===label);
const click=async node=>{assert.ok(node,'button exists');return await node._listeners.click[0]({target:node,currentTarget:node,preventDefault(){}});};
const undoButtons=()=>buttons(document.body).filter(n=>/^撤销删除/.test(n.attrs['aria-label']||''));
function seedLda(m){m.stats={raw_count:6,valid_count:6};m.topics=[{id:1,label:'旧主题',keywords:[],representative_docs:[]}];m.corpusComposition={real:3,simulated:3,total:6};m.ldaResult={old:true};}

(async()=>{
  {
    const st=fresh(),m=st.work3.mining;m.documents=['本地真实'];m.simulatedDocuments=['模拟甲','模拟乙','模拟丙'];seedLda(m);
    st.work1.analysis.openThemes=[{texts:['上游回答'],themes:[{label:'上游主题'}],question:'合成问题'}];m.painMap=[{id:'p',pain:'痛点',linkedTopicId:1}];
    const before=JSON.stringify(st);approved=false;
    assert.equal(await W3.clearCorpus('real'),false);assert.equal(JSON.stringify(st),before);assert.equal(saves,0);
    assert.match(confirmations[0].message,/1 条真实语料.*3 条模拟语料会保留，当前仍参与建模/);
    approved=true;await W3.clearCorpus('real');
    assert.deepEqual(plain(m.documents),[]);assert.equal(m.simulatedDocuments.length,3);assert.equal(m.stats,null);assert.equal(m.ldaResult,null);assert.equal(m.painMap[0].linkedTopicId,null);
    assert.equal(m.includeWork1Open,true);assert.equal(m.includeWork1Themes,true);assert.equal(m.includeSimulated,true);assert.equal(m.includeNegative,true);
    assert.equal(W3.collectDocs().length,5);assert.match(toasts.at(-1),/已清空本地真实语料 1 条.*模拟语料仍参与建模/);
    assert.equal(JSON.parse(saved).work3.mining.documents.length,0);
    m.documents.push('保留本地');m.includeSimulated=false;seedLda(m);approved=false;
    const beforeSim=JSON.stringify(st);await W3.clearCorpus('simulated');assert.equal(JSON.stringify(st),beforeSim);
    approved=true;await W3.clearCorpus('simulated');assert.equal(m.documents.length,1);assert.equal(m.simulatedDocuments.length,0);assert.equal(m.includeSimulated,false);
    assert.match(toasts.at(-1),/已清空模拟语料 3 条.*当前无模拟语料/);assert.equal(st.work1.analysis.openThemes.length,1);
    console.log('PASS source-specific clear, cancellation, old-result invalidation and saved data');
  }
  {
    const st=fresh(),m=st.work3.mining;m.documents=['真实一'];m.simulatedDocuments=['模拟一','模拟二','模拟三'];m.includeSimulated=false;
    st.work1.analysis.openThemes=[{texts:['上游一','上游二'],themes:[{label:'上游主题'}]}];m.includeWork1Themes=false;
    const sec=render('mining');assert.match(text(sec),/本地真实 1 条 \+ 模拟 3 条/);assert.match(text(sec),/实际纳入真实 3 条 \+ 模拟 0 条/);assert.ok(!text(sec).includes('不足 3 条'));
    assert.ok(findButton(sec,'清空本地真实语料'));assert.ok(findButton(sec,'清空模拟语料'));assert.ok(!buttons(sec).some(n=>text(n)==='清空'));
    seedLda(m);approved=false;const before=JSON.stringify(st);await click(findButton(sec,'删除真实语料：第 1 条'));assert.equal(JSON.stringify(st),before);
    approved=true;await click(findButton(sec,'删除真实语料：第 1 条'));assert.equal(m.documents.length,0);assert.equal(m.topics.length,0);assert.equal(undoButtons().length,0);
    assert.match(confirmations.at(-1).message,/旧 LDA 结果将失效.*主题关联将清除/);
    console.log('PASS inventory versus used corpus, Work1 count and confirmed single-document deletion');
  }
  {
    const st=fresh(),w=st.work3;w.scenarios=[{id:'s',name:'华东场景',personaIds:['person']}];w.mining.painMap=[{id:'p',pain:'高成本',scenarioId:'s',linkedNeeds:[]}];
    w.candidates=[{id:'c',name:'低成本',painId:'p',pain:'高成本',evidence:'合成证据',scenarioId:'s',importance:8,desirabilityScores:{},selected:true}];
    approved=false;let before=JSON.stringify(w);await W3.removeScenario(0);assert.equal(JSON.stringify(w),before);
    approved=true;await W3.removeScenario(0);assert.equal(w.mining.painMap[0].scenarioId,'');assert.equal(w.candidates[0].scenarioId,'');assert.equal(w.candidates[0].importance,8);
    approved=false;before=JSON.stringify(w);await W3.removePain(0);assert.equal(JSON.stringify(w),before);
    approved=true;await W3.removePain(0);assert.equal(w.candidates[0].painId,'');assert.equal(w.candidates[0].pain,'高成本');assert.equal(w.candidates[0].evidence,'合成证据');
    w.matrix.manualSelected=['c','other'];w.proposition.coreValueIds=['c','other'];w.migration.analyses=[{candidateId:'c'},{candidateId:'other'}];w._scoreDone=['d:person:c','i:c','d:person:other'];
    approved=false;before=JSON.stringify(w);await W3.removeCandidate(0);assert.equal(JSON.stringify(w),before);
    approved=true;await W3.removeCandidate(0);assert.deepEqual(plain(w.matrix.manualSelected),['other']);assert.deepEqual(plain(w.proposition.coreValueIds),['other']);assert.deepEqual(plain(w._scoreDone),['d:person:other']);assert.equal(w.migration.analyses[0].candidateId,'other');
    console.log('PASS dependent scene/pain/candidate cancellation and exact reference cleanup');
  }
  {
    const st=fresh(),w=st.work3,c={id:'c',name:'合成卖点',importance:5,src_importance:'user',desirabilityScores:{p:{importance:7,uniqueness:6,credibility:5}},feasibility:9,reviewDes:4,reviewImp:9};
    w.candidates=[c];w._scoreDone=['d:p:c','i:c'];w.migration.analyses=[{candidateId:'c'}];
    approved=false;const before=JSON.stringify(w);await W3.removeDimension('desirability',0);assert.equal(JSON.stringify(w),before);
    approved=true;await W3.removeDimension('desirability',0);assert.equal(c.importance,undefined);assert.equal(c.src_importance,undefined);assert.equal(c.desirabilityScores.p.importance,undefined);assert.equal(c.feasibility,9);assert.equal(c.reviewImp,9);assert.equal(c.reviewDes,undefined);
    assert.deepEqual(plain(w._scoreDone),['i:c']);assert.equal(w.migration.analyses.length,0);assert.equal(w.dimensions.desirability.length,2);
    console.log('PASS confirmed dimension deletion removes scores and preserves the other axis');
  }
  {
    const st=fresh(),w=st.work3;w.proposition.alternatives=[{id:'a',text:'已选定主张'},{id:'b',text:'备选主张'}];w.proposition.chosenValueText='已选定主张';w.identity.sloganOptions=['已选口号','备选口号'];w.identity.chosenSlogan='已选口号';
    approved=false;let before=JSON.stringify(w);await W3.removeAlternative(0);await W3.removeSlogan(0);assert.equal(JSON.stringify(w),before);
    approved=true;await W3.removeAlternative(0);await W3.removeSlogan(0);assert.equal(w.proposition.chosenValueText,'');assert.equal(w.identity.chosenSlogan,'');assert.equal(undoButtons().length,0);
    await W3.removeAlternative(0);await W3.removeSlogan(0);assert.equal(undoButtons().length,2);w.proposition.positioning.brand='后续无关编辑';
    await click(undoButtons()[0]);await click(undoButtons()[0]);assert.equal(w.proposition.alternatives[0].id,'b');assert.equal(w.identity.sloganOptions[0],'备选口号');assert.equal(w.proposition.positioning.brand,'后续无关编辑');
    console.log('PASS selected pointers require confirmation; unused options undo independently');
  }
  {
    const st=fresh(),p=st.work4.place,original={id:'partner-a',name:'同名伙伴',side:'线上',notes:'额外字段'};
    p.keyPartners=[original,{id:'partner-b',name:'同名伙伴',side:'线下'},{id:'partner-c',name:'',side:''}];
    let box=W4.partnerBox(()=>p.keyPartners,value=>{p.keyPartners=value;});
    assert.ok(findButton(box,'删除关键伙伴：同名伙伴，第 1 项'));assert.ok(findButton(box,'删除关键伙伴：未命名关键伙伴，第 3 项'));
    await click(findButton(box,'删除关键伙伴：同名伙伴，第 1 项'));
    box=W4.partnerBox(()=>p.keyPartners,value=>{p.keyPartners=value;});
    const input=walk(box).find(n=>n.tagName==='INPUT');input.value='后续新伙伴';input._listeners.keydown[0]({key:'Enter',preventDefault(){}});
    p.keyPartners[0].notes='后续修改';await click(undoButtons()[0]);
    assert.equal(p.keyPartners[0],original);assert.equal(p.keyPartners[0].side,'线上');assert.equal(p.keyPartners[0].notes,'额外字段');assert.equal(p.keyPartners[1].notes,'后续修改');assert.equal(p.keyPartners[3].name,'后续新伙伴');
    assert.equal(JSON.parse(saved).work4.place.keyPartners[0].id,'partner-a');
    console.log('PASS partner undo across remount restores side/id/extra fields and keeps later edits');
  }
  {
    const st=fresh(),p=st.work4.place,a={id:'channel-a',name:'直营',share:42,notes:'原字段'},b={id:'channel-b',name:'经销',share:58};
    p.structure=[{name:'线上',children:[a,b]},{name:'线下',children:[]}];
    let sec=render('place',W4);await click(findButton(sec,'删除二级渠道：直营'));assert.equal(p.structure[0].children.length,1);
    sec=render('place',W4);p.structure[0].children[0].share=60;p.structure[0].children.push({id:'later',name:'后续渠道',share:12});await click(undoButtons()[0]);
    assert.equal(p.structure[0].children[0],a);assert.equal(a.share,42);assert.equal(a.notes,'原字段');assert.equal(p.structure[0].children[1].share,60);assert.equal(p.structure[0].children[2].id,'later');
    const chart=el('div');W4.renderChannelTree(chart,p.structure,p.keyPartners);assert.match(chart.innerHTML,/直营 42%/);
    console.log('PASS channel undo restores original row/share/position and recomputed chart data');
  }
  {
    const st=fresh(),p=st.work4.price,a={id:'row-a',name:'入门',price:20,unit:'CNY',hero:true,notes:'原内容'};p.tiers=[a,{id:'row-b',name:'旗舰',price:50}];
    const cols=[{key:'name',label:'档位名',type:'text'},{key:'price',label:'价格',type:'number'},{key:'hero',label:'主力款',type:'check'}];
    let sec=el('section',{class:'step','data-step':'price'},el('div',{class:'plate'}));W4.simpleTable(sec,p.tiers,cols,'tiers');await click(findButton(sec,'删除价格档位：入门'));
    sec=el('section',{class:'step','data-step':'price'},el('div',{class:'plate'}));W4.simpleTable(sec,p.tiers,cols,'tiers');p.tiers[0].price=55;p.tiers.push({id:'new',name:'后续档位',price:70});await click(undoButtons()[0]);
    assert.equal(p.tiers[0],a);assert.equal(p.tiers[0].unit,'CNY');assert.equal(p.tiers[0].hero,true);assert.equal(p.tiers[1].price,55);assert.equal(p.tiers[2].id,'new');
    console.log('PASS form-row undo preserves all original fields and subsequent edits');
  }
  {
    const st=fresh(),p=st.work4.product;p.aiResult='AI 叙事';p.adoptedSegments={s1:'AI 叙事'};p.name='保留表单';p._aiGenerated=true;
    W4.contextSummary=()=>'';const head=originalHead('product',{short:'产品策略'});approved=false;const before=JSON.stringify(p);await click(findButton(head,'清空正文'));assert.equal(JSON.stringify(p),before);
    approved=true;await click(findButton(head,'清空正文'));assert.equal(p.aiResult,'');assert.equal(p.name,'保留表单');assert.equal(p._aiGenerated,true);assert.match(confirmations.at(-1).message,/表单内容不受影响/);
    console.log('PASS narrative clear is confirmed and leaves form content and generated state intact');
  }
  {
    const st=fresh(),c={id:'c',name:'维度优先',importance:1,desirabilityScores:{p1:{importance:10,uniqueness:8,credibility:4},p2:{importance:10,uniqueness:10,credibility:8}},feasibility:6,communicability:7,sustainability:8};st.work3.candidates=[c];
    const before=JSON.stringify(st.work3),views=W3.ensureDesirabilityAggregates();assert.equal(views[0].importance,1);assert.equal(views[0].uniqueness,9);assert.equal(views[0].credibility,6);assert.equal(W3.computeMatrix()[0].y,16/3);assert.equal(W3.mvo.matrix().checks[0].test(),true);assert.equal(JSON.stringify(st.work3),before);
    c.uniqueness=99;c.src_uniqueness='personas';c.desirabilityScores={p1:{importance:2,uniqueness:3,credibility:4}};assert.equal(W3.desirabilityDimensionValue(c,{key:'uniqueness'}),3);
    c.desirabilityScores={p1:{}};assert.equal(W3.mvo.matrix().checks[0].test(),false);
    c.desirabilityScores={};delete c.importance;delete c.uniqueness;delete c.src_uniqueness;st.work3.context.hasSurvey=true;st.work3.context.personas=[{id:'p1',name:'合成画像',painPoints:[]}];
    await W3._scoreAxis('desirability',{aborted:false,controller:new AbortController()});assert.equal(c.importance,undefined);assert.equal(c.src_importance,undefined);assert.equal(c.desirabilityScores.p1.importance,8);
    st.settings.manualMode=false;sandbox.API.config=()=>({apiKey:'synthetic-key'});
    sandbox.Runner.start=()=>({aborted:false,controller:new AbortController()});sandbox.Runner.finish=()=>{};
    c.importance=1;c.uniqueness=1;c.credibility=1;c.src_importance='user';
    await W3.runDoubleScoring({_regenerate:true},el('div'),{});
    assert.equal(c.importance,undefined);assert.equal(c.src_importance,undefined);assert.equal(W3.computeMatrix()[0].y,6);assert.equal(confirmations.length,0);
    c.importance=2;c.src_importance='user';const failedBefore=JSON.stringify(c);sandbox.API.callJson=async()=>{throw new Error('synthetic failure');};
    await W3.runDoubleScoring({_regenerate:true},el('div'),{});assert.equal(JSON.stringify(c),failedBefore);
    console.log('PASS dimension priority, persona fallback, invalid subscores and scoring pipeline do not write aggregates');
  }
  {
    const labeled=[{text:'真实原文',source:'真实'},{text:'模拟原文',source:'模拟'}];
    const marked=W3.markEvidenceSources([{representative_docs:['真实原文','模拟原文','模型改写']}],labeled);
    assert.deepEqual(plain(marked[0].representative_docs),['[真实] 真实原文','[模拟] 模拟原文','[来源待核对] 模型改写']);
    assert.match(W3.compositionText({real:1,simulated:3}),/真实 1 条（25\.0%）\+ 模拟 3 条（75\.0%）/);
    console.log('PASS evidence provenance and actual corpus percentages');
  }
  I.invalidateUndo();console.log('W3/W4 INTERACTION PASS');
})().catch(error=>{I.invalidateUndo();console.error(error);process.exitCode=1;});
