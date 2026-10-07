"""Real UI acceptance for archive operations, protected replacement and cases.

Imported by ui_interaction_acceptance.py; all persistence uses its disposable API.
Fault injection changes request functions only. User actions use real controls.
"""
from __future__ import annotations

import json
from contextlib import contextmanager
from urllib.parse import quote


SBU = '#steps1 .step[data-step="sbu"] .sbu-input'
PLAN = '#steps5 .step[data-step="plan"]'


def _works(h, upstream=False):
    count = 4 if upstream else 5
    return h.page.evaluate("n => Array.from({length:n},(_,i)=>state['work'+(i+1)])", count)


def _server_works(h, upstream=False):
    data = h.api("GET", "/api/state")
    return [data["work" + str(n)] for n in range(1, 5 if upstream else 6)]


def _differences(before, after, path=""):
    if type(before) is not type(after):
        return [{"path": path, "before": before, "after": after}]
    if isinstance(before, dict):
        result = []
        for key in sorted(before.keys() | after.keys()):
            result += _differences(before.get(key), after.get(key), path + "." + key)
        return result
    if isinstance(before, list) and len(before) == len(after):
        return [item for i, (old, new) in enumerate(zip(before, after)) for item in _differences(old, new, path + "[" + str(i) + "]")]
    return [] if before == after else [{"path": path, "before": before, "after": after}]


def _snap_state(h, snapshot):
    return h.api("GET", "/api/snapshots/" + quote(snapshot["id"], safe=""))


def _row(h, snapshot):
    return h.page.locator('#snapList .expert-row[data-id="' + snapshot["id"] + '"]')


def _history(h):
    h.open_history()
    if h.page.locator("#snapSearch").input_value():
        h.page.locator("#snapSearch").fill("")
    h.page.wait_for_function("document.querySelectorAll('#snapList .expert-row').length === History._snapshots.length")


def _close_history(h):
    if h.page.locator("#historyModal.open").count():
        h.page.get_by_role("button", name="关闭历史记录面板", exact=True).click()


def _open_save(h, name):
    h.page.locator("#saveBtn").click()
    h.page.locator("#saveName").fill(name)
    h.page.locator("#savePopup button.primary").click()


def _rename(h, snapshot, name, *, top=False):
    if top:
        _close_history(h)
        h.page.locator("#archiveRenameBtn").click()
    else:
        _history(h)
        _row(h, snapshot).locator('button[data-act="rename"]').click()
    field = _row(h, snapshot).locator(".snap-rename")
    field.fill(name)
    return field


def _load(h, snapshot, *, confirm=True):
    _history(h)
    _row(h, snapshot).locator('button[data-act="load"]').click()
    if confirm:
        h.confirm("加载并覆盖")
        h.wait_idle()


def _refresh(h):
    h.page.reload(wait_until="domcontentloaded")
    h.wait_ready()
    h.wait_idle()


@contextmanager
def _instrument(h, setup=""):
    h.page.evaluate("""() => {
        window.__arcQA = {save:saveNow, create:Archive.create, rename:Archive.rename,
            restore:Archive.restore, toast:showToast, toasts:[], saves:0, creates:0};
        showToast = function(message,...args){
            __arcQA.toasts.push(String(message)); return __arcQA.toast(message,...args);
        };
    }""")
    if setup:
        h.page.evaluate("() => {" + setup + "}")
    try:
        yield
    finally:
        h.page.evaluate("""() => {
            if(!window.__arcQA)return;
            saveNow=__arcQA.save; Archive.create=__arcQA.create;
            Archive.rename=__arcQA.rename; Archive.restore=__arcQA.restore;
            showToast=__arcQA.toast;
        }""")


def _toasts(h):
    return h.page.evaluate("window.__arcQA?.toasts || []")


def _no_success(h, label):
    messages = _toasts(h)
    h.check(label, not any(text.startswith(("已存档", "已加载版本", "已重命名", "已另存为", "已覆盖版本", "已重置", "导入完成")) for text in messages), messages)


def _import(h, name="验收导入.md", content=None):
    if content is None:
        payload = h.page.evaluate("""() => {
            const imported=JSON.parse(JSON.stringify(state));
            imported.work1.sbu.name='导入后的业务';
            runSchemaMigrations(imported);
            return imported;
        }""")
        content = "# 验收导入\n<!-- data:" + json.dumps(payload, ensure_ascii=False) + " -->"
    with h.page.expect_file_chooser() as selected:
        h.page.get_by_role("button", name="导入 .md", exact=True).click()
    selected.value.set_files({"name": name, "mimeType": "text/markdown", "buffer": content.encode()})


def _protected_start(h, kind, import_content=None):
    if kind == "reset":
        h.page.get_by_role("button", name="重置工作区", exact=True).click()
        dialog = h.page.locator('[role="dialog"]:visible').last
        h.check("重置确认包含五坊和 API 保留范围", "当前五个工作坊" in dialog.inner_text() and "API 设置保留" in dialog.inner_text())
        h.confirm("重置工作区")
    elif kind == "import":
        _import(h, content=import_content)
        dialog = h.page.locator('[role="dialog"]:visible').last
        h.check("导入确认包含文件名和五坊范围", "验收导入.md" in dialog.inner_text() and "当前五个工作坊" in dialog.inner_text())
        h.confirm("导入并覆盖")
    else:
        h.goto(5, "plan")
    h.wait_idle()


