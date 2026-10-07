/* AC-W45-E: case mode must lock the export menu and both export actions. */
'use strict';
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const btn = {
  disabled:false, title:'', clicks:0,
  setAttribute(k,v){ this[k] = v; },
  addEventListener(){},
  click(){ this.clicks++; }
};
const popup = { classList: { toggle(){ return true; }, remove(){}, contains(){ return false; } } };
const printList = { innerHTML:'untouched' };
const printGo = { disabled:true };
global.document = {
  body:{ classList:{ contains(){ return true; } } },
  getElementById(id){
    if(id === 'exportBtn') return btn;
    if(id === 'exportMenuPopup') return popup;
    if(id === 'printPickList') return printList;
    if(id === 'printGoBtn') return printGo;
    return null;
  },
  querySelector(){ return null; },
  addEventListener(){}
};
global.state = { meta:{isDemo:true, demoCase:'douya-mama'} };
let exportMdCalls = 0;
global.App = { exportMd(){ exportMdCalls++; } };
const ExportMenu = require(path.join(root, 'docs', 'lib', 'export_menu.js'));

let pass = 0, fail = 0;
function ok(name, cond, detail){
  if(cond){ pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
ExportMenu.sync();
ok('案例模式导出按钮 disabled + 明确提示', btn.disabled === true && btn.title === '案例模式不可导出 / 打印' && btn['aria-disabled'] === 'true',
  JSON.stringify({disabled:btn.disabled,title:btn.title,aria:btn['aria-disabled']}));
ExportMenu.toggle();
ok('案例模式点击导出不打开菜单', btn.clicks === 0, 'clicks=' + btn.clicks);
ExportMenu.md();
ok('案例模式导出 Markdown 被拦截', exportMdCalls === 0, 'exportMdCalls=' + exportMdCalls);
ExportMenu.openPrint();
ok('案例模式导出 PDF 面板不打开', printList.innerHTML === 'untouched', printList.innerHTML);
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
