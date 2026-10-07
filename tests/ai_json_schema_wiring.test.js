/* AI JSON contract wiring: API.callJson must pass caller-provided schema into CallJsonStrict. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass=0, fail=0;
const ok=(name,cond,detail)=>{if(cond){pass++;console.log('PASS '+name)}else{fail++;console.log('FAIL '+name+(detail?' — '+detail:''))}};
const html=fs.readFileSync(path.join(__dirname,'..','docs','global-brand-building.html'),'utf8');
const start=html.indexOf('const API = {');
const end=html.indexOf('\n};', start);
if(start<0||end<0) throw new Error('API block not found');
const apiSrc=html.slice(start,end+3)+'\nthis.__API=API;';
let captured=null;
const sandbox={
  console,setTimeout,clearTimeout,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,
  state:{meta:{isDemo:false},settings:{api:{provider:'deepseek',model:'m',apiKey:'k'}}},
  Providers:{getMode:()=> 'openai_response_format'},
  CallJsonStrict:{run:async opts=>{captured=opts;return {ok:true,data:{answers:[]}}}},
  JsonExtract:{lastError:null},
  Runner:{start:()=>({controller:{signal:null},aborted:false}),finish(){}},
  fetch:async()=>({ok:true,json:async()=>({_text:'{}'})}),
  apiUrl:p=>'http://test'+p,
  el:()=>({appendChild(){},addEventListener(){}}),
  showToast(){}
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(apiSrc,sandbox,{filename:'global-brand-building.html#API'});
const schema={type:'object',required:['answers'],fields:{answers:{type:'array'}}};
(async()=>{
  await sandbox.__API.callJson([{role:'user',content:'x'}],{schema});
  ok('API.callJson forwards schema to CallJsonStrict', captured && captured.schema===schema, JSON.stringify(captured&&captured.schema));
  ok('API.callJson preserves schema object identity', captured && captured.schema===schema);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
