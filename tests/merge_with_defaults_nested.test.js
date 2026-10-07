/* Global mergeWithDefaults contract: partial saved state must retain nested defaults. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'global-brand-building.html'), 'utf8');
function extractFunction(src, name){
  const start = src.indexOf(`function ${name}(`);
  if(start < 0) throw new Error(`missing function ${name}`);
  const open = src.indexOf('{', start);
  let depth = 0, end = -1;
  for(let i=open; i<src.length; i++){
    if(src[i] === '{') depth++;
    else if(src[i] === '}'){ depth--; if(depth === 0){ end=i+1; break; } }
  }
  if(end < 0) throw new Error(`unterminated function ${name}`);
  return src.slice(start, end);
}
const src = [
  extractFunction(html, 'defaultState'),
  extractFunction(html, 'runSchemaMigrations'),
  extractFunction(html, 'mergeWithDefaults')
].join('\n');

const DEFAULT_SETTINGS = {provider:'p', apiKey:'', baseUrl:'', model:'', temperature:1, backendUrl:'http://localhost:8765'};
const defaultData = () => ({
  sbu:{name:'', threeQuestions:{customer:false,channel:false,brand:false}},
  environment:{basics:{scale:{actual:'',target:'',source:''}, performance:{share:{actual:'',target:'',source:''}}},
               ourCapabilities:{delivery:'',core:''}},
  personas:[], scenarios:[], metrics:{dimensions:[],disclaimerAcknowledged:false,_aiGenerated:false},
  survey:{questions:[],responses:[],n:0,status:'idle',progress:{done:0,total:0},_doneKeys:[]},
  analysis:{likertStats:{},openThemes:[],indicatorMeans:[],insights:''},
  values:{functional:[],chosenFunctional:'',rationale:''},
  recommendations:{short:'',mid:'',long:'',risks:[]}
});
const Work = {defaultData};
const sandbox = {
  console, JSON, Math, Object, Array, String, Number, Boolean, Date,
  DEFAULT_SETTINGS,
  Work1:Work, Work2:Work, Work3:Work, Work4:Work, Work5:Work,
  SchemaMigrate:{run(){ return false; }},
  Store:{save(){}},
  showToast(){},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, {filename:'mergeWithDefaults-extract.js'});

let pass = 0, fail = 0;
const ok = (name, cond, detail) => cond ? (pass++, console.log('PASS ' + name))
  : (fail++, console.log('FAIL ' + name + (detail ? ' — ' + detail : '')));

const merged = sandbox.mergeWithDefaults({
  work1: {
    environment:{political:'saved pest'},
    survey:{questions:[{id:'q1'}]},
    recommendations:{short:'saved short'}
  },
  work2: {framework:{saved:true}}
});
ok('W1 nested defaults survive partial environment', !!(merged.work1.environment.basics && merged.work1.environment.basics.performance && merged.work1.environment.basics.performance.share));
ok('W1 nested defaults survive partial survey', !!(merged.work1.survey.progress && merged.work1.survey.progress.done === 0 && Array.isArray(merged.work1.survey._doneKeys)));
ok('W1 nested defaults survive partial recommendations', Array.isArray(merged.work1.recommendations.risks) && merged.work1.recommendations.mid === '');
ok('saved nested values are preserved', merged.work1.environment.political === 'saved pest' && merged.work1.survey.questions.length === 1 && merged.work1.recommendations.short === 'saved short');
ok('W2 nested defaults survive partial framework', !!merged.work2.framework && merged.work2.framework.saved === true && Array.isArray(merged.work2.personas));

console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
