/* ============================================================
 Runner — 全局单任务锁：AI 任务的暂停/中止/进度。

 浏览器依赖（运行时解析）：el / showToast / state / document / AbortController。
 node 测试用 button:null 即可测状态机，不触碰 DOM。

 按钮语义（pausable）：任务期间 Runner 独占按钮——生成中点主体暂停，已暂停点主体中止，
 「中止」是独立控件（内嵌 span 或外置 × 按钮）。调用方原有的启动监听器
 在任务期间由父节点捕获守卫吞掉，不会与暂停/中止双重触发。
 原按钮因导航或重绘不可见时，body 上的备用控件保留同一任务的暂停/中止入口。

 Public API（window.Runner）：
   start({id,label,button,total,pausable,onPause,onResume}) → task | null
   togglePause() / abort() / checkpoint() / tick(n) / setTotal(n)
   signal() / finish() / renderUI()
 ============================================================ */
(function(){
  'use strict';

  function restoreButton(button, text){
    button.disabled=false;
    if(text!=null) button.textContent=text;
  }

  const Runner = {
    current: null,
    // Returns a task handle, or null if another task is running.
    start({id, label, button, total=0, pausable=false, onPause, onResume}){
      const currentState = (typeof state !== 'undefined' && state) || (typeof window !== 'undefined' && window.state) || null;
      if(currentState && currentState.meta && (currentState.meta.isDemo || currentState.meta.demoCase)){
        if(typeof showToast!=='undefined') showToast('案例浏览中，不可用 AI');
        return null;
      }
      if(this.current && !this.current._finished){
        if(typeof showToast!=='undefined') showToast('已有 AI 任务进行中，请先中止当前任务');
        return null;
      }
      const task={
        id, label, button, total, pausable, onPause, onResume,
        controller: new AbortController(),
        status:'running', paused:false, aborted:false, done:0,
        _resume:null, _origText:'', _origHTML:null,
        _abortBtn:null, _bar:null, _tick:null, _timeEl:null, _titleEl:null,
        _inlineAbort:null, _guardHost:null, _guard:null, _finished:false
      };
      if(button){
        button.setAttribute?.('data-ai-task','true');
        task._origText=button.textContent;
        task._origHTML=button.innerHTML;
        const ab=el('button',{class:'abort-btn',type:'button',title:'中止 AI 任务：'+label,'aria-label':'中止 AI 任务：'+label,
          onclick:()=>this.abort()},'×');
        const inlineProgress = button.classList.contains('ai-draft-btn') || button.classList.contains('primary');
        if(inlineProgress){
          button.classList.add('running');
          button.innerHTML='';
          const time=el('span',{class:'ai-draft-state-time'},'已用 0s');
          task._timeEl=time;
          const abSpan=el('span',{class:'abort-inline',role:'button',tabindex:0,title:'中止 AI 任务：'+label,'aria-label':'中止 AI 任务：'+label,
            onclick:e=>{ e.stopPropagation(); this.abort(); },
            onkeydown:e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); e.stopPropagation(); this.abort(); } }},'中止');
          task._inlineAbort=abSpan;
          const title=el('span',{class:'ai-draft-title'},'生成中 · '+label+'…');
          task._titleEl=title;
          button.appendChild(el('span',{class:'ai-draft-row'},
            title,
            el('span',{class:'ai-draft-right'}, time, abSpan)
          ));
          button.appendChild(el('span',{class:'ai-draft-progress'},
            el('span',{class:'ai-draft-progress-fill indeterminate'})));
          task._elapsed=0;
          task._tick=setInterval(()=>{
            task._elapsed++;
            if(task._timeEl) task._timeEl.textContent='已用 '+task._elapsed+'s';
          },1000);
        }else{
          button.insertAdjacentElement('afterend', ab);
          task._abortBtn=ab;
          const bar=el('div',{class:'runner-bar'},
            el('div',{class:'runner-bar-track'}, el('div',{class:'runner-bar-fill'})),
            el('span',{class:'runner-bar-text'}, label)
          );
          ab.insertAdjacentElement('afterend', bar);
          task._bar=bar;
          if(!pausable) button.disabled=true;
        }
        // 任务期间独占按钮：调用方的启动监听器（el 的 on* 也走
        // addEventListener）注册得更早，同元素拦截器排序在它之后、无法阻止，
        // 所以挂在父节点的捕获阶段——拦住业务启动器，点内嵌「中止」放行。
        const host=button.parentNode;
        if(host){
          const guard=(e)=>{
            if(!button.contains(e.target)) return;
            if(task._inlineAbort && task._inlineAbort.contains(e.target)) return;
            e.preventDefault(); e.stopPropagation();
            if(typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation();
            if(task.pausable && !task.aborted) this.togglePause();
            else if(!task.aborted) this.abort();
          };
          host.addEventListener('click', guard, true);
          task._guardHost=host; task._guard=guard;
        }
      }
      this.current=task;
      this.renderUI();
      this.observeTaskDOM();
      return task;
    },
    togglePause(){
      const t=this.current; if(!t||!t.pausable||t.aborted) return;
      // 暂停后唯一出口是中止；后续普通生成通过已完成单元补缺。
      if(t.paused){
        this.abort();return;
      }else{
        t.paused=true; t.status='paused';
        if(t.onPause){ try{ t.onPause(); }catch{} }
      }
      this.renderUI();
    },
    abort(){
      const t=this.current; if(!t||t.aborted) return;
      t.aborted=true; t.status='aborting';
      try{ t.controller.abort(); }catch{}
      if(t._resume){ t._resume(); t._resume=null; }
      this.renderUI();
    },
    // Await between units: blocks while paused, throws if aborted.
    async checkpoint(){
      const t=this.current; if(!t) return;
      if(t.aborted) throw new DOMException('Aborted','AbortError');
      if(t.paused){
        await new Promise(res=>{ t._resume=res; });
        if(t.aborted) throw new DOMException('Aborted','AbortError');
      }
    },
    tick(n=1){ const t=this.current; if(t){ t.done+=n; this.renderUI(); } },
    setTotal(n){ const t=this.current; if(t){ t.total=n; this.renderUI(); } },
    signal(){ return this.current ? this.current.controller.signal : undefined; },
    finish(){
      const t=this.current; if(!t) return;
      if(this._domObserver){this._domObserver.disconnect();this._domObserver=null;}
      t._finished=true;
      if(t._tick){ clearInterval(t._tick); t._tick=null; }
      if(t.button){
        restoreButton(t.button, t._origText);
        if(t._origHTML!=null){ t.button.innerHTML=t._origHTML; t.button.classList.remove('running','paused'); }
        if(t._guard){ t._guardHost.removeEventListener('click', t._guard, true); t._guard=t._guardHost=null; }
      }
      if(t._abortBtn){ t._abortBtn.remove(); t._abortBtn=null; }
      if(t._bar){ t._bar.remove(); t._bar=null; }
      this.current=null;
      this.renderUI();
    },
    isAiButton(button){
      if(button.getAttribute?.('data-ai-task')==='true' || button.classList?.contains('ai-draft-btn'))return true;
      const label=String(button.textContent||'').trim();
      return /^(?:AI(?:\s|[\u4e00-\u9fff]|$)|重新(?:生成|推导)|用\s*AI|让\s*AI|一键生成|生成模拟语料|运行 LDA|(?:运行|补全|继续).*合成调研|(?:运行|补全|继续).*persona.*赋权)/.test(label);
    },
    buttonVisible(button){
      if(!button || button.isConnected===false)return false;
      if(typeof button.getClientRects==='function')return button.getClientRects().length>0;
      // Minimal DOM environments do not expose layout. Browser layout above also
      // detects hidden workshop/step ancestors and detached remounts.
      for(let n=button;n;n=n.parentNode){
        if(n.hidden || n.style?.display==='none')return false;
        if((n.classList?.contains('workshop') || n.classList?.contains('step')) && !n.classList.contains('active'))return false;
      }
      return true;
    },
    observeTaskDOM(){
      if(typeof MutationObserver==='undefined' || typeof document==='undefined' || !document.body)return;
      if(this._domObserver)this._domObserver.disconnect();
      this._domObserver=new MutationObserver(records=>{
        const t=this.current;if(!t)return;
        const changed=this.buttonVisible(t.button)!==t._buttonVisible;
        const newEntry=records.some(record=>Array.from(record.addedNodes||[]).some(node=>{
          const buttons=node.tagName==='BUTTON'?[node]:Array.from(node.querySelectorAll?.('button')||[]);
          return buttons.some(b=>b!==t.button && !b.getAttribute?.('data-runner-control') && this.isAiButton(b) && !b.disabled);
        }));
        // Do not rerender for our own status text/class updates, which would
        // otherwise enqueue another observer callback indefinitely.
        if(changed || newEntry)this.renderUI();
      });
      this._domObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
    },
    renderGlobalControl(t){
      if(typeof document==='undefined' || !document.body?.appendChild || typeof el==='undefined')return;
      if(!t){
        if(this._globalControl)this._globalControl.root.remove();
        this._globalControl=null;return;
      }
      const visible=this.buttonVisible(t.button);
      t._buttonVisible=visible;
      if(!this._globalControl && !visible){
        const status=el('span',{role:'status','aria-live':'polite','aria-atomic':'true',style:{flex:'1',minWidth:'140px'}});
        const action=el('button',{type:'button','data-runner-control':'true',onclick:()=>{
          const active=this.current;if(!active || active.aborted)return;
          if(active.pausable)this.togglePause();else this.abort();
        }});
        const abort=el('button',{type:'button',class:'danger','data-runner-control':'true',onclick:()=>this.abort()},'中止');
        const root=el('div',{id:'globalAiTaskControl',class:'no-print',role:'region','aria-label':'AI 任务控制',style:{
          position:'fixed',left:'16px',bottom:'16px',zIndex:'2050',display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px 12px',
          maxWidth:'min(440px, calc(100vw - 32px))',padding:'12px 16px',boxSizing:'border-box',
          background:'var(--color-paper)',color:'var(--color-ink)',border:'1px solid var(--color-ink)',font:'13px/1.6 var(--font-mono)'
        }},status,action,abort);
        document.body.appendChild(root);this._globalControl={root,status,action,abort};
      }
      const ui=this._globalControl;if(!ui)return;
      ui.root.hidden=visible;
      const phase=t.aborted?'正在中止':t.paused?'已暂停':'生成中';
      ui.status.textContent=t.label+' · '+phase+(t.total?' · '+t.done+'/'+t.total:'');
      ui.action.textContent=t.aborted?'中止中…':t.pausable&&!t.paused?'暂停':'中止';
      ui.action.disabled=!!t.aborted;
      ui.action.classList.toggle('danger',!t.pausable || t.paused || t.aborted);
      ui.action.classList.toggle('ghost',t.pausable && !t.paused && !t.aborted);
      ui.action.setAttribute('aria-label',ui.action.textContent+' AI 任务：'+t.label);
      ui.abort.hidden=!t.pausable || t.paused || t.aborted;
      ui.abort.setAttribute('aria-label','中止 AI 任务：'+t.label);
    },
    renderUI(){
      const t=this.current;
      const st = (typeof window!=='undefined' && window.state) || (typeof state!=='undefined' ? state : null);
      const locked=!!(st && st.meta && (st.meta.isDemo || st.meta.demoCase));
      if(typeof document!=='undefined'){
        this.renderGlobalControl(t);
        const sw=document.getElementById('modeSwitch');
        const hasKey=typeof Settings!=='undefined' && Settings.hasKey ? Settings.hasKey() : !!st?.settings?.api?.apiKey;
        if(sw) sw.querySelectorAll('button').forEach(b=>b.disabled=!!t||locked || ((b.dataset?.mode || b.getAttribute?.('data-mode'))==='api' && !hasKey));
        const gear=document.getElementById('settingsGear');
        if(gear) gear.disabled=!!t; // 案例中 API 设定仍是管理控件。
        this._blockedButtons=this._blockedButtons||new Map();
        if(!t){
          this._blockedButtons.forEach((old,b)=>{
            b.disabled=old.disabled;
            if(b.setAttribute)b.setAttribute('title',old.title);
          });
          this._blockedButtons.clear();
          if(typeof App!=='undefined' && App.syncCaseLock)App.syncCaseLock();
        }else if(document.querySelectorAll){
          document.querySelectorAll('button').forEach(b=>{
            if(b===t.button)return;
            if(!this.isAiButton(b))return;
            if(!this._blockedButtons.has(b))this._blockedButtons.set(b,{disabled:!!b.disabled,title:b.getAttribute?.('title')||''});
            b.disabled=true;b.setAttribute?.('title','已有 AI 任务进行中');
          });
        }
      }
      if(!t || !t.button) return;
      if(t._abortBtn)t._abortBtn.style.display=t.paused||t.aborted?'none':'';
      if(t._inlineAbort)t._inlineAbort.style.display=t.paused||t.aborted?'none':'';
      if(t.pausable){
        if(t._titleEl){
          // 内嵌大按钮：只改标题，秒数/中止/进度条子节点保持不动
          // （直接写 textContent 会把子节点连同中止入口一起清掉）。
          t._titleEl.textContent = t.paused
            ? (t.total?`已暂停 · ${t.done}/${t.total}（点击中止）`:'已暂停（点击中止）')
            : '生成中 · '+t.label+'…';
          t.button.classList.toggle('paused', !!t.paused);
        }else if(t.paused){
          t.button.textContent = t.total?`已暂停 · ${t.done}/${t.total}（点击中止）`:'已暂停（点击中止）';
        }else{
          t.button.textContent = t.total?`暂停 · ${Math.round(100*t.done/t.total)}%`:'暂停';
        }
      }else if(!(t.button.classList.contains('ai-draft-btn') || t.button.classList.contains('primary'))){
        t.button.textContent='生成中…';
      }
      const bar=t._bar;
      if(bar){
        const fill=bar.querySelector('.runner-bar-fill');
        const text=bar.querySelector('.runner-bar-text');
        if(fill && text){
          if(t.total>0){
            const pct=Math.round(100*Math.min(1,t.done/t.total));
            fill.style.transform=`scaleX(${Math.min(1,t.done/t.total)})`;
            fill.classList.remove('indeterminate');
            text.textContent=`${t.label} · ${pct}% · ${t.done}/${t.total}${t.paused?' · 已暂停（点击中止）':''}`;
          }else{
            fill.classList.add('indeterminate');
            text.textContent=`${t.label} · 生成中…`;
          }
        }
      }
    }
  };

  if(typeof window!=='undefined') window.Runner = Runner;
  if(typeof module!=='undefined' && module.exports) module.exports = Runner;
})();