def _protected_success(h, kind):
    # A retry runs runProtected directly, without App._resetPending; its notice
    # remains until the final real save has completed.
    h.page.locator('#interactionNotices [data-notice-key="' + kind + '"]').wait_for(state="detached", timeout=15000)
    h.wait_idle()
    h.page.wait_for_function("dirty === false")


def _protect_seed(h, name):
    h.seed("state.work1.sbu.name=" + json.dumps(name) + ";"
           "state.work1.environment.political='新的政治环境';"
           "state.work5.ch1_business='既有策划书';"
           "state.work5.syncedValues.ch1_business='既有策划书';"
           "state.work5.ch2_environment.political='旧政治环境';"
           "state.work5.syncedValues['ch2_environment.political']='旧政治环境';")
    h.clear_archive()


def _a01(h):
    h.seed("state.work1.sbu.name='待加载内容';")
    h.clear_archive()
    target = h.save_version("指定加载版本")
    h.check("创建真实命名版本", bool(target), target)
    for dirty_case in (False, True):
        label = "有未保存" if dirty_case else "已保存"
        h.seed("state.work1.sbu.name='当前工作区';")
        if dirty_case:
            h.page.locator(SBU).first.fill("当前未保存输入")
        before = _works(h)
        server_before = _server_works(h)
        restores = []

        def request_seen(request):
            if request.method == "POST" and "/restore" in request.url:
                restores.append(request.url)

        h.page.on("request", request_seen)
        try:
            with _instrument(h):
                _load(h, target, confirm=False)
                dialog = h.page.locator('[role="dialog"]:visible').last
                text = dialog.inner_text()
                h.check(label + "先准确确认名称和无自动备份", "指定加载版本" in text and "不会自动创建恢复备份" in text, text)
                h.check(label + "未保存警告准确", ("当前有未保存改动" in text) == dirty_case, text)
                h.check(label + "默认焦点是取消", h.page.evaluate("document.activeElement.textContent === '取消'"))
                h.page.keyboard.press("Shift+Tab")
                h.check(label + "确认焦点限制在弹窗", dialog.evaluate("node=>node.contains(document.activeElement)"))
                h.confirm("取消")
                h.wait_idle()
                h.check(label + "取消无恢复请求", not restores, restores)
                h.check(label + "取消不覆盖 live/API", _works(h) == before and _server_works(h) == server_before)
                h.check(label + "取消返回触发加载按钮焦点", _row(h, target).locator('button[data-act="load"]').evaluate("n=>n===document.activeElement"))
                _row(h, target).locator('button[data-act="load"]').click()
                h.confirm("加载并覆盖")
                h.wait_idle()
                h.check(label + "确认只恢复一次", len(restores) == 1, restores)
                h.check(label + "准确加载与更新来源", h.page.evaluate("state.work1.sbu.name==='待加载内容' && state.meta.loadedFrom==='指定加载版本'"))
                h.check(label + "真实 API 已恢复内容", h.api("GET", "/api/state")["work1"]["sbu"]["name"] == "待加载内容")
                h.check(label + "无自动备份", len(h.api("GET", "/api/snapshots")) == 1)
                h.check(label + "成功反馈实际版本名", "已加载版本：指定加载版本" in _toasts(h), _toasts(h))
                h.check(label + "保留有效 API", h.page.evaluate("state.settings.api.backendUrl") == h.base)
        finally:
            h.page.remove_listener("request", request_seen)
        _refresh(h)
        h.check(label + "刷新保留加载内容与来源", h.page.evaluate("state.work1.sbu.name==='待加载内容' && state.meta.loadedFrom==='指定加载版本'"))


def _a02(h):
    h.seed("state.work1.sbu.name='版本旧内容';")
    h.clear_archive()
    target = h.save_version("失败加载目标")
    for changed in (False, True):
        for failure in ("http", "network"):
            h.seed("state.work1.sbu.name='失败时保留的内容';")
            if changed:
                h.page.locator(SBU).first.fill("失败时保留的新输入")
            before, persisted = _works(h), _server_works(h)
            label = ("dirty" if changed else "clean") + " / " + failure
            pattern = "**/api/snapshots/" + quote(target["id"], safe="") + "/restore*"

            def fail_route(route):
                if failure == "http":
                    route.fulfill(status=500, content_type="application/json", body='{"detail":"验收恢复服务失败"}', headers={"Access-Control-Allow-Origin": "*"})
                else:
                    route.abort("failed")

            h.page.route(pattern, fail_route)
            try:
                with _instrument(h):
                    _load(h, target)
                    h.check(label + "失败保留 live/API", _works(h) == before and _server_works(h) == persisted)
                    h.check(label + "明确失败原因", any(text.startswith("加载失败：") for text in _toasts(h)), _toasts(h))
                    _no_success(h, label + "无加载成功反馈")
                    load = _row(h, target).locator('button[data-act="load"]')
                    h.check(label + "加载按钮恢复", load.is_enabled() and load.inner_text() == "加载")
                    load.click()
                    h.check(label + "可再次打开确认", h.page.locator('[role="dialog"]:visible').count() == 1)
                    h.page.keyboard.press("Escape")
                    h.wait_idle()
            finally:
                h.page.unroute(pattern, fail_route)
            _close_history(h)


