/* C: AI 改写必须保持主题句 + 要点/小表结构，不得合并、删除或改数字。 */
'use strict';
const fs=require('fs'), path=require('path'), vm=require('vm');
let pass=0,fail=0;
function ok(n,c,d){if(c){pass++;console.log('PASS '+n);}else{fail++;console.log('FAIL '+n+(d?' — '+d:''));}}
const document={createElement:()=>({appendChild(){},setAttribute(){},style:{}}),head:{appendChild(){}},getElementById:()=>null,querySelector:()=>null};
const calls=[];
const sandbox={console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,document,
 el(){return {appendChild(){return this;}};},esc:s=>String(s??''),autosave(){},showToast(){},confirm:()=>true,state:null,
 Work1:{},Work2:{},Work3:{},Work4:{},Work5:{},App:{},Runner:{start(){return {done:0,aborted:false,controller:{signal:{}}};},renderUI(){},checkpoint(){return Promise.resolve();},finish(){}},
 API:{async call(m){calls.push(m);return sandbox._reply;},async callJson(m){calls.push(m);return sandbox._json||{};}},
 UI:{mountMvo(){},mountMark(){},mountGuard(){return true;},demoNote(){return null;}},AiContext:{buildPrompt:()=>[]},renderMatrix(){}};
sandbox.window=sandbox;vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','..','docs','workshop5.js'),'utf8'),sandbox,{filename:'workshop5.js'});
const W5=sandbox.Work5;W5.rerender=()=>{};
function fresh(){return {meta:{},work1:{},work2:{},work3:{},work4:{},work5:W5.defaultData()};}
function bullets(s){return String(s||'').split(/\r?\n/).filter(x=>/^·\s+/.test(x.trim()));}
async function main(){
  sandbox.state=fresh();
  sandbox.state.work5.ch4_mix={product:'产品主题\n· 原要点一 10%\n· 原要点二 20%',price:'',place:'',promotion:''};
  sandbox._reply='## 合并\n**原要点一 10% 与原要点二 20%**\n# 装饰';
  await W5.aiPolish4P(null);
  const p=sandbox.state.work5.ch4_mix.product;
  ok('aiPolish4P 不合并要点且剥 markdown', bullets(p).length>=2 && !/[#*]/.test(p) && p.includes('10%') && p.includes('20%'), p);

  sandbox.state=fresh();
  sandbox.state.work5.ch4_mix={product:'产品主题\n· 原要点一 10%\n· 原要点二 20%',price:'',place:'',promotion:''};
  sandbox._reply='产品主题\n· 只剩一个要点 10%';
  await W5.aiPolish4P(null);
  ok('aiPolish4P 删除要点时保留原文/治愈', sandbox.state.work5.ch4_mix.product.includes('原要点二') && bullets(sandbox.state.work5.ch4_mix.product).length>=2, sandbox.state.work5.ch4_mix.product);

  sandbox.state=fresh();
  sandbox.state.work5.ch1_business='主题句\n· 原句甲 30%\n· 原句乙 40%';
  sandbox._reply='## 标题\n**原句甲 30% 与原句乙 40%**\n# 不要';
  await W5.aiPolish('ch1_business','业务概况',null);
  const ch=sandbox.state.work5.ch1_business;
  ok('aiPolish 保持要点结构、去装饰、数字不变', bullets(ch).length>=2 && !/[#*]/.test(ch) && ch.includes('30%') && ch.includes('40%'), ch);

  sandbox.state=fresh();
  sandbox.state.work5.ch1_business='主题句\n· 原句甲 30%\n· 原句乙 40%';
  sandbox._reply='主题句\n· 只剩甲 30%';
  await W5.aiPolishAll(null);
  ok('aiPolishAll 删除要点时保留原文/治愈', sandbox.state.work5.ch1_business.includes('原句乙') && bullets(sandbox.state.work5.ch1_business).length>=2, sandbox.state.work5.ch1_business);
  console.log(`\n${pass} pass / ${fail} fail`);
  process.exit(fail===0?0:1);
}
main().catch(e=>{console.error(e);process.exit(1);});
