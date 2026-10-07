/* Work5 STP 聚合不得把空白场景渲染成空 bullet（`· ：`）。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass=0, fail=0;
const ok=(name,cond,detail)=>{ if(cond){pass++;console.log('PASS '+name);} else {fail++;console.log('FAIL '+name+(detail?' — '+detail:''));} };
const makeNode=()=>({children:[],appendChild(c){this.children.push(c);return c;},addEventListener(){},querySelector(){return null;},setAttribute(){},style:{},innerHTML:''});
const sandbox={
  console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,
  document:{createElement:makeNode,createTextNode:s=>({text:String(s),children:[]}),head:{appendChild(){}},getElementById:()=>null,querySelector:()=>null},
  el:(tag,attrs={},...children)=>{const n=makeNode();for(const c of children.flat()){if(c!=null)n.appendChild(typeof c==='object'?c:{text:String(c),children:[]});}return n;},
  esc:s=>String(s??''),uid:p=>'id',autosave(){},showToast(){},confirm:()=>true,
  Work1:{},Work2:{},Work3:{},Work4:{},Work5:{},App:{},Runner:{},API:{},UI:{},AiContext:{},renderMatrix(){}
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','docs','workshop5.js'),'utf8'),sandbox,{filename:'workshop5.js'});
sandbox.state={
  work1:{personas:[]},
  work3:{
    scenarios:[{name:'',description:'',selected:false},{name:'QA场景',description:'可验证描述',selected:true}],
    proposition:{},identity:{}
  }
};
const out=sandbox.Work5.composePositioning();
ok('空白场景不生成空 bullet', !out.segmentation.includes('· ：'), JSON.stringify(out.segmentation));
ok('非空场景仍正常输出', out.segmentation.includes('· QA场景：可验证描述'), JSON.stringify(out.segmentation));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