def _a03(h):
    h.seed("state.work1.sbu.name='命名快照内容';")
    h.clear_archive()
    source = h.save_version("原始名字")
    _load(h, source)
    current = source
    for top in (False, True):
        prefix = "顶栏" if top else "行内"
        draft_name = prefix + "失焦草稿"
        field = _rename(h, current, draft_name, top=top)
        h.page.locator("#snapSearch").click()
        h.check(prefix + "失焦保留草稿和编辑态", field.input_value() == draft_name and _row(h, current).locator('button[data-act="rename-save"]').is_visible())
        h.check(prefix + "失焦不提交", h.snapshot(current["name"]) is not None)
        previous_editor = field.element_handle()
        h.page.locator("#snapSearch").fill(current["name"])
        h.page.wait_for_function("node=>!node.isConnected", arg=previous_editor)
        field = _row(h, current).locator(".snap-rename")
        h.check(prefix + "重挂载保留草稿", field.input_value() == draft_name)
        h.check(prefix + "显式按键说明", "Enter 保存 · Esc 取消" in _row(h, current).text_content())
        field.press("Escape")
        h.wait_idle()
        _row(h, current).locator(".snap-rename").wait_for(state="detached")
        h.check(prefix + "Esc 不更名并退出编辑", h.snapshot(current["name"]) is not None and not _row(h, current).locator(".snap-rename").count())
        _close_history(h)
        field = _rename(h, current, "   ", top=top)
        field.press("Enter")
        h.wait_idle()
        _row(h, current).get_by_text("名称不能为空", exact=True).wait_for(state="visible")
        h.check(prefix + "空白拒绝且保留输入", "名称不能为空" in _row(h, current).inner_text() and h.snapshot(current["name"]) is not None)
        next_name = prefix + "Enter后实际名字"
        _row(h, current).locator(".snap-rename").fill(next_name)
        _row(h, current).locator(".snap-rename").press("Enter")
        h.wait_idle()
        current = h.snapshot(next_name)
        h.check(prefix + "Enter 真正写入名称", current is not None, current)
        _close_history(h)
        field = _rename(h, current, prefix + "显式取消", top=top)
        _row(h, current).locator('button[data-act="rename-cancel"]').click()
        h.wait_idle()
        _row(h, current).locator(".snap-rename").wait_for(state="detached")
        h.check(prefix + "取消按钮不提交", h.snapshot(current["name"]) is not None and not _row(h, current).locator(".snap-rename").count())
        _close_history(h)
        _rename(h, current, prefix + "显式保存", top=top)
        _row(h, current).locator('button[data-act="rename-save"]').click()
        h.wait_idle()
        current = h.snapshot(prefix + "显式保存")
        h.check(prefix + "保存按钮与 Enter 一致", current is not None)
        _close_history(h)
    h.check("来源名称跟随真实重命名", h.page.evaluate("state.meta.loadedFrom") == current["name"])
    h.save_version("重命名来源持久化检查")
    h.check("来源名称真实保存到 API", h.api("GET", "/api/state")["meta"]["loadedFrom"] == current["name"])
    _refresh(h)
    h.check("刷新来源名称正确", h.page.locator("#archiveLabelText").inner_text() == "当前：" + current["name"])


def _a04(h):
    actions = ("覆盖旧版本", "另存为新版本", "取消此次操作")
    for mode in ("save", "rename"):
        for action in actions:
            h.seed("state.work1.sbu.name='同名目标旧内容';")
            h.clear_archive()
            target = h.save_version("终版")
            source = None
            if mode == "rename":
                h.seed("state.work1.sbu.name='源快照内容';")
                source = h.save_version("源版本")
            js = "state.work1.sbu.name='当前 live 与源快照不同';"
            if source:
                js += "state.meta.loadedFrom='源版本';state.meta.loadedFromId=" + json.dumps(source["id"]) + ";"
            h.seed(js)
            before = h.api("GET", "/api/snapshots")
            label = mode + " / " + action
            with _instrument(h):
                if source:
                    field = _rename(h, source, "终版")
                    field.press("Enter")
                else:
                    _open_save(h, "终版")
                dialog = h.page.locator('[role="dialog"]:visible').last
                dialog.wait_for(state="visible")
                h.check(label + "三动作均明确可见", all(dialog.get_by_role("button", name=item, exact=True).is_visible() for item in actions))
                h.check(label + "冲突说明覆盖与保留后缀", "覆盖会替换它的旧内容" in dialog.inner_text() and "另存会保留原版本并生成可用后缀" in dialog.inner_text())
                h.confirm(action)
                h.wait_idle()
                after = h.api("GET", "/api/snapshots")
                if action == "取消此次操作":
                    h.check(label + "取消版本库完全不变", after == before)
                    _no_success(h, label + "取消无成功反馈")
                    if source:
                        _row(h, source).locator(".snap-rename").wait_for(state="detached")
                        h.check(label + "取消结束重命名", not _row(h, source).locator(".snap-rename").count())
                elif action == "另存为新版本":
                    created = [snap for snap in after if snap["id"] not in {snap["id"] for snap in before}]
                    h.check(label + "实际新增一条后缀版本", len(created) == 1, created)
                    result = created[0]
                    h.check(label + "原同名目标保留", _snap_state(h, target)["work1"]["sbu"]["name"] == "同名目标旧内容")
                    expected = "源快照内容" if source else "当前 live 与源快照不同"
                    h.check(label + "复制正确内容", _snap_state(h, result)["work1"]["sbu"]["name"] == expected)
                    h.check(label + "实际名称反馈", "已另存为：" + result["name"] in _toasts(h), _toasts(h))
                    if source:
                        h.check(label + "源保留且来源不变", h.snapshot("源版本") is not None and h.page.evaluate("state.meta.loadedFromId") == source["id"])
                else:
                    result = h.snapshot("终版")
                    expected = "源快照内容" if source else "当前 live 与源快照不同"
                    h.check(label + "目标被正确内容覆盖", _snap_state(h, result)["work1"]["sbu"]["name"] == expected)
                    h.check(label + "覆盖后版本数量", len(after) == 1, after)
                    if source:
                        h.check(label + "源旧名不残留且实际来源跟随", h.snapshot("源版本") is None and h.page.evaluate("state.meta.loadedFromId") == result["id"] and h.page.evaluate("state.meta.loadedFrom") == result["name"])
                    h.check(label + "实际覆盖反馈", "已覆盖版本：" + result["name"] in _toasts(h), _toasts(h))
            _close_history(h)


