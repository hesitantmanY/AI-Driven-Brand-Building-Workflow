/* ============================================================
 MatrixChart — 散点矩阵图渲染（2026-09-01 wayfinder map 抽出，供 W3/W5 共用）。
 扇面 = 均衡带 |y−x| ≤ sectorWidth：画两条平行直线 + 实心「扇面∩第一象限」交集。
 浏览器挂 window.renderMatrix；node 测试用 require 直接命中同一实现。
 依赖运行时全局：median / esc。
 ============================================================ */
(function(){
 'use strict';

function renderMatrix(opts){
  const {
    container, points, xLabel='竞争力', yLabel='吸引力',
    xCut=null, yCut=null, onSelect=null, showSector=false,
    sectorWidth=1.5, selectedId=null,
    xLabel2='可实施性', yLabel2='合意性'
  }=opts;
  container.innerHTML='';
  const W=640,H=520,L=60,R=24,T=30,B=60;
  const pw=W-L-R, ph=H-T-B;
  const xCutVal = xCut==null ? median(points.map(p=>p.x)) : xCut;
  const yCutVal = yCut==null ? median(points.map(p=>p.y)) : yCut;
  // 单点（n<2）无切分意义：不画切线、不画象限底色/铭牌（2026-09-01 ADR 0010 边界）。
  const hasCuts = points.length >= 2;
  const x=v=>L+v/10*pw, y=v=>T+(10-v)/10*ph;

  let svg=`<svg class="chart" viewBox="0 0 ${W} ${H}">`;
  // quadrant backgrounds
  svg+=`<rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="var(--color-paper-2)" stroke="var(--color-rule)"/>`;
  const xc=x(xCutVal), yc=y(yCutVal);
  if(hasCuts){
    svg+=`<rect x="${L}" y="${T}" width="${xc-L}" height="${yc-T}" fill="rgba(138,130,117,.10)"/>`;
    svg+=`<rect x="${xc}" y="${T}" width="${L+pw-xc}" height="${yc-T}" fill="rgba(58,25,15,.08)"/>`;
    svg+=`<rect x="${xc}" y="${yc}" width="${L+pw-xc}" height="${T+ph-yc}" fill="rgba(180,175,165,.12)"/>`;
    svg+=`<rect x="${L}" y="${yc}" width="${xc-L}" height="${T+ph-yc}" fill="rgba(139,37,0,.08)"/>`;
  }

  // 2026-09-01 wayfinder map：扇面 = 均衡带 |y−x| ≤ sectorWidth。
  // 画两条平行直线 y=x±w（虚线均衡带）+ 实心「扇面 ∩ 第一象限」交集多边形。
  if(showSector){
    const w = Number(sectorWidth) || 1.5;
    // Sutherland-Hodgman：从图表矩形开始，依次裁剪 x≥xCut, y≥yCut, y≤x+w, y≥x−w
    const chartPoly = [[0,0],[10,0],[10,10],[0,10]];
    const clipHalf = (poly, inside, lerpEdge) => {
      if(!poly.length) return [];
      const out = [];
      const n = poly.length;
      for(let i=0;i<n;i++){
        const a = poly[i], b = poly[(i+1)%n];
        const ia = inside(a), ib = inside(b);
        if(ia) out.push(a);
        if(ia !== ib){
          const p = lerpEdge(a, b);
          if(p) out.push(p);
        }
      }
      return out;
    };
    const lerp = (a,b,t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
    let poly = chartPoly;
    if(hasCuts){
      poly = clipHalf(poly, p => p[0] >= xCutVal, (a,b) => {
        const t = (xCutVal - a[0]) / ((b[0]-a[0]) || 1);
        return (t>=0 && t<=1) ? lerp(a,b,t) : null;
      });
      poly = clipHalf(poly, p => p[1] >= yCutVal, (a,b) => {
        const t = (yCutVal - a[1]) / ((b[1]-a[1]) || 1);
        return (t>=0 && t<=1) ? lerp(a,b,t) : null;
      });
    }
    poly = clipHalf(poly, p => (p[1]-p[0]) <= w, (a,b) => {
      const f = p => p[1]-p[0];
      const d = f(b)-f(a);
      if(d === 0) return null;
      const t = (w - f(a)) / d;
      return (t>=0 && t<=1) ? lerp(a,b,t) : null;
    });
    poly = clipHalf(poly, p => (p[1]-p[0]) >= -w, (a,b) => {
      const f = p => p[1]-p[0];
      const d = f(b)-f(a);
      if(d === 0) return null;
      const t = (-w - f(a)) / d;
      return (t>=0 && t<=1) ? lerp(a,b,t) : null;
    });
    if(hasCuts && poly.length >= 3){
      const pts = poly.map(p => x(p[0]).toFixed(1)+','+y(p[1]).toFixed(1)).join(' ');
      svg+=`<polygon points="${pts}" fill="rgba(26,26,26,.14)" stroke="var(--color-accent)" stroke-width="1.2" stroke-dasharray="5 3"/>`;
    }
    // 两条均衡带边界线（全图虚线）
    const bandLine = (bias) => {
      const seg = [];
      const cand = [
        [0, bias], [10, 10+bias], [-bias, 0], [10-bias, 10]
      ];
      cand.forEach(([px,py], i) => {
        if(px>=0 && px<=10 && py>=0 && py<=10) seg.push([px,py]);
      });
      if(seg.length === 2){
        svg+=`<line x1="${x(seg[0][0])}" y1="${y(seg[0][1])}" x2="${x(seg[1][0])}" y2="${y(seg[1][1])}"
          stroke="var(--color-ink-2)" stroke-width="1" stroke-dasharray="2 3"/>`;
      }
    };
    bandLine(w); bandLine(-w);
  }

  // grid
  for(let v=0;v<=10;v+=2){
    svg+=`<line x1="${x(v)}" y1="${T}" x2="${x(v)}" y2="${T+ph}" stroke="var(--color-rule)" stroke-width=".5"/>`;
    svg+=`<line x1="${L}" y1="${y(v)}" x2="${L+pw}" y2="${y(v)}" stroke="var(--color-rule)" stroke-width=".5"/>`;
  }
  // cut lines
  if(hasCuts){
    svg+=`<line x1="${xc}" y1="${T}" x2="${xc}" y2="${T+ph}" stroke="var(--color-ink-2)" stroke-width="1" stroke-dasharray="4 3"/>`;
    svg+=`<line x1="${L}" y1="${yc}" x2="${L+pw}" y2="${yc}" stroke="var(--color-ink-2)" stroke-width="1" stroke-dasharray="4 3"/>`;
  }
  // axes labels
  svg+=`<text x="${L+pw/2}" y="${H-18}" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="var(--color-ink-2)">${esc(xLabel)} →</text>`;
  svg+=`<text x="18" y="${T+ph/2}" transform="rotate(-90 18 ${T+ph/2})" text-anchor="middle" font-family="JetBrains Mono" font-size="11" fill="var(--color-ink-2)">${esc(yLabel)} →</text>`;
  // tick labels
  for(let v=0;v<=10;v+=2){
    svg+=`<text x="${x(v)}" y="${T+ph+18}" text-anchor="middle" font-family="JetBrains Mono" font-size="10" fill="var(--color-ink-2)">${v}</text>`;
    svg+=`<text x="${L-8}" y="${y(v)+3}" text-anchor="end" font-family="JetBrains Mono" font-size="10" fill="var(--color-ink-2)">${v}</text>`;
  }
  // quadrant labels
  if(hasCuts){
    svg+=`<text x="${L+pw-8}" y="${T+16}" text-anchor="end" font-family="Lora" font-style="normal" font-size="13" fill="var(--color-ink-2)">${esc(opts.qHighHigh||'明星')}</text>`;
    svg+=`<text x="${L+8}" y="${T+16}" font-family="Lora" font-style="normal" font-size="13" fill="var(--color-ink-2)">${esc(opts.qHighYLowX||'愿景')}</text>`;
    svg+=`<text x="${L+pw-8}" y="${T+ph-8}" text-anchor="end" font-family="Lora" font-style="normal" font-size="13" fill="var(--color-ink-2)">${esc(opts.qlowYHighX||'产能')}</text>`;
    svg+=`<text x="${L+8}" y="${T+ph-8}" font-family="Lora" font-style="normal" font-size="13" fill="var(--color-ink-2)">${esc(opts.qLowLow||'淘汰')}</text>`;
  }

  // points — 两遍画：圆点先全部落纸，标签第二遍做避让（2026-09-01）。
  // 3.4 看不清的根因 = 每个标签固定右上偏移，右上密集簇互相叠成一团。
  // 贪心放框：右上/右下/左上/左下依次试，全撞则不画字——T11 悬浮 <title> 兜底全名。
  const placed=[];
  const overlaps=(a,b)=>!(a.x1<b.x0||a.x0>b.x1||a.y1<b.y0||a.y0>b.y1);
  const dotBoxes=points.map(q=>({x0:x(q.x)-9,y0:y(q.y)-9,x1:x(q.x)+9,y1:y(q.y)+9}));
  // 四角象限铭牌（明星/愿景/产能/淘汰）也占位，右上簇不再压住「明星卖点」
  if(hasCuts){
    placed.push({x0:L+pw-8-56,y0:T+2,x1:L+pw-8,y1:T+18});
    placed.push({x0:L+8,y0:T+2,x1:L+8+28,y1:T+18});
    placed.push({x0:L+pw-8-28,y0:T+ph-20,x1:L+pw-8,y1:T+ph-6});
    placed.push({x0:L+8,y0:T+ph-20,x1:L+8+28,y1:T+ph-6});
  }
  // 2026-09-01 grilling 决策 3-B：tier1 选中的点画在最上层（重叠簇不再盖住主战场）。
  const drawDot = p=>{
    const isSel=p.id===selectedId;
    // 2026-09-01 T11：原生 SVG <title> 悬浮提示（象限 + 补短板引导）。
    let tip='';
    if(typeof opts.hover==='function'){
      tip = opts.hover(p) || '';
    }
    svg+=`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="7" fill="${isSel?'var(--color-ink)':'var(--color-paper)'}" stroke="var(--color-ink)" stroke-width="2" data-pid="${esc(p.id)}" style="cursor:${onSelect?'pointer':'default'}">${tip?`<title>${esc(tip)}</title>`:''}</circle>`;
  };
  points.forEach(p=>{ if(p.id!==selectedId) drawDot(p); });
  if(points.some(p=>p.id===selectedId)) drawDot(points.find(p=>p.id===selectedId));
  points.forEach((p,i)=>{
    const label=p.label.length>10?p.label.slice(0,10)+'…':p.label;
    const wTxt=label.length*6.8+6, h=14;
    const cands=[
      {x0:x(p.x)+10,      y0:y(p.y)-9-h+3},
      {x0:x(p.x)+10,      y0:y(p.y)+9-3},
      {x0:x(p.x)-10-wTxt, y0:y(p.y)-9-h+3},
      {x0:x(p.x)-10-wTxt, y0:y(p.y)+9-3}
    ].map(b=>({x0:b.x0,y0:b.y0,x1:b.x0+wTxt,y1:b.y0+h}));
    const box = cands.find(b =>
      b.x0>=L && b.x1<=L+pw && b.y0>=T-4 && b.y1<=T+ph+4 &&
      !placed.some(o=>overlaps(b,o)) &&
      !dotBoxes.some((d,di)=>di!==i && overlaps(b,d))
    );
    if(!box) return;
    placed.push(box);
    const start = box.x0 > x(p.x);
    svg+=`<text class="pt-label" x="${start?box.x0:box.x1}" y="${box.y1-3}" text-anchor="${start?'start':'end'}" font-family="JetBrains Mono" font-size="11" fill="#1A1A1A" pointer-events="none">${esc(label)}</text>`;
  });
  svg+=`</svg>`;
  container.innerHTML=svg;

  // click handler
  if(onSelect){
    container.querySelectorAll('circle[data-pid]').forEach(c=>{
      c.addEventListener('click', ()=>onSelect(c.getAttribute('data-pid')));
    });
  }
}

 if(typeof window!=='undefined') window.renderMatrix = renderMatrix;
 if(typeof module!=='undefined' && module.exports) module.exports = { render: renderMatrix };
})();
