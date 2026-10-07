/* Archive top-bar/row regressions, updated for the explicit editor in A03/A15.
   Run: node tests/audit/w345/history_rename_delete.test.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {fixture,settle}=require('../../archive_interaction.test.js');

async function main(){
  const f=fixture();
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../../docs/lib/app.js'),'utf8'),f.context,{filename:'app.js'});
  f.context.App.updateArchiveLabel();
  const top=f.$('#archiveRenameBtn');
  assert.equal(typeof top.onclick,'function');
  assert.equal(top.hidden,false);
  top.onclick(); await settle();
  assert(f.$('#historyModal').classList.contains('open'));
  const input=f.row().querySelector('.snap-rename');
  assert(input);
  assert(f.action('rename-save'));
  assert(f.action('rename-cancel'));
  assert.equal(f.calls.filter(call=>call.method==='rename').length,0);
  console.log('PASS top-bar rename opens a visible explicit editor before any write');

  input.value='终版';
  await input.emit('keydown',{key:'Enter'});
  assert.equal(f.calls.filter(call=>call.method==='rename').length,1);
  assert.equal(f.context.state.meta.loadedFromId,'named_终版');
  assert.equal(f.context.state.meta.loadedFrom,'终版');
  assert.equal(f.$('#archiveLabelText').textContent,'当前：终版');
  console.log('PASS rename tracks the returned source id and name in the top bar');

  f.confirmValue=true;
  await f.History.del('named_终版');
  assert.equal(f.context.state.meta.loadedFromId,null);
  assert.equal(f.context.state.meta.loadedFrom,null);
  assert.equal(f.$('#archiveLabel').hidden,true);
  assert.equal(f.context.state.work1.marker,'live changes');
  console.log('PASS deleting current source removes its label and preserves live content');
  console.log('\n3 archive source regressions passed');
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