def _a05(h):
    faults = {
        "save false": "saveNow=async()=>false;",
        "save throw": "saveNow=async()=>{throw new Error('验收保存异常')};",
        "archive throw": "Archive.create=async()=>{throw new Error('验收命名写入失败')};",
        "invalid metadata": "Archive.create=async()=>({id:'',name:''});",
    }
    for label, injection in faults.items():
        h.seed("state.work1.sbu.name='命名失败后仍保留';")
        h.clear_archive()
        with _instrument(h, injection):
            _open_save(h, "失败后保留名称")
            h.wait_idle()
            expected_stage = "保存当前内容失败" if label.startswith("save") else "创建历史版本失败"
            h.check(label + "准确失败阶段", expected_stage in h.page.locator("#savePopup .save-stage").inner_text())
            h.check(label + "版本名保留且可重试", h.page.locator("#saveName").input_value() == "失败后保留名称" and h.page.locator("#savePopup button.primary").is_enabled())
            h.check(label + "不新增档案", not h.api("GET", "/api/snapshots"))
            _no_success(h, label + "不显示已存档")
        h.page.locator("#savePopup button.primary").click()
        h.wait_idle()
        h.check(label + "重新保存成功且永久命名", h.snapshot("失败后保留名称")["type"] == "named")
    h.seed("state.work1.sbu.name='复制来源';")
    h.clear_archive()
    source = h.save_version("复制源")
    for name in ("终版", "终版(1)", "终版(2)"):
        h.seed("state.work1.sbu.name='占用后缀的旧内容';")
        h.save_version(name)
    h.seed("state.work1.sbu.name='不同 live';state.meta.loadedFrom='复制源';state.meta.loadedFromId=" + json.dumps(source["id"]) + ";")
    with _instrument(h, "Archive.rename=async()=>{throw new Error('验收重命名失败')};"):
        field = _rename(h, source, "失败的新名字")
        field.press("Enter")
        h.wait_idle()
        h.check("重命名写入失败保留草稿与源", _row(h, source).locator(".snap-rename").input_value() == "失败的新名字" and h.snapshot("复制源") is not None)
        _no_success(h, "重命名失败没有成功反馈")
    _row(h, source).locator(".snap-rename").fill("终版")
    with _instrument(h):
        _row(h, source).locator(".snap-rename").press("Enter")
        h.confirm("另存为新版本")
        h.wait_idle()
        result = h.snapshot("终版(3)")
        h.check("服务端绕过占用后缀", result is not None, h.api("GET", "/api/snapshots"))
        h.check("后缀反馈是实际返回名", "已另存为：" + result["name"] in _toasts(h), _toasts(h))
        h.check("复制不误改当前来源", h.page.evaluate("state.meta.loadedFromId") == source["id"] and h.page.evaluate("state.meta.loadedFrom") == "复制源")
        h.check("后缀复制的是源内容", _snap_state(h, result)["work1"]["sbu"]["name"] == "复制来源")
    _close_history(h)


