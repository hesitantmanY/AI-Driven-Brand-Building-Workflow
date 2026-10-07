import sys, threading, functools, http.server, socketserver, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import ui_smoke as s
from playwright.sync_api import sync_playwright
socketserver.TCPServer.allow_reuse_address=True
srv=socketserver.TCPServer(('127.0.0.1',8788),functools.partial(s.QuietHandler,directory=str(s.DOCS)))
threading.Thread(target=srv.serve_forever,daemon=True).start()
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 page=b.new_page(viewport={'width':1440,'height':1000});page.route('**/api/**',s.api_route)
 def go(w,step):
  page.goto(f'http://127.0.0.1:8788/global-brand-building.html?w={w}&s={step}')
  page.wait_for_selector('.workshop.active .step.active')
 def check(name,condition,detail):results.append({'check':name,'pass':condition,'evidence':detail})
 go(4,'place')
 inp=page.get_by_placeholder('输入伙伴名称回车添加');inp.fill('审计伙伴');inp.press('Enter')
 btn=page.get_by_role('button',name='删除 审计伙伴',exact=True)
 size=btn.bounding_box();check('删除目标至少24px',size['width']>=24 and size['height']>=24,size)
 btn.click();check('伙伴删除同步',page.get_by_role('button',name='删除 审计伙伴',exact=True).count()==0,'点击后删除入口消失')
 go(1,'sbu')
 active=page.locator('.mode-switch button.active').first
 def style(loc):return loc.evaluate('(e)=>{const s=getComputedStyle(e);return {color:s.color,background:s.backgroundColor,transform:s.transform}}')
 before=style(active);active.hover();page.wait_for_timeout(250);after=style(active)
 check('模式选中态hover文字可见',after['color']!=after['background'],{'before':before,'hover':after})
 go(3,'mining')
 page.get_by_placeholder('粘贴评论/访谈/工单，每行一条或空行分隔…').fill('唯一审计语料');page.get_by_role('button',name='添加到语料',exact=True).click()
 page.get_by_role('button',name='删除真实语料',exact=True).click()
 check('真实语料删除同步',page.get_by_role('button',name='删除真实语料',exact=True).count()==0,'新增1条后删去，列表为空')
 go(1,'environment')
 page.get_by_role('button',name='+ 添加竞品',exact=True).click()
 page.get_by_placeholder('竞品名称').fill('审计竞品')
 page.get_by_role('button',name='删除竞品',exact=True).click()
 check('竞品删除同步',page.get_by_placeholder('竞品名称').count()==0,'新增并填写后删除')
 for w,step in [(1,'sbu'),(1,'survey'),(2,'framework'),(3,'mining'),(4,'place'),(5,'plan')]:
  go(w,step)
  anonymous=page.locator('button:visible').evaluate_all("els=>els.filter(e=>e.textContent.trim()==='×'&&!e.getAttribute('aria-label')&&!e.title).map(e=>e.outerHTML.slice(0,240))")
  if anonymous:results.append({'check':f'W{w}/{step}无名×','pass':False,'evidence':anonymous})
 go(4,'place');inp=page.get_by_placeholder('输入伙伴名称回车添加');inp.fill('审计伙伴');inp.press('Enter');page.screenshot(path='/tmp/brand-place-audit.png',full_page=True)
 go(1,'sbu');page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
 sizes=page.evaluate('({viewport:innerWidth,scroll:document.documentElement.scrollWidth})');check('390px视口无横向溢出',sizes['scroll']<=sizes['viewport'],sizes);page.screenshot(path='/tmp/brand-mobile-audit.png',full_page=True)
 go(3,'mining')
 page.evaluate("state.work3.mining.documents=['真实'];state.work3.mining.simulatedDocuments=['模拟'];Work3.rerender('mining')")
 dialogs=[]
 page.on('dialog',lambda d:(dialogs.append(d.message),d.accept()))
 page.get_by_role('button',name='清空',exact=True).first.click()
 counts=page.evaluate("({real:state.work3.mining.documents.length,simulated:state.work3.mining.simulatedDocuments.length})")
 check('清空全部语料与范围一致',counts['real']==0 and counts['simulated']==0,{'dialog':dialogs,'remaining':counts})
 go(1,'sbu')
 page.evaluate("Archive.list=async()=>[{id:'named_a',name:'审计版本',type:'named',created_at:1}];window.auditRenameCount=0;Archive.rename=async()=>{window.auditRenameCount++;return {id:'named_b',name:'新名'}};History.open()")
 page.wait_for_selector('#snapList .expert-row')
 page.get_by_role('button',name='重命名',exact=True).click()
 page.locator('.snap-rename').fill('新名');page.locator('#snapSearch').click()
 check('重命名失焦后反馈或保存',page.evaluate('window.auditRenameCount')>0,{'renameRequests':page.evaluate('window.auditRenameCount'),'visibleName':page.locator('.snap-name').inner_text(),'instruction':'无保存按钮或Enter提示，失焦丢弃'})
 b.close()
srv.shutdown()
print(json.dumps(results,ensure_ascii=False,indent=2))
raise SystemExit(1 if any(not r['pass'] for r in results) else 0)
