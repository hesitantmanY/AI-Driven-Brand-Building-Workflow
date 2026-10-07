/* ============================================================
 Cases — global case loader.
 Loaded after all WorkN modules and their defaultData() are defined.

 Public API (window.Cases):
 list() — [{brand,label,summary}]
 has(brand) — boolean
 load(brand) — full 5-work state object
 load(brand, {works:[...]}) — partial state, rest = WorkN.defaultData()

 The case file layout is documented in docs/cases/SCHEMA.md.
 ============================================================ */
(function(){
 'use strict';

 // Registered cases. To add a new case, drop a folder under docs/cases/<brand>/
 // and add a `__case_<brand>` window global in its index.js. Then add the
 // brand key here.
 const CASES = {
 'douya-mama': {
 get module(){ return typeof window!=='undefined'? window.__case_douya_mama: null; }
 },
 'xiaohuo-ji': {
 get module(){ return typeof window!=='undefined'? window.__case_xiaohuo_ji: null; }
 },
 'wenqu-shuyuan': {
 get module(){ return typeof window!=='undefined'? window.__case_wenqu_shuyuan: null; }
 },
 'hengrui-zao': {
 get module(){ return typeof window!=='undefined'? window.__case_hengrui_zao: null; }
 },
 'maohaizi-house': {
 get module(){ return typeof window!=='undefined'? window.__case_maohaizi_house: null; }
 }
 };

 function brandKeys(){
 return Object.keys(CASES).filter(b => CASES[b].module!= null);
 }

 function list(){
 return brandKeys().map(b => {
 const m = CASES[b].module;
 return { brand: m.brand, label: m.label, summary: m.summary };
 });
 }

 function has(brand){
 return brandKeys().includes(brand);
 }

 // Deep-merge: case values win, but missing fields fall back to default.
 // Arrays are replaced (not concatenated) — case arrays are intentional.
 function cloneValue(value){
 if(Array.isArray(value)) return value.map(cloneValue);
 if(value && typeof value === 'object') return deepMerge({}, value);
 return value;
 }
 function deepMerge(defaults, override){
 if(override == null) return cloneValue(defaults);
 if(defaults == null) return cloneValue(override);
 if(typeof defaults!== 'object' || Array.isArray(defaults)!== Array.isArray(override) ||
 typeof defaults!== typeof override) return cloneValue(override);
 if(Array.isArray(defaults)) return cloneValue(override);
 const out = {};
 const keys = new Set([...Object.keys(defaults),...Object.keys(override)]);
 for(const k of keys){
 if(k in override) out[k] = deepMerge(defaults[k], override[k]);
 else out[k] = cloneValue(defaults[k]);
 }
 return out;
 }

 function defaultsFor(workKey){
 // workKey like 'work1' → Work1.defaultData()
 const W = (typeof window!== 'undefined')? window: null;
 if(!W) return {};
 const n = workKey.replace('work','');
 const w = W['Work' + n];
 if(w && typeof w.defaultData === 'function') return w.defaultData();
 return {};
 }

 function load(brand, opts){
 opts = opts || {};
 if(!has(brand)) throw new Error('Cases.load: unknown brand "' + brand + '"');
 const m = CASES[brand].module;
 const full = m.getState();
 const allWorks = ['work1','work2','work3','work4','work5'];
 const wanted = Array.isArray(opts.works) ? opts.works : allWorks;
 const out = {};
 for(const wk of allWorks){
 const fallback = defaultsFor(wk);
 out[wk] = wanted.includes(wk)? deepMerge(fallback, full[wk]): fallback;
 }
 // 案例源数据也必须满足当前 Work4 结构契约（线上/线下两组、伙伴 side 标准化）。
 if(out.work4 && typeof window !== 'undefined' && window.Work4 && Array.isArray(window.Work4.migrations)){
 window.Work4.migrations.forEach(migrate => { try{ migrate(out); }catch(_){} });
 }
 return out;
 }

 const Cases = { list, has, load };
 if(typeof window!== 'undefined') window.Cases = Cases;
 if(typeof module!== 'undefined' && module.exports) module.exports = Cases;
})();