def _a12(h):
    faults = {
        "save false": ("保存当前内容", "saveNow=async()=>{__arcQA.saves++;return false;};"),
        "save throw": ("保存当前内容", "saveNow=async()=>{__arcQA.saves++;throw new Error('验收前置保存异常')};"),
        "archive throw": ("创建覆盖前版本", "Archive.create=async()=>{__arcQA.creates++;throw new Error('验收前置存档失败')};"),
        "invalid metadata": ("创建覆盖前版本", "Archive.create=async()=>{__arcQA.creates++;return {id:'',name:''};};"),
    }
    for kind in ("reset", "import", "w5-sync"):
        for fault, (stage, injection) in faults.items():
            _protect_seed(h, "保护中原始业务")
            before, persisted = _works(h), _server_works(h)
            label = kind + " / " + fault
            with _instrument(h, injection):
                _protected_start(h, kind)
                notice = h.page.locator('#interactionNotices [data-notice-key="' + kind + '"]')
                message = notice.inner_text()
                h.check(label + "阻止覆盖且准确阶段", "当前内容未被覆盖" in message and stage + "失败" in message, message)
                h.check(label + "保留 live/API 及版本库", _works(h) == before and _server_works(h) == persisted and not h.api("GET", "/api/snapshots"))
                h.check(label + "提供真正重试入口", notice.get_by_role("button", name="重试", exact=True).is_enabled())
                _no_success(h, label + "无覆盖成功反馈")
                if kind == "w5-sync":
                    h.check(label + "W5 可阅读并说明未同步", "未同步最新上游成果" in h.page.locator("#w5SyncStatus").inner_text() and h.page.locator(PLAN + " .chapter").count() == 5)
            notice.get_by_role("button", name="重试", exact=True).click()
            _protected_success(h, kind)
            h.check(label + "重试完成且真实存档", len(h.api("GET", "/api/snapshots")) == 1 and not h.page.locator('#interactionNotices [data-notice-key="' + kind + '"]').count())
            expected = "" if kind == "reset" else "导入后的业务" if kind == "import" else "保护中原始业务"
            h.check(label + "重试结果持久化", h.api("GET", "/api/state")["work1"]["sbu"]["name"] == expected)
            _refresh(h)
            h.check(label + "刷新恢复真实结果", h.page.evaluate("state.work1.sbu.name") == expected)
    _protect_seed(h, "无法解析前原内容")
    before = _works(h)
    _import(h, "不可解析.md", "# 没有嵌入数据")
    h.wait_idle()
    h.check("无效导入先解析且无确认/存档/覆盖", _works(h) == before and not h.page.locator('[role="dialog"]:visible').count() and not h.api("GET", "/api/snapshots"))


def _a13(h):
    legacy_payload = "# 旧格式导入\n<!-- data:" + json.dumps({
        "work1": {"sbu": {"name": "导入后的业务"}},
        "work2": {"meta": {"schemaVersion": 1}, "markets": []},
        "work4": {"place": {"keyPartners": ["旧格式伙伴"]}},
    }, ensure_ascii=False) + " -->"
    for kind, legacy in (("reset", False), ("import", False), ("import", True), ("w5-sync", False)):
        _protect_seed(h, "后置保存失败前业务")
        persisted = _server_works(h)
        label = kind + (" / 部分旧 schema" if legacy else "")
        injection = """saveNow=async()=>{
            __arcQA.saves++;if(__arcQA.saves===2)return false;
            return __arcQA.save();
        };"""
        with _instrument(h, injection):
            _protected_start(h, kind, legacy_payload if legacy else None)
            notice = h.page.locator('#interactionNotices [data-notice-key="' + kind + '"]')
            message = notice.inner_text()
            h.check(label + "后置失败说明已更新", "内容已更新但未保存" in message and "未被覆盖" not in message, message)
            dirty_info = h.page.evaluate("({dirty,status:document.querySelector('#saveStatus').textContent,saves:__arcQA.saves,creates:__arcQA.creates})")
            h.check(label + "后置失败保持 dirty", dirty_info["dirty"] is True and "未保存" in dirty_info["status"], dirty_info)
            h.check(label + "前置备份真实存在", len(h.api("GET", "/api/snapshots")) == 1)
            server_now = _server_works(h)
            h.check(label + "未保存的结果尚未写入 API", server_now == persisted, _differences(persisted, server_now))
            expected = "" if kind == "reset" else "导入后的业务" if kind == "import" else "后置保存失败前业务"
            h.check(label + "结果确已应用", h.page.evaluate("state.work1.sbu.name") == expected and (kind != "w5-sync" or "后置保存失败前业务" in h.page.evaluate("state.work5.ch1_business")))
            _no_success(h, label + "后置失败无全部完成反馈")
            if legacy:
                h.check("旧 schema 导入迁移没有虚报已保存", not any("已保存" in text for text in _toasts(h)), _toasts(h))
                h.check("旧 schema 伙伴迁移保留来源内容", h.page.evaluate("state.work4.place.keyPartners.some(p=>typeof p==='object' && p.name==='旧格式伙伴')"))
        notice.get_by_role("button", name="重试保存", exact=True).click()
        _protected_success(h, kind)
        h.check(label + "重试保存不重复备份", len(h.api("GET", "/api/snapshots")) == 1)
        h.check(label + "重试保存实际持久化并清 dirty", h.api("GET", "/api/state")["work1"]["sbu"]["name"] == expected and h.page.evaluate("dirty === false"))
        _refresh(h)
        h.check(label + "保存重试后刷新一致", h.page.evaluate("state.work1.sbu.name") == expected)
    _protect_seed(h, "备份期间旧上游")
    injection = """Archive.create=async function(...args){
        __arcQA.creates++;
        const metadata=await __arcQA.create.apply(this,args);
        if(__arcQA.creates===1){window.__arcBackupReady=true;
            await new Promise(resolve=>window.__arcBackupRelease=resolve);}
        return metadata;
    };"""
    with _instrument(h, injection):
        h.goto(5, "plan")
        h.page.wait_for_function("window.__arcBackupReady === true")
        h.page.locator(PLAN + " .chapter-text").first.fill("备份期间用户新增的策划书正文")
        h.goto(1, "sbu")
        h.page.locator(SBU).first.fill("备份期间最新上游业务")
        h.goto(1, "environment")
        h.page.locator('#steps1 .step[data-step="environment"] .pest-grid textarea').first.fill("备份期间最新政治环境")
        h.goto(5, "plan")
        h.page.evaluate("window.__arcBackupRelease()")
        h.wait_idle()
        h.check("W5 存档期间新增正文受保护", h.page.evaluate("state.work5.ch1_business") == "备份期间用户新增的策划书正文")
        h.check("W5 读取最新上游而非旧 patch", h.page.evaluate("state.work5.ch2_environment.political") == "备份期间最新政治环境")
        h.check("输入改变后重新存档", h.page.evaluate("__arcQA.creates >= 2"))
        versions = h.api("GET", "/api/snapshots")
        protected = [_snap_state(h, version) for version in versions]
        h.check("新存档保护最新上游和新增正文", any(data["work1"]["sbu"]["name"] == "备份期间最新上游业务" and data["work5"]["ch1_business"] == "备份期间用户新增的策划书正文" for data in protected))
        h.check("保护后的最终结果实际持久化", h.api("GET", "/api/state")["work5"]["ch1_business"] == "备份期间用户新增的策划书正文")
    _refresh(h)
    h.check("并发输入保护刷新后保留", h.page.evaluate("state.work5.ch1_business") == "备份期间用户新增的策划书正文")


