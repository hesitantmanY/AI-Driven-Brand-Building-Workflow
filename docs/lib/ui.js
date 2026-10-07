/* ============================================================
 UI — 2026-09-01 架构评审候选 4：从 global-brand-building.html 内联脚本抽出。
 依赖均为运行时全局（el / state / saveNow / Archive / App 等），浏览器可用，
 node 测试通过注入对应 stub 直接命中接口。
 ============================================================ */
(function(){
 'use strict';

const UI = {
  // 2026-09-01 候选 4：步骤挂载契约（ADR 0001 语义原样保留）。
  // mountGuard：已渲染 → refreshDynamic 并返回 false；否则返回 true 继续全量重渲染。
  mountGuard(sec, W, id){
    if(!sec) return false;
    const ver = W.RENDER_VERSION || '1';
    if(sec.dataset.rendered === ver){
      if(typeof W.refreshDynamic === 'function') W.refreshDynamic(id);
      return false;
    }
    return true;
  },
  // mountMvo：追加 mvo 卡（W5 单 mvo / W1-4 按步）。位置由调用方决定
  // （原各坊 mvo 行所在），保持既有渲染顺序。
  mountMvo(sec, W, id){
    if(!sec) return;
    const mvoCfg = (typeof W.mvo === 'function')
      ? W.mvo()
      : (W.mvo && W.mvo[id] ? W.mvo[id]() : null);
    if(mvoCfg) sec.appendChild(UI.mvoCard(mvoCfg, sec));
  },
  // mountMark：渲染完成后标记（放原 rendered= 行位置，保留错误语义）。
  mountMark(sec, W){
    if(!sec) return;
    sec.dataset.rendered = W.RENDER_VERSION || '1';
  },
  stepHeader(num, title, subtitle){
    return el('div',{class:'step-header'},
      el('span',{class:'step-number'}, num),
      el('h2',{}, title+(title.endsWith('.')?'':'.')),
      subtitle && el('p',{class:'muted', html: latinize(subtitle)})
    );
  },
  label(text){ return el('label',{},text); },
  field(labelText, ...children){
    const f=el('div',{class:'field'});
    if(labelText) f.appendChild(this.label(labelText));
    children.flat().forEach(c=>f.appendChild(c));
    return f;
  },
  tagsInput(initial=[], placeholder='输入后回车添加', onChange=null){
    const wrap=el('div',{class:'chip-row'});
    const input=el('input',{type:'text',placeholder});
    let items=typeof initial==='function'?null:[...initial];
    const get=()=>typeof initial==='function'?initial():items;
    let owner=null;
    const sync=()=>{ if(typeof onChange==='function') onChange(get().slice()); };
    const changed=()=>{
      sync();
      if(wrap.isConnected===false && owner){
        const mod=window['Work'+owner.work];
        if(mod?.rerender)mod.rerender(owner.step);
      }else render();
    };
    function render(){
      wrap.innerHTML='';
      get().forEach((t,i)=>{
        const chip=el('span',{class:'chip'}, t,
          el('button',Interaction.deleteButton({onclick:e=>{
            const step=wrap.closest('.step'),work=wrap.closest('.workshop');
            if(step&&work)owner={work:work.dataset.workshop,step:step.dataset.step};
            return Interaction.removeItem({list:get,index:i,type:'标签',name:t,trigger:e.currentTarget,onChange:changed});
          }},'标签',t,i,get), '×')
        );
        wrap.appendChild(chip);
      });
      wrap.appendChild(input);
    }
    input.addEventListener('keydown', e=>{
      if(e.key==='Enter' && input.value.trim()){
        e.preventDefault();
        get().push(input.value.trim()); input.value=''; changed();
      }
    });
    render();
    return { el:wrap, get:()=>get().slice(), set:arr=>{
      if(typeof initial==='function')get().splice(0,get().length,...arr);else items=[...arr];
      changed();
    } };
  },
  bar(value, max=100, label){
    const w=clamp(Number(value)||0,0,max)/max*100;
    return el('div',{},
      label && el('div',{style:{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-mono)','font-size':'11px'}},
        el('span',{},label), el('span',{},Number(value).toFixed(1))),
      el('div',{style:{height:'4px',background:'var(--maroon-soft)',marginTop:'4px'}},
        el('div',{style:{height:'100%',background:'var(--color-accent)',width:w+'%'}}))
    );
  },
  // 跨工作坊闭环 CTA（2026-08-27 grilling 共识）：工作坊 1-4 的末步 mvo 全过后
  // 显示「罗马数字 + 工作坊名 →」，点击 App.goWork 进入下一工作坊首步。
  // data-gated + _gate：mvoCard.refresh 活体同步显隐（2026-08-28）。
  NEXT_WORK_LABEL:{1:'II. 目标市场',2:'III. 价值主张',3:'IV. 营销组合',4:'V. 策划书'},
  nextWorkCta(n, id){
    const label=this.NEXT_WORK_LABEL[n]; if(!label) return null;
    const mod={1:Work1,2:Work2,3:Work3,4:Work4}[n]; if(!mod) return null;
    if(id!==mod.steps[mod.steps.length-1].id) return null;
    const mvo=mod.mvo && mod.mvo[id]; if(!mvo) return null;
    const cta=el('div',{class:'metric-next','data-gated':''});
    cta._gate=()=>mvo().checks.every(c=>c.test());
    if(!cta._gate()) cta.classList.add('metric-next--hidden');
    cta.appendChild(el('button',{class:'primary small',onclick:()=>{ if(typeof App!=='undefined'&&App.goWork) App.goWork(n+1); }},label+' →'));
    return cta;
  },
  // 步间跳转 CTA（2026-08-28 grilling 共识）：本步 mvo 全过后在底部显示
  // 「下一步：目标步标题 →」，点击 App.goStep 进入下一 step。末步无下游不显示
  // （出口由跨坊 CTA 承担）。与 nextWorkCta 同用 data-gated/_gate 活体同步。
  stepNextCta(n, id){
    const mod={1:Work1,2:Work2,3:Work3,4:Work4}[n]; if(!mod) return null;
    const target=mod.NEXT_STEPS && mod.NEXT_STEPS[id];
    if(!target) return null;
    const mvo=mod.mvo && mod.mvo[id]; if(!mvo) return null;
    const label=(mod.titles && mod.titles[target]||'').replace(/\s*[（(].*?[）)]\s*/g,'');
    const cta=el('div',{class:'metric-next','data-gated':''});
    cta._gate=()=>mvo().checks.every(c=>c.test());
    if(!cta._gate()) cta.classList.add('metric-next--hidden');
    cta.appendChild(el('button',{class:'primary small',onclick:()=>{ if(typeof App!=='undefined'&&App.goStep) App.goStep(target); }},'下一步：'+label+' →'));
    return cta;
  },
  // 活体同步步区内所有门控 CTA 的显隐（由 mvoCard.refresh 调用）。
  syncCtas(sec){
    if(!sec) return;
    sec.querySelectorAll('.metric-next[data-gated]').forEach(cta=>{
      let ok=false; try{ ok=!!(cta._gate && cta._gate()); }catch(_){ ok=false; }
      cta.classList.toggle('metric-next--hidden', !ok);
    });
  },
  // Minimum-viable-output card. cfg: {checks:[{label,test:()=>bool}], note}
  // Live-rebinds to sec's input/change so it tracks the user as they type.
  mvoCard(cfg, sec){
    const checks = cfg.checks || [];
    const dots = checks.map(c=>{
      const row=el('div',{class:'mvo-check'},
        el('span',{class:'mvo-dot'}, '✓'),
        el('span',{class:'mvo-label'}, c.label));
      return {row, test:c.test};
    });
    const progress=el('span',{class:'mvo-progress'}, '');
    const toggle=el('span',{class:'mvo-toggle'}, '收起');
    const body=el('div',{class:'mvo-card-body'},
      ...dots.map(d=>d.row),
      cfg.note && el('div',{class:'mvo-note'}, cfg.note));
    const card=el('div',{class:'mvo-card'},
      el('div',{class:'mvo-card-head',onclick:()=>card.classList.toggle('collapsed')},
        el('span',{},'本步流程 · 最小可交付'), progress, toggle),
      body);
    const flowHint=el('div',{class:'mvo-flow-hint'},'先完成下面的检查项；全部完成后，底部会出现下一步入口。');
    if(typeof body.insertBefore==='function') body.insertBefore(flowHint, body.firstChild);
    else body.appendChild(flowHint);
    function refresh(){
      let n=0;
      dots.forEach(d=>{
        let done=false; try{ done=!!d.test(); }catch(_){ done=false; }
        d.row.classList.toggle('done', done);
        if(done) n++;
      });
      progress.textContent=n+'/'+checks.length;
      const allDone=n===checks.length;
      // 案例（演示）模式下不自动折叠——让用户能看到完整的演示内容。
      // BIZ02：isDemo 全库无 true 写入者，真实案例标记是 meta.demoCase。
      const inDemo = typeof state!=='undefined' && state && state.meta && !!state.meta.demoCase;
      if(allDone && !card.dataset.wasDone && !inDemo){ card.classList.add('collapsed'); }
      card.dataset.wasDone=allDone?'1':'0';
      toggle.textContent=card.classList.contains('collapsed')?'展开':'收起';
      // 2026-08-28：mvo 变化同步驱动步间/跨坊 CTA 显隐（输入最后一项即出现按钮）。
      if(typeof UI!=='undefined' && UI.syncCtas) UI.syncCtas(sec);
    }
    card._refreshMvo=refresh;
    if(sec){
      sec.addEventListener('input', refresh);
      sec.addEventListener('change', refresh);
    }
    refresh();
    return card;
  },
};

 if(typeof window!=='undefined') window.UI = UI;
 if(typeof module!=='undefined' && module.exports) module.exports = UI;
})();
