'use strict';
const assert=require('node:assert/strict');
const Interaction=require('../docs/lib/interaction.js');
const fresh=()=>({meta:{},work1:{name:'起点'},work2:{},work3:{},work4:{},work5:{}});
global.state=fresh();global.autosave=()=>{};global.showToast=()=>{};
global.saveNow=async()=>true;global.Archive={create:async()=>({id:'named_合成',name:'合成'})};
const ids=[];
const offer=Interaction.offerUndo.bind(Interaction);
Interaction.offerUndo=opts=>{const id=offer(opts);ids.push(id);return id;};

(async()=>{
  // Three independent undo records restore order without replacing current objects.
  const a={id:'a',name:'A',side:'线上'},b={id:'b',name:'B',pct:35},c={id:'c',name:'C'},d={id:'d',name:'D'};
  state.work4.list=[a,b,c,d];
  let changes=0;
  for(let n=0;n<3;n++)await Interaction.removeItem({list:()=>state.work4.list,index:0,type:'伙伴',name:state.work4.list[0].name,onChange:()=>changes++});
  d.name='后续编辑';state.work4.list.push({id:'new',name:'后续新项'});
  Interaction.undo(ids[2]);Interaction.undo(ids[0]);Interaction.undo(ids[1]);
  assert.deepEqual(state.work4.list.map(x=>x.id),['a','b','c','d','new']);
  assert.equal(state.work4.list[0],a);assert.equal(a.side,'线上');assert.equal(b.pct,35);assert.equal(d.name,'后续编辑');assert.equal(changes,6);
  console.log('PASS independent undo preserves identity, position, side, percent and later edits');

  for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
    Interaction.invalidateUndo();
    state.work4.list=[a,b,c];const offset=ids.length;
    for(let n=0;n<3;n++)await Interaction.removeItem({
      list:()=>state.work4.list,index:0,type:'伙伴',name:state.work4.list[0].name,
      onChange:()=>{state.work4.list=state.work4.list.slice();}
    });
    state.work4.list.push({id:'new',name:'后续新项'});
    for(const n of order)assert.equal(Interaction.undo(ids[offset+n]),true);
    assert.deepEqual(state.work4.list.map(x=>x.id),['a','b','c','new']);
  }
  console.log('PASS deleting the entire list and all six undo orders preserves original order with copied arrays and new rows');

  Interaction.invalidateUndo();state.work4.list=['同名','同名','第三个'];
  const duplicateOffset=ids.length;
  for(let n=0;n<3;n++)await Interaction.removeItem({list:()=>state.work4.list,index:0,type:'标签',name:state.work4.list[0]});
  state.work4.list.push('新标签');
  Interaction.undo(ids[duplicateOffset+1]);Interaction.undo(ids[duplicateOffset]);Interaction.undo(ids[duplicateOffset+2]);
  assert.deepEqual(state.work4.list,['同名','同名','第三个','新标签']);
  console.log('PASS independent duplicate primitive tags retain unique transient positions');

  state.work4.list=[a,b,c,d];

  await Interaction.removeItem({list:()=>state.work4.list,index:0,type:'伙伴',name:'A'});
  const oldId=ids.at(-1);Interaction.invalidateUndo();
  assert.equal(Interaction.undo(oldId),false);assert.equal(state.work4.list[0].id,'b');
  console.log('PASS workspace replacement invalidates prior undo');

  let asked=0;
  Interaction.confirm=async()=>{asked++;return false;};
  const before=JSON.stringify(state);
  await Interaction.removeItem({list:()=>state.work4.list,index:0,type:'指标',name:'B',impact:'评分和权重将失效。'});
  assert.equal(asked,1);assert.equal(JSON.stringify(state),before);
  console.log('PASS dependency confirmation cancellation leaves data untouched');

  for(const failure of ['false','throw','archive','metadata']){
    state=fresh();let applied=0,archived=0,stage='';
    saveNow=async()=>{if(failure==='throw')throw Error('合成保存异常');return failure!=='false';};
    Archive.create=async()=>{archived++;if(failure==='archive')throw Error('合成版本失败');return failure==='metadata'?{}:{id:'time_1',name:'时间1'};};
    const original=JSON.stringify(state);
    const result=await Interaction.runProtected({key:'failure-'+failure,apply:()=>{applied++;state.work1.name='覆盖';},onFailure:e=>{stage=e.stage;}});
    assert.equal(result,false);assert.equal(applied,0);assert.equal(JSON.stringify(state),original);
    assert.equal(stage,['false','throw'].includes(failure)?'保存当前内容':'创建覆盖前版本');
    if(['false','throw'].includes(failure))assert.equal(archived,0);
  }
  console.log('PASS save false/exception, archive failure and invalid metadata all stop overwrite');

  state=fresh();let archived=0;
  saveNow=async()=>true;
  Archive.create=async()=>{archived++;if(archived===1)state.work1.name='存档期间新增';return {id:'time_'+archived,name:'时间'+archived};};
  let savedInput='';
  const result=await Interaction.runProtected({key:'fresh-input',apply:()=>{savedInput=state.work1.name;state.work2.updated=true;}});
  assert.equal(result,true);assert.equal(archived,2);assert.equal(savedInput,'存档期间新增');
  console.log('PASS changes during archival are saved and archived again before overwrite');

  state=fresh();let saves=0,lastFailure;
  saveNow=async()=>++saves===1;
  Archive.create=async()=>({id:'time_post',name:'覆盖前版本'});
  await Interaction.runProtected({key:'post-save',apply:()=>{state.work1.name='已覆盖';},onFailure:e=>{lastFailure=e;}});
  assert.equal(state.work1.name,'已覆盖');assert.equal(lastFailure.applied,true);assert.match(lastFailure.message,/内容已更新但未保存/);
  saveNow=async()=>true;assert.equal(await Interaction.retrySave('post-save'),true);
  console.log('PASS post-overwrite failure retains updated content and can retry saving');
  Interaction.invalidateUndo();
  console.log('interaction policy: all checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