EVIDENCE_FIXTURE = """
state.work1.sbu.name='证据验收业务';
state.work1.environment.political='证据环境';
state.work1.metrics.dimensions=[{id:'dimension',name:'品牌资产',secondaries:[
    {id:'metric',name:'可信度',selfScore:6,actual:8,measure:'合成测量'}]}];
state.work2.retained=[{id:'market-1',name:'主市场',notes:''},{id:'market-2',name:'另一个市场',notes:''}];
state.work2.retained.forEach((market,i)=>{
    state.work2.scoring[market.id]={};
    ['attractiveness','competitiveness'].forEach(axis=>
        state.work2[axis].categories.forEach(category=>category.indicators.forEach(indicator=>
            state.work2.scoring[market.id][indicator.id]={score:8-i*3,evidence:'合成证据'})));
});
state.work2.decision.tier1.marketId='market-1';
state.work2.decision.tier1.rationale='合成选择理由';
state.work3.scenarios=[{id:'scenario',name:'证据场景',description:'合成细分场景',selected:true,personaIds:[]}];
state.work3.mining.painMap=[{id:'pain',pain:'等待耗时',evidence:'真实合成验收引用',frequency:'高',type:'痛点',scenarioId:'scenario'}];
state.work3.mining.topics=[{id:0,label:'合成主题',share:100,keywords:[{word:'等待',weight:1}],representative_docs:['合成验收语料']}];
state.work3.candidates=[{id:'point-1',name:'快速交付',description:'合成卖点',painId:'pain',pain:'等待耗时',evidence:'合成证据',scenarioId:'scenario',selected:true,
    desirabilityScores:{importance:8,uniqueness:8,credibility:8},feasibility:8,communicability:8,sustainability:8},
    {id:'point-2',name:'专业支持',description:'合成卖点',painId:'',pain:'',evidence:'',scenarioId:'scenario',selected:false,
    desirabilityScores:{importance:5,uniqueness:5,credibility:5},feasibility:5,communicability:5,sustainability:5}];
state.work3.proposition.chosenValueText='合成价值主张';
state.work3.proposition.positioningStatement='合成定位句';
state.work3.identity.chosenSlogan='合成 Slogan';
state.work4.place.structure=[{name:'线上',children:[{id:'channel',name:'直营',share:60}]},{name:'线下',children:[{id:'offline',name:'经销',share:40}]}];
state.work4.place.keyPartners=[{name:'线上伙伴',side:'线上'}];
state.work4.promotion.advertising=[{id:'ad',media:'测试媒介',budgetShare:100,message:'测试广告',kpi:'合成投放'}];
"""


def _a14(h):
    h.seed(EVIDENCE_FIXTURE)
    h.clear_archive()
    h.goto(5, "plan")
    h.wait_idle()
    before = _works(h, upstream=True)
    h.check("W5 显示真实上游市场和卖点点位", h.page.locator(PLAN + ' circle[data-pid="market-2"]').count() == 1 and h.page.locator(PLAN + ' circle[data-pid="point-2"]').count() == 1)
    for selector in ('circle[data-pid="market-2"]', 'circle[data-pid="point-2"]', '.pain-tbl tbody tr', '.value-tbl tbody tr', '.channel-tree svg'):
        control = h.page.locator(PLAN + " " + selector).first
        control.click()
        h.check("证据点击不写上游：" + selector, _works(h, upstream=True) == before)
    h.check("证据区不提供战略编辑或删除", not h.page.locator(PLAN + ' .pain-tbl input,' + PLAN + ' .value-tbl input,' + PLAN + ' .decision-tbl button,' + PLAN + ' .channel-tree input').count())
    text = h.page.locator(PLAN).inner_text()
    h.check("W5 文案没有实现术语", "共享 state" not in text and "点选设为主战场" not in text)
    routes = [
        ("去目标市场修改", 2, "decision"),
        ("去卖点评分与矩阵修改", 3, "matrix"),
        ("去品牌指标与评分修改", 1, "metrics"),
        ("去痛点与语料修改", 3, "mining"),
        ("去渠道结构与伙伴修改", 4, "place"),
        ("去传播预算与媒介修改", 4, "promotion"),
        ("去三档市场决策修改", 2, "decision"),
        ("去指标与收敛权重修改", 2, "framework"),
        ("去语料建模与主题修改", 3, "mining"),
    ]
    for label, work, step in routes:
        button = h.page.locator(PLAN).get_by_role("button", name=label, exact=True, include_hidden=True)
        h.check("证据提供精确上游入口：" + label, button.count() >= 1)
        if label in ("去指标与收敛权重修改", "去语料建模与主题修改"):
            detail = button.first.locator("xpath=ancestor::details")
            detail.locator("summary").click()
        button.first.click()
        h.page.wait_for_function("p=>App.currentWork===p.work && App.currentStep===p.step", arg={"work": work, "step": step})
        h.check("精确导航：" + label, h.page.evaluate("[App.currentWork,App.currentStep]") == [work, step])
        h.check("上游跳转不改变决策：" + label, _works(h, upstream=True) == before)
        h.goto(5, "plan")
        h.wait_idle()
    h.check("API 上游未被证据交互写入", _server_works(h, upstream=True) == before)
    _refresh(h)
    h.check("刷新后战略仍相同", _works(h, upstream=True) == before)


