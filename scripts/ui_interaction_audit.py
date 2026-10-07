#!/usr/bin/env python3
"""Isolated UI audit for the 2026-10-06 interaction findings (see issues/2026-10-06-interaction-audit/).

Serves docs/ locally with a mocked /api/**, then drives the controls the audit
flagged. Expectations encode the *decided* behaviour from
issues/wayfinder/2026-10-06-interaction-specification.md, so exit 0 means the
audited problems are resolved and exit 1 means at least one is back.

Run: server/.venv/bin/python scripts/ui_interaction_audit.py
"""
import sys, threading, functools, socketserver, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ui_smoke as s
from playwright.sync_api import sync_playwright
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(('127.0.0.1',8788),functools.partial(s.QuietHandler,directory=str(s.DOCS)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(**s.launch_options())
 page=b.new_page(viewport={'width':1440,'height':1000});page.route('**/api/**',s.api_route)
 native=[]
 page.on('dialog',lambda d:(native.append(d.type),d.accept()))
 def go(w,step):
  page.goto(f'http://127.0.0.1:8788/global-brand-building.html?w={w}&s={step}')
  page.wait_for_selector('.workshop.active .step.active')
 def check(name,condition,detail):results.append({'check':name,'pass':condition,'evidence':detail})
 def dialog():
  return page.locator('.interaction-dialog.open')
 def act(locator,label):
  """Destructive controls that cascade open a confirm dialog; harmless ones only arm an undo."""
  locator.click();page.wait_for_timeout(200)
  if dialog().count():dialog().get_by_role('button',name=label,exact=True).click();page.wait_for_timeout(250)
 go(4,'place')
 inp=page.get_by_placeholder('输入伙伴名称回车添加');inp.fill('审计伙伴');inp.press('Enter');page.wait_for_timeout(250)
 btn=page.get_by_role('button',name='删除关键伙伴：审计伙伴',exact=True)
 size=btn.bounding_box();check('伙伴删除目标至少24px（仅 #5 原发位置）',size['width']>=24 and size['height']>=24,size)
 act(btn,'删除关键伙伴')
 check('伙伴删除同步',page.get_by_role('button',name='删除关键伙伴：审计伙伴',exact=True).count()==0,'点击后删除入口消失')
 go(1,'sbu')
 active=page.locator('.mode-switch button.active').first
 def style(loc):return loc.evaluate('(e)=>{const s=getComputedStyle(e);return {color:s.color,background:s.backgroundColor,transform:s.transform}}')
 before=style(active);active.hover();page.wait_for_timeout(250);after=style(active)
 check('模式选中态hover保留原色且文字可见',
       after['color']==before['color'] and after['background']==before['background'] and after['color']!=after['background'],
       {'before':before,'hover':after})
 go(3,'mining')
 page.get_by_placeholder('粘贴评论/访谈/工单，每行一条或空行分隔…').fill('唯一审计语料');page.get_by_role('button',name='添加到语料',exact=True).click();page.wait_for_timeout(250)
 act(page.get_by_role('button',name='删除真实语料：第 1 条',exact=True),'删除真实语料')
 check('真实语料删除同步',page.get_by_role('button',name='删除真实语料：第 1 条',exact=True).count()==0,'新增1条后删去，列表为空')
 go(1,'environment')
 page.get_by_role('button',name='+ 添加竞品',exact=True).click();page.wait_for_timeout(200)
 page.get_by_placeholder('竞品名称').fill('审计竞品');page.wait_for_timeout(250)
 # 可及名在 focus/hover/click 时惰性刷新，先 hover 再读，确认名称跟随对象改名。
 del_ctl=page.locator('tr').filter(has=page.get_by_placeholder('竞品名称')).first.locator('button.delete-control').first
 del_ctl.hover();page.wait_for_timeout(150)
 refreshed=del_ctl.get_attribute('aria-label')
 check('删除入口可及名随改名刷新',refreshed=='删除竞品：审计竞品',{'aria-label':refreshed})
 act(del_ctl,'删除竞品')
 check('竞品删除同步',page.get_by_placeholder('竞品名称').count()==0,'新增并填写后删除')
 for w,step in [(1,'sbu'),(1,'survey'),(2,'framework'),(3,'mining'),(4,'place'),(5,'plan')]:
  go(w,step)
  anonymous=page.locator('button:visible').evaluate_all("els=>els.filter(e=>e.textContent.trim()==='×'&&!e.getAttribute('aria-label')&&!e.title).map(e=>e.outerHTML.slice(0,240))")
  if anonymous:results.append({'check':f'W{w}/{step}无名×','pass':False,'evidence':anonymous})
 go(4,'place');inp=page.get_by_placeholder('输入伙伴名称回车添加');inp.fill('审计伙伴');inp.press('Enter');page.screenshot(path='/tmp/brand-place-audit.png',full_page=True)
 go(1,'sbu');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
 # 决策：最低支持宽度 1024，更窄时提示并保留可横向滚动的桌面界面（不再要求窄屏无溢出）。
 narrow=page.evaluate("({viewport:innerWidth,scroll:document.documentElement.scrollWidth,notice:(document.body.innerText.includes('小于 1024px'))})")
 check('390px窄屏提示并保留桌面横滚',narrow['notice'] and narrow['scroll']>narrow['viewport'],narrow);page.screenshot(path='/tmp/brand-mobile-audit.png',full_page=True)
 go(3,'mining')
 page.evaluate("state.work3.mining.documents=['真实'];state.work3.mining.simulatedDocuments=['模拟'];Work3.rerender('mining')")
 # 决策：分来源清空，不再有混合来源的「清空」入口。
 mixed=page.get_by_role('button',name='清空',exact=True).count()
 act(page.get_by_role('button',name='清空本地真实语料',exact=True),'清空本地真实语料')
 counts=page.evaluate("({real:state.work3.mining.documents.length,simulated:state.work3.mining.simulatedDocuments.length})")
 check('清空按来源且不动模拟语料',mixed==0 and counts['real']==0 and counts['simulated']==1,{'mixedEntry':mixed,'remaining':counts})
 go(1,'sbu')
 page.evaluate("Archive.list=async()=>[{id:'named_a',name:'审计版本',type:'named',created_at:1}];window.auditRenameCount=0;Archive.rename=async()=>{window.auditRenameCount++;return {id:'named_b',name:'新名'}};History.open()")
 page.wait_for_selector('#snapList .expert-row')
 page.locator('#snapList button[data-act="rename"]').click()
 page.locator('.snap-rename').fill('新名');page.locator('#snapSearch').click();page.wait_for_timeout(250)
 # 决策：失焦保留草稿与编辑态，不提交也不丢弃；提交走 Enter/保存。
 blur={'requests':page.evaluate('window.auditRenameCount'),
       'draft':page.locator('.snap-rename').input_value() if page.locator('.snap-rename').count() else None,
       'hint':'Enter 保存 · Esc 取消' in (page.locator('#snapList .expert-row').text_content() or '')}
 check('重命名失焦保留草稿不提交',blur['requests']==0 and blur['draft']=='新名' and blur['hint'],blur)
 # beforeunload 离开确认是既定行为；破坏性流程不应再借原生 confirm/alert。
 blocking=[t for t in native if t!='beforeunload']
 check('破坏性流程未使用原生对话框',not blocking,{'native':native})
 b.close()
srv.shutdown()
print(json.dumps(results,ensure_ascii=False,indent=2))
raise SystemExit(1 if any(not r['pass'] for r in results) else 0)