def _a15(h):
    h.seed("state.work1.sbu.name='来源快照内容';")
    h.clear_archive()
    source = h.save_version("当前来源")
    _load(h, source)
    h.page.locator(SBU).first.fill("当前来源加载后的新编辑")
    _rename(h, source, "来源已重命名", top=True).press("Enter")
    h.wait_idle()
    renamed = h.snapshot("来源已重命名")
    h.check("实际源更名更新 id/name 和顶栏", h.page.evaluate("state.meta.loadedFromId") == renamed["id"] and h.page.evaluate("state.meta.loadedFrom") == renamed["name"] and h.page.locator("#archiveLabelText").inner_text() == "当前：来源已重命名")
    _close_history(h)
    h.save_version("复制冲突目标")
    _rename(h, renamed, "复制冲突目标", top=True).press("Enter")
    h.confirm("另存为新版本")
    h.wait_idle()
    copy = h.snapshot("复制冲突目标(1)")
    h.check("来源另存新增版本并保持来源", copy is not None and h.page.evaluate("state.meta.loadedFromId") == renamed["id"] and h.page.evaluate("state.meta.loadedFrom") == renamed["name"])
    h.check("来源另存复制快照不复制 live", _snap_state(h, copy)["work1"]["sbu"]["name"] == "来源快照内容")
    _row(h, renamed).locator('button[data-act="delete"]').click()
    text = h.page.locator('[role="dialog"]:visible').last.inner_text()
    h.check("源删除确认范围准确", "来源已重命名" in text and "不可恢复" in text and "不删除当前工作区内容" in text, text)
    h.confirm("取消")
    h.wait_idle()
    h.check("取消删除来源不变", h.snapshot("来源已重命名") is not None and h.page.evaluate("state.meta.loadedFrom") == renamed["name"])
    _row(h, renamed).locator('button[data-act="delete"]').click()
    h.confirm("删除历史版本")
    h.wait_idle()
    h.check("源快照已删除但当前内容完整", h.snapshot("来源已重命名") is None and h.page.evaluate("state.work1.sbu.name") == "当前来源加载后的新编辑")
    h.check("源删除清来源和顶栏", h.page.evaluate("state.meta.loadedFrom==null && state.meta.loadedFromId==null") and h.page.locator("#archiveLabel").is_hidden())
    _close_history(h)
    h.save_version("删除来源后的内容持久化")
    data = h.api("GET", "/api/state")
    h.check("删除源之后 API 内容与无来源一致", data["work1"]["sbu"]["name"] == "当前来源加载后的新编辑" and data["meta"]["loadedFrom"] is None)
    _refresh(h)
    h.check("刷新不恢复已删来源", h.page.locator("#archiveLabel").is_hidden() and h.page.evaluate("state.work1.sbu.name") == "当前来源加载后的新编辑")


def _a21(h):
    h.seed("state.work1.sbu.name='案例前真实内容';state.work1.sbu.category='合成品类';")
    h.clear_archive()
    source = h.save_version("案例前真实版本")
    h.goto(1, "environment")
    before = _works(h)
    persisted = _server_works(h)
    versions = h.api("GET", "/api/snapshots")
    h.page.locator("#demoBtn").click()
    h.page.locator("#demoMenuList .demo-menu-item").first.click()
    h.page.wait_for_function("state.meta.demoCase && document.body.classList.contains('is-demo')")
    h.wait_idle()
    h.check("实际进入只读案例", h.page.locator("#demoBanner.show").is_visible() and h.page.locator("#archiveRenameBtn").is_hidden())
    for work, step in ((1, "sbu"), (2, "decision"), (3, "matrix"), (4, "place"), (5, "plan")):
        h.goto(work, step)
        h.wait_idle()
        h.check("案例导航可用 W" + str(work), h.page.evaluate("[App.currentWork,App.currentStep]") == [work, step])
    h.goto(1, "sbu")
    cta = h.page.locator('#steps1 .step.active .metric-next:not(.metric-next--hidden) button')
    if cta.count() and cta.first.is_visible():
        cta.first.click()
        h.check("案例步间 CTA 可用", h.page.evaluate("App.currentStep") == "environment")
    else:
        h.check("案例第一步有已完成 CTA 验收输入", False)
    h.goto(1, "sbu")
    case_name = h.page.evaluate("state.work1.sbu.name")
    input_node = h.page.locator(SBU).first
    h.page.locator("#demoBtn").focus()
    reached_edit = False
    for _ in range(100):
        h.page.keyboard.press("Tab")
        if input_node.evaluate("node=>node===document.activeElement"):
            reached_edit = True
            break
    if reached_edit:
        h.page.keyboard.press("ControlOrMeta+A")
        h.page.keyboard.type("案例键盘不得修改")
    h.check("案例键盘不能修改编辑字段", h.page.evaluate("state.work1.sbu.name") == case_name, {"tab_reached_editor": reached_edit})
    box = input_node.bounding_box()
    h.page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    h.page.keyboard.type("案例鼠标不得修改")
    h.check("案例鼠标不能修改编辑字段", h.page.evaluate("state.work1.sbu.name") == case_name)
    h.goto(5, "plan")
    case_chapter = h.page.evaluate("state.work5.ch1_business")
    chapter = h.page.locator(PLAN + " .chapter-text").first
    h.check("案例策划书正文有键盘只读语义", chapter.get_attribute("contenteditable") == "false" and chapter.get_attribute("aria-readonly") == "true")
    chapter.scroll_into_view_if_needed()
    box = chapter.bounding_box()
    h.page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    h.page.keyboard.type("案例策划书不可编辑")
    h.check("案例策划书点击和键盘不写内容", h.page.evaluate("state.work5.ch1_business") == case_chapter)
    h.goto(1, "environment")
    ai = h.page.locator('#steps1 .step.active button').filter(has_text="AI 起草").first
    if not ai.count():
        ai = h.page.locator('#steps1 .step.active button').filter(has_text="重新生成").first
    h.check("案例中存在代表性 AI 按钮", ai.count() > 0)
    llm_before = len([request for request in h.requests if request["path"].startswith("/api/llm")])
    ai.scroll_into_view_if_needed()
    box = ai.bounding_box()
    h.page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    h.check("案例 AI 不启动任务或请求", len([request for request in h.requests if request["path"].startswith("/api/llm")]) == llm_before and h.page.evaluate("!Runner.current"))
    h.page.locator("#saveBtn").click()
    h.check("案例不能打开存档写入", not h.page.locator("#savePopup.open").count())
    _history(h)
    for action in ("load", "rename", "delete"):
        _row(h, source).locator('button[data-act="' + action + '"]').click()
        h.wait_idle()
        h.check("案例档案写入锁：" + action, not h.page.locator('[role="dialog"]:visible').count() and not _row(h, source).locator(".snap-rename").count())
    _close_history(h)
    export = h.page.locator("#exportBtn")
    h.check("案例导出有禁用语义", export.is_disabled() and export.get_attribute("aria-disabled") == "true")
    export.scroll_into_view_if_needed()
    box = export.bounding_box()
    h.page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    h.check("案例导出菜单不可打开", not h.page.locator("#exportMenuPopup.open").count())
    h.page.get_by_role("button", name="重置工作区", exact=True).click()
    h.check("案例重置无覆盖确认", not h.page.locator('[role="dialog"]:visible').count())
    h.page.get_by_role("button", name="导入 .md", exact=True).click()
    h.check("案例导入没有启动保护流", h.page.evaluate("!App._importPending"))
    h.page.locator("#settingsGear").click()
    h.page.locator("#settingsModal.open").wait_for(state="visible")
    h.check("案例 API 管理豁免正常", h.page.locator("#settingsModal.open").is_visible())
    h.page.get_by_role("button", name="关闭设置面板", exact=True).click()
    h.check("案例中真实工作区与版本库不被污染", _server_works(h) == persisted and h.api("GET", "/api/snapshots") == versions)
    h.page.locator("#demoBtn").click()
    h.page.wait_for_function("!state.meta.demoCase && !document.body.classList.contains('is-demo')")
    h.wait_idle()
    h.check("退出案例恢复原内容和位置", _works(h) == before and h.page.evaluate("[App.currentWork,App.currentStep]") == [1, "environment"])
    h.check("退出案例真实 API 保留原内容", _server_works(h) == persisted)
    _refresh(h)
    h.check("退出并刷新原工作区持续存在", h.page.evaluate("state.work1.sbu.name") == "案例前真实内容" and not h.page.evaluate("state.meta.demoCase"))


def run(h):
    for code, title, callback in (
        ("A01", "有/无未保存改动加载确认、取消和持久化", _a01),
        ("A02", "加载 HTTP/网络失败保留现场并可再次操作", _a02),
        ("A03", "行内/顶栏命名 Enter/Escape/失焦和显式动作", _a03),
        ("A04", "保存/重命名同名冲突的全部三动作", _a04),
        ("A05", "命名写入失败、重试与服务端实际后缀", _a05),
        ("A12", "重置/导入/W5 四类前置故障和真实重试", _a12),
        ("A13", "三类覆盖后保存失败与 W5 备份期间输入保护", _a13),
        ("A14", "W5 证据只读和精确上游修改导航", _a14),
        ("A15", "当前来源重命名/复制/删除及持久化", _a15),
        ("A21", "案例导航豁免与键盘/档案/AI/导出锁", _a21),
    ):
        h.case(code, title, lambda callback=callback: callback(h))
